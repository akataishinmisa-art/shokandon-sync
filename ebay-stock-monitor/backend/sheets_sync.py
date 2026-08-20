import re
import csv
import io
import logging
import httpx
from typing import List, Dict, Any, Optional
from database import create_ebay_delist_item, get_all_ebay_delist_items, get_db_connection

logger = logging.getLogger(__name__)

def extract_spreadsheet_id(url: str) -> Optional[str]:
    """GoogleスプレッドシートのURLからSpreadsheet IDを抽出"""
    match = re.search(r'/d/([a-zA-Z0-9-_]+)', url)
    return match.group(1) if match else None

def get_csv_export_url(url: str, gid: str = "0") -> Optional[str]:
    """スプレッドシートURLをCSVエクスポートURLに変換"""
    sheet_id = extract_spreadsheet_id(url)
    if not sheet_id:
        return None
    gid_match = re.search(r'gid=([0-9]+)', url)
    if gid_match:
        gid = gid_match.group(1)
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"

def sync_google_sheet(sheet_url: str) -> Dict[str, Any]:
    """
    Googleスプレッドシートから [eBay Item ID, 仕入れ元URL] を読み込み、
    データベースへ登録・同期する。
    """
    csv_url = get_csv_export_url(sheet_url)
    if not csv_url:
        return {"success": False, "error": "無効なGoogleスプレッドシートURLです。"}

    try:
        res = httpx.get(csv_url, follow_redirects=True, timeout=15)
        if res.status_code != 200:
            return {
                "success": False, 
                "error": f"スプレッドシートの取得に失敗しました (HTTP {res.status_code})。共有設定が「リンクを知っている全員が閲覧可」になっているか確認してください。"
            }

        # CSVパース
        res.encoding = 'utf-8'
        csv_text = res.text
        reader = csv.reader(io.StringIO(csv_text))
        rows = list(reader)

        if not rows:
            return {"success": False, "error": "スプレッドシートが空です。"}

        # ヘッダー行判定
        header = [c.strip().lower() for c in rows[0]]
        ebay_col_idx = 0
        url_col_idx = 1
        title_col_idx = 2

        for idx, col in enumerate(header):
            if "ebay" in col or "商品id" in col or "item" in col:
                ebay_col_idx = idx
            elif "url" in col or "仕入れ" in col or "リンク" in col or "source" in col:
                url_col_idx = idx
            elif "タイトル" in col or "商品名" in col or "title" in col:
                title_col_idx = idx

        # 既存アイテム取得
        existing_items = get_all_ebay_delist_items()
        existing_map = {f"{item['ebay_item_id']}_{item['source_url']}": item for item in existing_items}

        added_count = 0
        updated_count = 0
        start_row = 1 if ("ebay" in header[0] or "id" in header[0] or "url" in header[1] or "仕入れ" in header[1]) else 0

        conn = get_db_connection()
        cursor = conn.cursor()

        for row_idx, row in enumerate(rows[1:], start=2):
            if not row or len(row) < 2:
                continue

            source_url = ""
            ebay_id = ""
            title = ""

            # 1. 行の中から仕入れ元URL（メルカリ/ヤフオク/Amazon/ラクマ等）を自動検出
            for cell in row:
                cell_str = cell.strip()
                if ("http://" in cell_str or "https://" in cell_str) and ("ebay.com" not in cell_str):
                    source_url = cell_str
                    break

            # 2. 行の中から 12桁のeBay Item ID (または ebay.com/itm/168599743807 形式のURL) を自動抽出
            for cell in row:
                cell_str = cell.strip()
                # URLパターンの場合
                url_match = re.search(r'itm/(?:[a-zA-Z0-9-]+/)?(\d{12})', cell_str, re.IGNORECASE)
                if url_match:
                    ebay_id = url_match.group(1)
                    break
                # 単体12桁の数字の場合
                num_match = re.search(r'\b(\d{12})\b', cell_str)
                if num_match:
                    ebay_id = num_match.group(1)
                    break

            # 3. 商品名の取得（B列またはC列）
            if len(row) > 2 and row[2].strip():
                title = row[2].strip()
            elif len(row) > 1 and row[1].strip():
                title = row[1].strip()

            # 正常に仕入れ元URLとeBay IDの両方が検出された場合
            if ebay_id and source_url:
                key = f"{ebay_id}_{source_url}"
                if key not in existing_map:
                    cursor.execute("""
                    INSERT INTO ebay_delist_items (ebay_item_id, source_url, title, status, delist_mode)
                    VALUES (?, ?, ?, 'active', 'end_item')
                    """, (ebay_id, source_url, title))
                    added_count += 1
                else:
                    updated_count += 1

        conn.commit()
        conn.close()

        return {
            "success": True,
            "added": added_count,
            "total_synced": added_count + updated_count,
            "message": f"スプレッドシートから {added_count} 件の新しい商品を同期・追加しました。（合計: {added_count + updated_count} 件）"
        }

    except Exception as e:
        logger.error(f"[Sheets Sync Error]: {e}")
        return {"success": False, "error": f"同期エラー: {str(e)}"}
