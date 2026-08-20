import sqlite3
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "monitor.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 監視対象アイテムテーブル
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS target_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        keyword TEXT NOT NULL,
        platform TEXT NOT NULL DEFAULT 'all',
        ebay_price_usd REAL DEFAULT 0.0,
        ebay_price_jpy REAL DEFAULT 0.0,
        target_discount_pct REAL DEFAULT 20.0,
        max_buy_price_jpy REAL DEFAULT 0.0,
        est_shipping_jpy REAL DEFAULT 2500.0,
        min_profit_jpy REAL DEFAULT 0.0,
        exclude_keywords TEXT DEFAULT 'ジャンク,故障,不動,部品取り,箱のみ,写真のみ,現状渡し,訳あり',
        check_interval_seconds INTEGER DEFAULT 60,
        is_active INTEGER DEFAULT 1,
        last_checked_at TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
    """)
    
    # 検知履歴（見つかった商品）テーブル
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS detections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_item_id INTEGER,
        title TEXT NOT NULL,
        price_jpy REAL NOT NULL,
        image_url TEXT,
        item_url TEXT NOT NULL UNIQUE,
        platform TEXT NOT NULL,
        condition TEXT,
        seller_name TEXT,
        shipping_days TEXT DEFAULT '出品ページ参照',
        ebay_price_jpy REAL,
        discount_pct REAL,
        est_profit_jpy REAL,
        notified INTEGER DEFAULT 0,
        is_auction INTEGER DEFAULT 0,
        detected_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (target_item_id) REFERENCES target_items (id) ON DELETE SET NULL
    )
    """)
    
    # マイグレーション
    try:
        cursor.execute("ALTER TABLE target_items ADD COLUMN specs_note TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE target_items ADD COLUMN category TEXT DEFAULT '📁 未分類'")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE detections ADD COLUMN is_auction INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE detections ADD COLUMN is_saved INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE detections ADD COLUMN raw_price_jpy REAL DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE detections ADD COLUMN shipping_fee_jpy REAL DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE detections ADD COLUMN is_hidden INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE detections ADD COLUMN is_listing INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    
    # システム設定テーブル
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    """)
    
    # eBay自動取り下げ監視アイテムテーブル
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ebay_delist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ebay_item_id TEXT NOT NULL,
        source_url TEXT NOT NULL,
        title TEXT DEFAULT '',
        status TEXT DEFAULT 'active',
        delist_mode TEXT DEFAULT 'end_item',
        last_checked_at TEXT,
        delisted_at TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
    """)
    
    # 初期設定値の登録
    default_settings = {
        "discord_webhook_url": "",
        "discord_enabled": "1",
        "sound_alert_enabled": "1",
        "usd_jpy_rate": "155.0",
        "auto_update_rate": "1",
        "ebay_fee_pct": "12.0",
        "ebay_app_id": "",
        "ebay_dev_id": "",
        "ebay_cert_id": "",
        "ebay_user_token": "",
        "ebay_delist_mode": "end_item",
        "google_sheet_url": "",
        "auto_delist_enabled": "1",
        "delist_check_interval_seconds": "300"
    }
    for key, val in default_settings.items():
        cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (key, val))
        
    conn.commit()
    conn.close()

# --- ターゲット商品 CRUD ---

def get_all_target_items() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM target_items ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_target_item(item_id: int) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM target_items WHERE id = ?", (item_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def create_target_item(data: Dict[str, Any]) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO target_items (
        name, keyword, platform, ebay_price_usd, ebay_price_jpy,
        target_discount_pct, max_buy_price_jpy, est_shipping_jpy,
        min_profit_jpy, exclude_keywords, check_interval_seconds, is_active, specs_note, category
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("name"),
        data.get("keyword"),
        data.get("platform", "all"),
        data.get("ebay_price_usd", 0.0),
        data.get("ebay_price_jpy", 0.0),
        data.get("target_discount_pct", 20.0),
        data.get("max_buy_price_jpy", 0.0),
        data.get("est_shipping_jpy", 2500.0),
        data.get("min_profit_jpy", 0.0),
        data.get("exclude_keywords", "ジャンク,故障,不動,部品取り,箱のみ,写真のみ"),
        data.get("check_interval_seconds", 60),
        data.get("is_active", 1),
        data.get("specs_note", ""),
        data.get("category", "📁 未分類")
    ))
    item_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return item_id

def update_target_item(item_id: int, data: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    fields = []
    values = []
    for k, v in data.items():
        if k != "id":
            fields.append(f"{k} = ?")
            values.append(v)
    values.append(item_id)
    cursor.execute(f"UPDATE target_items SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    conn.close()

def delete_target_item(item_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM target_items WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()

def update_last_checked(item_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE target_items SET last_checked_at = datetime('now', 'localtime') WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()

# --- 検知ログ CRUD ---

def add_detection(data: Dict[str, Any]) -> Optional[int]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        INSERT OR REPLACE INTO detections (
            target_item_id, title, price_jpy, image_url, item_url,
            platform, condition, seller_name, shipping_days, ebay_price_jpy,
            discount_pct, est_profit_jpy, notified, is_auction, raw_price_jpy, shipping_fee_jpy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("target_item_id"),
            data.get("title"),
            data.get("price_jpy"),
            data.get("image_url"),
            data.get("item_url"),
            data.get("platform", "国内フリマ"),
            data.get("condition", ""),
            data.get("seller_name", ""),
            data.get("shipping_days", "出品ページ参照"),
            data.get("ebay_price_jpy", 0.0),
            data.get("discount_pct", 0.0),
            data.get("est_profit_jpy", 0.0),
            data.get("notified", 0),
            1 if data.get("is_auction") else 0,
            data.get("raw_price_jpy", data.get("price_jpy")),
            data.get("shipping_fee_jpy", 0)
        ))
        detection_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return detection_id
    except Exception as e:
        conn.close()
        return None

def update_detection_details(detection_id: int, condition: str, shipping_days: str):
    """検出アイテムの状態と発送目安を更新"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE detections 
        SET condition = ?, shipping_days = ?
        WHERE id = ?
    """, (condition, shipping_days, detection_id))
    conn.commit()
    conn.close()

def get_recent_detections(limit: int = 100, show_hidden: bool = False) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if show_hidden:
        cursor.execute("""
        SELECT d.*, t.name as target_name 
        FROM detections d
        LEFT JOIN target_items t ON d.target_item_id = t.id
        WHERE d.is_hidden = 1
        ORDER BY d.id DESC LIMIT ?
        """, (limit,))
    else:
        cursor.execute("""
        SELECT d.*, t.name as target_name 
        FROM detections d
        LEFT JOIN target_items t ON d.target_item_id = t.id
        WHERE d.is_hidden = 0 OR d.is_hidden IS NULL
        ORDER BY d.id DESC LIMIT ?
        """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def toggle_save_detection(detection_id: int) -> int:
    """商品の保存（お気に入り・キープ）状態をトグル反転 (0 <-> 1)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT is_saved FROM detections WHERE id = ?", (detection_id,))
    row = cursor.fetchone()
    new_state = 1
    if row and row["is_saved"] == 1:
        new_state = 0
    cursor.execute("UPDATE detections SET is_saved = ? WHERE id = ?", (new_state, detection_id))
    conn.commit()
    conn.close()
    return new_state

def toggle_hide_detection(detection_id: int) -> int:
    """商品の非表示（もう見ない）状態をトグル反転 (0 <-> 1)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT is_hidden FROM detections WHERE id = ?", (detection_id,))
    row = cursor.fetchone()
    new_state = 1
    if row and row["is_hidden"] == 1:
        new_state = 0
    cursor.execute("UPDATE detections SET is_hidden = ? WHERE id = ?", (new_state, detection_id))
    conn.commit()
    conn.close()
    return new_state

def toggle_listing_detection(detection_id: int) -> int:
    """商品の出品中状態をトグル反転 (0 <-> 1)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT is_listing FROM detections WHERE id = ?", (detection_id,))
    row = cursor.fetchone()
    new_state = 1
    if row and row["is_listing"] == 1:
        new_state = 0
    cursor.execute("UPDATE detections SET is_listing = ? WHERE id = ?", (new_state, detection_id))
    conn.commit()
    conn.close()
    return new_state

def is_item_hidden(item_url: str) -> bool:
    """URLが過去に「もう見ない」登録されているか判定"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM detections WHERE item_url = ? AND is_hidden = 1", (item_url,))
    row = cursor.fetchone()
    conn.close()
    return row is not None

def clear_all_detections(preserve_saved: bool = True):
    """一覧クリア（保存済み is_saved=1、出品中 is_listing=1、非表示履歴 is_hidden=1 は保護して残す）"""
    conn = get_db_connection()
    cursor = conn.cursor()
    if preserve_saved:
        cursor.execute("DELETE FROM detections WHERE (is_saved = 0 OR is_saved IS NULL) AND (is_listing = 0 OR is_listing IS NULL) AND (is_hidden = 0 OR is_hidden IS NULL)")
    else:
        cursor.execute("DELETE FROM detections WHERE (is_hidden = 0 OR is_hidden IS NULL)")
    conn.commit()
    conn.close()

def is_item_detected_before(item_url: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM detections WHERE item_url = ?", (item_url,))
    row = cursor.fetchone()
    conn.close()
    return row is not None

def cleanup_old_detections(days: int = 30):
    """30日以上前の非表示・未保存ゴミデータを自動消去（データ肥大化完全防止）"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    DELETE FROM detections 
    WHERE (is_saved = 0 OR is_saved IS NULL) 
      AND detected_at < datetime('now', '-' || ? || ' days', 'localtime')
    """, (days,))
    conn.commit()
    conn.close()

# --- 設定 CRUD ---

def get_all_settings() -> Dict[str, str]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM settings")
    rows = cursor.fetchall()
    conn.close()
    return {row["key"]: row["value"] for row in rows}

def update_setting(key: str, value: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()

# --- eBay 取り下げ監視 CRUD ---

def create_ebay_delist_item(ebay_item_id: str, source_url: str, title: str = "", delist_mode: str = "end_item") -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO ebay_delist_items (ebay_item_id, source_url, title, status, delist_mode)
    VALUES (?, ?, ?, 'active', ?)
    """, (ebay_item_id.strip(), source_url.strip(), title.strip(), delist_mode))
    item_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return item_id

def get_all_ebay_delist_items() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM ebay_delist_items ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_active_ebay_delist_items() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM ebay_delist_items WHERE status = 'active' ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def update_ebay_delist_item_status(item_id: int, status: str, error_message: str = "", delisted_at: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if status == "delisted" and not delisted_at:
        delisted_at = now_str
    
    cursor.execute("""
    UPDATE ebay_delist_items 
    SET status = ?, last_checked_at = ?, delisted_at = ?, error_message = ?
    WHERE id = ?
    """, (status, now_str, delisted_at, error_message, item_id))
    conn.commit()
    conn.close()

def delete_ebay_delist_item(item_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM ebay_delist_items WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()

# 初期化実行
if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")

