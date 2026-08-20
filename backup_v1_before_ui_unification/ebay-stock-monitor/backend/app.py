import os
import uvicorn
from contextlib import asynccontextmanager
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from database import (
    init_db, get_all_target_items, get_target_item, create_target_item,
    update_target_item, delete_target_item, get_recent_detections,
    get_all_settings, update_setting, add_detection, get_db_connection,
    create_ebay_delist_item, get_all_ebay_delist_items, delete_ebay_delist_item
)
from exchange_rate import fetch_usd_jpy_rate, get_current_usd_jpy_rate
from monitor_engine import monitor_engine
from ebay_auto_delister import auto_delist_engine, run_auto_delist_check_now
from sheets_sync import sync_google_sheet
from notifier import send_test_discord

# ライフサイクル管理
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    await fetch_usd_jpy_rate()
    monitor_engine.start()
    auto_delist_engine.start()
    yield
    monitor_engine.stop()
    auto_delist_engine.stop()

app = FastAPI(title="eBay Arbitrage Stock Monitor", lifespan=lifespan)

# Pydantic スキーマ
class TargetItemCreate(BaseModel):
    name: str
    keyword: str
    platform: str = "all"
    ebay_price_usd: float = 0.0
    ebay_price_jpy: float = 0.0
    target_discount_pct: float = 20.0
    max_buy_price_jpy: float = 0.0
    est_shipping_jpy: float = 2500.0
    min_profit_jpy: float = 0.0
    exclude_keywords: str = "ジャンク,故障,不動,部品取り,箱のみ,写真のみ,現状渡し,訳あり"
    check_interval_seconds: int = 60
    is_active: int = 1
    specs_note: Optional[str] = ""
    category: Optional[str] = "📁 未分類"

class SettingsUpdate(BaseModel):
    discord_webhook_url: Optional[str] = None
    discord_enabled: Optional[str] = None
    sound_alert_enabled: Optional[str] = None
    usd_jpy_rate: Optional[str] = None
    ebay_fee_pct: Optional[str] = None

# --- API エンドポイント ---

@app.get("/api/status")
def get_status():
    return {
        "status": "running" if monitor_engine.is_running else "stopped",
        "usd_jpy_rate": get_current_usd_jpy_rate(),
        "total_targets": len(get_all_target_items()),
        "recent_detections_count": len(get_recent_detections(limit=100))
    }

@app.get("/api/targets")
def list_targets():
    return get_all_target_items()

@app.post("/api/targets")
def add_target(item: TargetItemCreate):
    item_dict = item.model_dump()
    # 為替レート換算
    rate = get_current_usd_jpy_rate()
    if item_dict["ebay_price_usd"] > 0 and item_dict["ebay_price_jpy"] <= 0:
        item_dict["ebay_price_jpy"] = round(item_dict["ebay_price_usd"] * rate, 0)
    if item_dict["max_buy_price_jpy"] <= 0 and item_dict["ebay_price_jpy"] > 0:
        item_dict["max_buy_price_jpy"] = round(item_dict["ebay_price_jpy"] * (1.0 - (item_dict["target_discount_pct"] / 100.0)), 0)
        
    item_id = create_target_item(item_dict)
    return {"id": item_id, "message": "Target created successfully"}

@app.put("/api/targets/{item_id}")
def edit_target(item_id: int, data: Dict[str, Any] = Body(...)):
    existing = get_target_item(item_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Target item not found")
    update_target_item(item_id, data)
    return {"message": "Target updated successfully"}

@app.delete("/api/targets/{item_id}")
def remove_target(item_id: int):
    delete_target_item(item_id)
    return {"message": "Target deleted successfully"}

@app.post("/api/targets/{item_id}/check")
async def check_target_now(item_id: int, search_mode: str = "recent", ignore_max_price: bool = False):
    target = get_target_item(item_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target item not found")
    detections = await monitor_engine.check_single_item(target, search_mode=search_mode, ignore_max_price=ignore_max_price)
    return {"message": "Check complete", "new_detections": detections, "count": len(detections)}

@app.get("/api/detections")
def list_detections(limit: int = 100, show_hidden: bool = False):
    return get_recent_detections(limit=limit, show_hidden=show_hidden)

@app.delete("/api/detections")
def clear_detections_api(preserve_saved: bool = True):
    from database import clear_all_detections as db_clear
    db_clear(preserve_saved=preserve_saved)
    return {"message": "Detections cleared (saved items preserved)"}

@app.post("/api/detections/{detection_id}/toggle_save")
def toggle_save_api(detection_id: int):
    from database import toggle_save_detection
    new_state = toggle_save_detection(detection_id)
    return {"message": "Save state toggled", "is_saved": new_state}

@app.post("/api/detections/{detection_id}/toggle_listing")
def toggle_listing_api(detection_id: int):
    from database import toggle_listing_detection
    new_state = toggle_listing_detection(detection_id)
    return {"message": "Listing state toggled", "is_listing": new_state}

@app.post("/api/detections/{detection_id}/toggle_hide")
def toggle_hide_api(detection_id: int):
    from database import toggle_hide_detection
    new_state = toggle_hide_detection(detection_id)
    return {"message": "Hide state toggled", "is_hidden": new_state}

@app.get("/api/events")
def poll_events():
    """リアルタイム通知用イベント取得（取得後にクリア）"""
    events = list(monitor_engine.last_detection_events)
    monitor_engine.last_detection_events.clear()
    return events

@app.get("/api/settings")
def get_settings():
    return get_all_settings()

@app.post("/api/settings")
def update_system_settings(settings: Dict[str, Any] = Body(...)):
    for key, val in settings.items():
        if val is not None:
            update_setting(key, str(val))
    return {"message": "Settings updated"}

# --- SaaS Multi-Tenant Users API ---
USERS_CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "users_config.json")

@app.get("/api/saas/users")
def get_saas_users():
    try:
        if os.path.exists(USERS_CONFIG_PATH):
            with open(USERS_CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {"success": True, "users": data}
    except Exception as e:
        print("[SaaS Users Get Error]:", e)
    return {"success": True, "users": []}

@app.post("/api/saas/users")
def update_saas_users(data: Dict[str, Any] = Body(...)):
    users = data.get("users", [])
    try:
        with open(USERS_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(users, f, ensure_ascii=False, indent=2)
        return {"success": True, "message": "SaaSユーザー設定を保存しました。"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- eBay 自動取り下げ API エンドポイント ---

@app.get("/api/ebay/delist-items")
def list_ebay_delist_items():
    return get_all_ebay_delist_items()

@app.post("/api/ebay/delist-items")
def add_ebay_delist_item(data: Dict[str, Any] = Body(...)):
    ebay_item_id = data.get("ebay_item_id", "").strip()
    source_url = data.get("source_url", "").strip()
    title = data.get("title", "").strip()
    delist_mode = data.get("delist_mode", "end_item")

    if not ebay_item_id or not source_url:
        raise HTTPException(status_code=400, detail="eBay Item ID と仕入れ元URLは必須です。")

    item_id = create_ebay_delist_item(ebay_item_id, source_url, title, delist_mode)
    return {"id": item_id, "message": "監視アイテムを追加しました。"}

@app.delete("/api/ebay/delist-items/{item_id}")
def remove_ebay_delist_item(item_id: int):
    delete_ebay_delist_item(item_id)
    return {"message": "監視アイテムを削除しました。"}

@app.post("/api/ebay/sync-sheets")
def trigger_sync_sheets(data: Dict[str, str] = Body(...)):
    sheet_url = data.get("google_sheet_url", "").strip()
    if not sheet_url:
        settings = get_all_settings()
        sheet_url = settings.get("google_sheet_url", "").strip()
    if not sheet_url:
        raise HTTPException(status_code=400, detail="GoogleスプレッドシートのURLを指定してください。")

    update_setting("google_sheet_url", sheet_url)
    res = sync_google_sheet(sheet_url)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "スプレッドシート同期に失敗しました。"))
    return res

@app.post("/api/ebay/delist-check-now")
async def trigger_delist_check_now():
    res = await run_auto_delist_check_now()
    return res

@app.post("/api/settings/test-discord")
async def test_discord(data: Dict[str, str] = Body(...)):
    webhook_url = data.get("webhook_url", "")
    success = await send_test_discord(webhook_url)
    if success:
        return {"success": True, "message": "Discordテスト通知を送信しました！"}
    else:
        raise HTTPException(status_code=400, detail="Discordへの送信に失敗しました。URLを確認してください。")

@app.post("/api/exchange-rate/refresh")
async def refresh_rate():
    rate = await fetch_usd_jpy_rate()
    return {"usd_jpy_rate": rate}

@app.post("/api/seed-samples")
def seed_sample_items():
    """初心者向けに売れ筋サンプルの監視アイテムを自動投入"""
    rate = get_current_usd_jpy_rate()
    samples = [
        {
            "name": "Newニンテンドー3DS LL メタリックブルー",
            "keyword": "New 3DS LL メタリックブルー",
            "platform": "all",
            "ebay_price_usd": 170.0,
            "ebay_price_jpy": round(170.0 * rate, 0),
            "target_discount_pct": 25.0,
            "max_buy_price_jpy": 18000.0,
            "est_shipping_jpy": 2200.0,
            "min_profit_jpy": 4000.0,
            "exclude_keywords": "ジャンク,故障,不動,部品取り,箱のみ,写真のみ,画面割れ",
            "check_interval_seconds": 60,
            "is_active": 1
        },
        {
            "name": "PlayStation Vita PCH-2000 アクアブルー",
            "keyword": "PS Vita 2000 アクアブルー",
            "platform": "all",
            "ebay_price_usd": 150.0,
            "ebay_price_jpy": round(150.0 * rate, 0),
            "target_discount_pct": 20.0,
            "max_buy_price_jpy": 16000.0,
            "est_shipping_jpy": 2000.0,
            "min_profit_jpy": 3000.0,
            "exclude_keywords": "ジャンク,故障,不動,部品取り,箱のみ,スティック不良",
            "check_interval_seconds": 60,
            "is_active": 1
        },
        {
            "name": "Canon IXY 650 デジタルカメラ",
            "keyword": "Canon IXY 650",
            "platform": "all",
            "ebay_price_usd": 240.0,
            "ebay_price_jpy": round(240.0 * rate, 0),
            "target_discount_pct": 25.0,
            "max_buy_price_jpy": 25000.0,
            "est_shipping_jpy": 2500.0,
            "min_profit_jpy": 6000.0,
            "exclude_keywords": "ジャンク,不動,レンズカビ,くもり,バッテリーなし,箱のみ",
            "check_interval_seconds": 60,
            "is_active": 1
        }
    ]
    for s in samples:
        create_target_item(s)
    return {"message": "サンプル商品を3件追加しました"}

# フロントエンド静的ファイルのルーティング
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
os.makedirs(FRONTEND_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/")
def serve_index():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"})
    return {"message": "Frontend not found"}

if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
