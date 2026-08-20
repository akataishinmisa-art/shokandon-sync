import asyncio
import logging
import httpx
import re
from typing import Dict, Any, Tuple
from database import (
    get_all_settings, get_active_ebay_delist_items, update_ebay_delist_item_status
)
from ebay_api import EbayAPIClient
from sheets_sync import sync_google_sheet
from notifier import send_discord_delist_notification

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8"
}

def check_source_url_stock(url: str) -> Tuple[bool, str]:
    """
    仕入れ元URLの在庫状況を判定する。
    戻り値: (is_sold_out: bool, reason: str)
    """
    url = url.strip()
    try:
        res = httpx.get(url, headers=HEADERS, timeout=12.0, follow_redirects=True)
        if res.status_code == 404:
            return True, "ページが存在しません (404 削除済み)"
        elif res.status_code >= 400:
            return False, f"アクセス一時エラー (HTTP {res.status_code})"

        html = res.text

        # 1. メルカリ (Mercari)
        if "mercari.com" in url:
            if "売り切れ" in html or "ITEM_STATUS_SOLD_OUT" in html or "ITEM_STATUS_TRADING" in html:
                return True, "メルカリで売り切れ（SOLD OUT）を検知"
            if "この商品は削除されました" in html or "ページが見つかりません" in html:
                return True, "メルカリで商品削除を検知"

        # 2. ヤフオク・PayPayフリマ (Yahoo Auctions / Flea)
        elif "yahoo.co.jp" in url or "paypayfleamarket" in url:
            if "このオークションは終了しました" in html or "落札されました" in html or "売り切れ" in html or "掲載終了" in html:
                return True, "ヤフオク/PayPayフリマで終了・売り切れを検知"
            if "指定されたページは見つかりませんでした" in html:
                return True, "ヤフオク/PayPayフリマでページ削除を検知"

        # 3. ラクマ (Rakuma / Fril)
        elif "fril.jp" in url:
            if "売り切れました" in html or "SOLDOUT" in html or "取引中" in html:
                return True, "ラクマで売り切れ（SOLDOUT）を検知"
            if "商品が見つかりません" in html:
                return True, "ラクマで商品削除を検知"

        # 4. Amazon
        elif "amazon.co.jp" in url:
            if "一時的に在庫切れ" in html or "現在お取り扱いしておりません" in html or "在庫なし" in html:
                return True, "Amazonで在庫切れを検知"

        # 5. 一般キーワード判定（汎用）
        sold_keywords = ["売り切れ", "SOLD OUT", "sold out", "在庫なし", "販売終了", "削除されました"]
        for kw in sold_keywords:
            if kw in html:
                return True, f"汎用キーワード '{kw}' を検知"

        return False, "在庫あり"

    except Exception as e:
        logger.error(f"[Stock Check Error] {url}: {e}")
        return False, f"チェック時エラー: {str(e)}"


async def run_auto_delist_check_now() -> Dict[str, Any]:
    """
    全監視アイテムの自動チェック・取り下げ一括実行
    """
    settings = get_all_settings()
    sheet_url = settings.get("google_sheet_url", "").strip()

    sync_msg = ""
    # スプレッドシート同期
    if sheet_url:
        sync_result = sync_google_sheet(sheet_url)
        sync_msg = sync_result.get("message", "")

    active_items = get_active_ebay_delist_items()
    if not active_items:
        return {
            "success": True,
            "checked_count": 0,
            "delisted_count": 0,
            "message": f"監視対象のアイテムが登録されていません。{sync_msg}"
        }

    ebay_client = EbayAPIClient(
        dev_id=settings.get("ebay_dev_id", ""),
        app_id=settings.get("ebay_app_id", ""),
        cert_id=settings.get("ebay_cert_id", ""),
        user_token=settings.get("ebay_user_token", ""),
        is_sandbox=False
    )
    delist_mode = settings.get("ebay_delist_mode", "end_item")

    checked_count = 0
    delisted_count = 0
    details = []

    for item in active_items:
        item_id = item["id"]
        ebay_item_id = item["ebay_item_id"]
        source_url = item["source_url"]
        title = item.get("title", "")

        checked_count += 1
        item_status = item.get("status", "")
        if item_status == "sold_out_flag":
            is_sold = True
            reason = "スプレッドシートF列で『欠品/売り切れ』を検知"
        else:
            is_sold, reason = check_source_url_stock(source_url)

        if is_sold:
            logger.info(f"[Auto Delist Trigger] ItemID={ebay_item_id}, Reason={reason}")
            # eBay API 呼び出し
            if delist_mode == "quantity_zero":
                res = ebay_client.revise_quantity_zero(ebay_item_id)
            else:
                res = ebay_client.end_fixed_price_item(ebay_item_id)

            if res.get("success"):
                delisted_count += 1
                msg = res.get("message") or f"eBay取り下げ完了 ({reason})"
                update_ebay_delist_item_status(item_id, "delisted", error_message=msg)
                
                # Discord通知（非同期）
                asyncio.create_task(send_discord_delist_notification(ebay_item_id, source_url, title, msg))

                details.append({
                    "ebay_item_id": ebay_item_id,
                    "status": "delisted",
                    "reason": reason,
                    "simulated": res.get("simulated", False)
                })
            else:
                err_msg = res.get("error", "eBay APIエラー")
                update_ebay_delist_item_status(item_id, "error", error_message=err_msg)
                details.append({
                    "ebay_item_id": ebay_item_id,
                    "status": "error",
                    "error": err_msg
                })
        else:
            update_ebay_delist_item_status(item_id, "active", error_message=reason)

    return {
        "success": True,
        "checked_count": checked_count,
        "delisted_count": delisted_count,
        "details": details,
        "message": f"{checked_count} 件の仕入れ元をチェックし、{delisted_count} 件のeBay出品を自動取り下げしました。 {sync_msg}"
    }


class AutoDelistEngine:
    """定期実行バックグラウンドエンジン"""
    def __init__(self):
        self.is_running = False
        self._task = None

    def start(self):
        if not self.is_running:
            self.is_running = True
            self._task = asyncio.create_task(self._loop())
            logger.info("[Auto Delist Engine] バックグラウンド監視を開始しました。")

    def stop(self):
        if self.is_running:
            self.is_running = False
            if self._task:
                self._task.cancel()
            logger.info("[Auto Delist Engine] バックグラウンド監視を停止しました。")

    async def _loop(self):
        while self.is_running:
            try:
                settings = get_all_settings()
                enabled = settings.get("auto_delist_enabled", "1") == "1"
                interval = int(settings.get("delist_check_interval_seconds", "300"))

                if enabled:
                    await run_auto_delist_check_now()

                await asyncio.sleep(max(60, interval))
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[Auto Delist Engine Loop Error]: {e}")
                await asyncio.sleep(60)

auto_delist_engine = AutoDelistEngine()
