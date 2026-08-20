import asyncio
import logging
import re
from typing import List, Dict, Any
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from database import (
    get_all_target_items, get_target_item, update_last_checked,
    add_detection, is_item_detected_before, get_all_settings
)
from scraper import ScraperManager
from notifier import send_discord_notification
from exchange_rate import get_current_usd_jpy_rate, fetch_usd_jpy_rate

logger = logging.getLogger(__name__)

class MonitorEngine:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.is_running = False
        self.last_detection_events = [] # リアルタイムWeb通知用キュー

    def start(self):
        # 常時巡回は行わず、手動オンデマンドチェックメインに切り替え
        self.is_running = True
        logger.info("MonitorEngine initialized in on-demand mode.")

    def stop(self):
        self.is_running = False

    async def check_all_items(self):
        """すべての登録アイテムを手動チェック"""
        items = get_all_target_items()
        all_results = []
        for item in items:
            try:
                res = await self.check_single_item(item)
                all_results.extend(res)
            except Exception as e:
                logger.error(f"Error checking item {item.get('id')}: {e}")
            await asyncio.sleep(1)
        return all_results

    async def check_single_item(self, target_item: Dict[str, Any], search_mode: str = "recent", ignore_max_price: bool = False) -> List[Dict[str, Any]]:
        """1つの登録アイテムの現在出品中商品をピックアップ (search_mode: recent / all, ignore_max_price: 上限価格無視)"""
        item_id = target_item["id"]
        keyword = target_item["keyword"]
        
        ebay_jpy = float(target_item.get("ebay_price_jpy", 0.0))
        target_profit_pct = float(target_item.get("target_discount_pct", 30.0))
        max_buy_price = float(target_item.get("max_buy_price_jpy", 0.0))
        
        if max_buy_price <= 0 and ebay_jpy > 0:
            net_payout = ebay_jpy * 0.88
            max_buy_price = round(net_payout / (1.0 + (target_profit_pct / 100.0)))

        # 💡 下限価格（仕入れ上限価格の50%以下の安すぎるアクセサリ・消耗品・パーツ・ゴミ出品を足切り除外）
        if max_buy_price > 0:
            min_buy_price = max_buy_price * 0.50
        elif ebay_jpy > 0:
            min_buy_price = (ebay_jpy * 0.88 / (1.0 + (target_profit_pct / 100.0))) * 0.50
        else:
            min_buy_price = 1000.0

        exclude_raw = target_item.get("exclude_keywords", "")
        exclude_keywords = [k.strip().lower() for k in exclude_raw.split(",") if k.strip()]

        update_last_checked(item_id)
        settings = get_all_settings()
        ebay_fee_pct = float(settings.get("ebay_fee_pct", "12.0"))

        # アクセサリ・消耗品「単体」の強力な自動NGワード（本体セットは除外しない）
        accessory_only_ng_words = [
            "充電器のみ", "充電器 単品", "チャージャーのみ", "バッテリーのみ", "電池のみ", "ケーブルのみ",
            "ケースのみ", "カバーのみ", "説明書のみ", "マニュアルのみ", "箱のみ", "元箱のみ",
            "互換バッテリー", "互換充電器", "互換電池", "保護フィルム", "保護シール"
        ]
        # 本体を示すキーワード（これらが含まれていれば本体と判定）
        main_body_keywords = [
            "カメラ", "本体", "コンデジ", "デジカメ", "ボディ", "セット", "一式", "付属", 
            "動作品", "稼動品", "稼働品", "動作確認", "中古品", "良品", "美品", "完動品"
        ]

        # 型番・固有キーワードの特定（例: S110, 3DS, Vita, Switch, Coach, TZ5 など）
        num_tokens = [w.lower() for w in re.findall(r'[a-zA-Z0-9]+', keyword) if any(c.isdigit() for c in w) and len(w) >= 2]
        
        # 一般的なメーカー名・汎用名詞を除外した重要モデルトークン
        generic_words = ["canon", "sony", "nikon", "olympus", "panasonic", "nintendo", "任天堂", "ニンテンドー", "本体", "セット", "一式", "中古", "美品", "新品", "バッグ", "トートバッグ"]
        split_tokens = [w.lower() for w in re.split(r'[\s　]+', keyword) if len(w) >= 2 and w.lower() not in generic_words]
        
        # 重要モデル名（switch, 3ds, vita, lumix, tz5, coach 等）
        core_tokens = num_tokens if num_tokens else split_tokens
        if not core_tokens:
            # 汎用名詞しかない場合は全トークンを使用
            core_tokens = [w.lower() for w in re.split(r'[\s　]+', keyword) if len(w) >= 2]

        def process_items(found_list, platform_name):
            results = []
            for found in found_list:
                item_url = found["item_url"]
                title = found["title"]
                price_jpy = found["price_jpy"]
                title_lower = title.lower()
                
                # 🚫 ユーザーが「もう見ない」登録した商品を自動スキップ
                from database import is_item_hidden
                if is_item_hidden(item_url):
                    continue

                # ① ユーザー指定の除外キーワード判定
                if any(ex in title_lower for ex in exclude_keywords):
                    continue

                # ② アクセサリ・消耗品「単体」の自動NGワード除外（本体が含まれていない場合のみ）
                is_main_body = any(mb in title_lower for mb in main_body_keywords)
                if not is_main_body and any(ng in title_lower for ng in accessory_only_ng_words):
                    continue
                if any(ng in title_lower for ng in ["充電器のみ", "バッテリーのみ", "電池のみ", "箱のみ"]):
                    continue

                # ③ 💡 固有商品名・型番のタイトル一致チェック（検索スパム・無関係なLED/扇風機/車用品等の完全排除）
                if core_tokens:
                    clean_title = re.sub(r'[\s\-_・/]', '', title_lower)
                    matched = False
                    for token in core_tokens:
                        clean_token = re.sub(r'[\s\-_・/]', '', token)
                        if clean_token in clean_title or token in title_lower:
                            matched = True
                            break
                        # 日本語・英語表記の吸収（例: switch <-> スイッチ）
                        if token == "switch" and ("スイッチ" in title or "すいっち" in title):
                            matched = True
                            break
                        if token == "vita" and ("ヴィータ" in title or "ビータ" in title):
                            matched = True
                            break
                    if not matched:
                        continue
                
                # ④ 上限価格判定（ignore_max_price時はスキップ）
                if not ignore_max_price and max_buy_price > 0 and price_jpy > max_buy_price:
                    continue

                # ⑤ 💡 下限価格判定（オークション以外の通常出品のみ足切り）
                is_auc = found.get("is_auction") or False
                if not is_auc and price_jpy < min_buy_price:
                    continue

                net_payout = ebay_jpy * (1.0 - (ebay_fee_pct / 100.0)) if ebay_jpy > 0 else 0.0
                est_profit = net_payout - price_jpy if net_payout > 0 else 0.0
                actual_profit_pct = (est_profit / price_jpy * 100.0) if price_jpy > 0 else 0.0

                detection_data = {
                    "target_item_id": item_id,
                    "title": title,
                    "price_jpy": price_jpy,
                    "image_url": found.get("image_url", ""),
                    "item_url": item_url,
                    "platform": found.get("platform", platform_name),
                    "condition": found.get("condition") or "⏳ 状態取得中...",
                    "seller_name": found.get("seller_name", ""),
                    "shipping_days": found.get("shipping_days") or "⏳ 取得中...",
                    "ebay_price_jpy": ebay_jpy,
                    "discount_pct": round(actual_profit_pct, 1),
                    "est_profit_jpy": round(est_profit, 0),
                    "target_name": target_item["name"],
                    "notified": 0,
                    "is_auction": 1 if found.get("is_auction") else 0
                }
                results.append(detection_data)
            return results

        # 4大モール（メルカリ、Yahoo!フリマ、ヤフオク、ラクマ）を完全独立・安全並行取得
        scrape_max_price = 0 if ignore_max_price else max_buy_price
        scrape_min_price = min_buy_price

        async def safe_scrape(coro, platform_name):
            try:
                return await coro
            except Exception as e:
                logger.error(f"[{platform_name}] Scrape error (isolated): {e}")
                return []

        tasks = [
            safe_scrape(ScraperManager.search_mercari_playwright(keyword, max_price=scrape_max_price, min_price=scrape_min_price, search_mode=search_mode), "メルカリ"),
            safe_scrape(ScraperManager.search_yahoo_fleamarket(keyword, max_price=scrape_max_price, min_price=scrape_min_price, search_mode=search_mode), "Yahoo!フリマ"),
            safe_scrape(ScraperManager.search_yahoo_auction(keyword, max_price=scrape_max_price, min_price=scrape_min_price, search_mode=search_mode), "ヤフオク"),
            safe_scrape(ScraperManager.search_rakuma(keyword, max_price=scrape_max_price, min_price=scrape_min_price, search_mode=search_mode), "ラクマ")
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        all_items = []
        for res, name in zip(results, ["メルカリ", "Yahoo!フリマ", "ヤフオク", "ラクマ"]):
            if isinstance(res, list):
                all_items.extend(process_items(res, name))

        # ⚡ 4大モールすべてを即座に高速並行直接抽出（わずか数秒で全100件確定）
        try:
            from detail_enricher_robust import (
                enrich_fast_parallel_rakuma,
                enrich_fast_parallel_yahoo_flea,
                enrich_fast_parallel_yahoo_auction,
                enrich_fast_parallel_mercari
            )
            await asyncio.gather(
                enrich_fast_parallel_rakuma(all_items),
                enrich_fast_parallel_yahoo_flea(all_items),
                enrich_fast_parallel_yahoo_auction(all_items),
                enrich_fast_parallel_mercari(all_items),
                return_exceptions=True
            )
        except Exception as enrich_err:
            logger.error(f"Instant parallel enrich error (non-fatal): {enrich_err}")

        # 💡 「目立った傷や汚れなし より上（新品、未使用 / 未使用に近い / 目立った傷や汚れなし）」のみをピックアップ
        bad_conditions = ["やや傷や汚れあり", "傷や汚れあり", "全体的に状態が悪い", "ジャンク", "故障"]
        valid_items = []
        for it in all_items:
            cond = it.get("condition", "")
            if cond and any(bad in cond for bad in bad_conditions):
                continue
            valid_items.append(it)

        # 各商品の値をセットしてDB保存（IDを付与）
        confirmed_items = []
        for it in valid_items:
            try:
                det_id = add_detection(it)
                it["id"] = det_id
                confirmed_items.append(it)
            except Exception as db_err:
                logger.error(f"DB insert error for item {it.get('item_url')}: {db_err}")

        # 🛡️ Yahoo系（ヤフオク・Yahoo!フリマ）等の規制対象は安全レートリミット付きワーカーで順次取得
        try:
            from detail_enricher_robust import run_background_safe_enricher
            asyncio.create_task(run_background_safe_enricher(confirmed_items))
        except Exception as bg_err:
            logger.error(f"Background enricher spawn error: {bg_err}")

        return confirmed_items

# グローバルインスタンス
monitor_engine = MonitorEngine()
