import httpx
import logging
from typing import Dict, Any, Optional
from database import get_all_settings

logger = logging.getLogger(__name__)

async def send_discord_notification(detection: Dict[str, Any], webhook_url: Optional[str] = None) -> bool:
    """Discord Webhookに写真・利益付きのリッチなEmbedカードを送信する"""
    settings = get_all_settings()
    url = webhook_url or settings.get("discord_webhook_url", "").strip()
    
    if not url:
        return False
        
    title = detection.get("title", "商品名未設定")
    price = int(detection.get("price_jpy", 0))
    ebay_price = int(detection.get("ebay_price_jpy", 0))
    discount_pct = float(detection.get("discount_pct", 0.0))
    profit = int(detection.get("est_profit_jpy", 0))
    item_url = detection.get("item_url", "")
    image_url = detection.get("image_url", "")
    platform = detection.get("platform", "国内フリマ").capitalize()
    condition = detection.get("condition", "記載なし")
    target_name = detection.get("target_name") or detection.get("name", "監視対象")

    # Discord Embed Payload
    embed = {
        "title": f"🔥 【仕入れチャンス検知】{target_name}",
        "description": f"**[{title}]({item_url})**\n\neBay相場より **{discount_pct:.1f}% OFF** で出品されました！",
        "url": item_url,
        "color": 3066993, # エメラルドグリーン
        "fields": [
            {
                "name": "💰 国内出品価格",
                "value": f"**¥{price:,}**",
                "inline": True
            },
            {
                "name": "🌐 eBay販売相場",
                "value": f"¥{ebay_price:,}",
                "inline": True
            },
            {
                "name": "💵 見込み純利益 (概算)",
                "value": f"**+¥{profit:,}**",
                "inline": True
            },
            {
                "name": "📦 プラットフォーム",
                "value": f"{platform}",
                "inline": True
            },
            {
                "name": "🏷️ 状態 / コンディション",
                "value": f"{condition}",
                "inline": True
            },
            {
                "name": "📈 割引率",
                "value": f"**{discount_pct:.1f}% OFF**",
                "inline": True
            }
        ],
        "footer": {
            "text": "eBay Arbitrage Hunter | 自動仕入れ監視"
        }
    }
    
    if image_url:
        embed["image"] = {"url": image_url}
        embed["thumbnail"] = {"url": image_url}

    payload = {
        "content": f"🚨 **【2割安以上】仕入れ対象の商品が出品されました！**\n<{item_url}>",
        "embeds": [embed]
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code in [200, 204]:
                return True
            else:
                logger.error(f"Discord notification failed: {resp.status_code} {resp.text}")
                return False
    except Exception as e:
        logger.error(f"Discord error: {e}")
        return False

async def send_test_discord(webhook_url: str) -> bool:
    """Discord通知のテスト送信"""
    test_detection = {
        "title": "【テスト商品】Nintendo Switch Lite ターコイズ 美品",
        "price_jpy": 12000,
        "ebay_price_jpy": 22000,
        "discount_pct": 45.5,
        "est_profit_jpy": 6300,
        "item_url": "https://example.com/test-item",
        "image_url": "https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?w=500&auto=format&fit=crop",
        "platform": "メルカリ",
        "condition": "目立った傷や汚れなし",
        "target_name": "Switch Lite テスト監視"
    }
    return await send_discord_notification(test_detection, webhook_url=webhook_url)

async def send_discord_delist_notification(ebay_item_id: str, source_url: str, title: str = "", message: str = "") -> bool:
    """eBay自動取り下げ完了の通知を送信"""
    settings = get_all_settings()
    url = settings.get("discord_webhook_url", "").strip()
    if not url:
        return False

    embed = {
        "title": f"🛑 【eBay自動取り下げ完了】",
        "description": f"仕入れ元（フリマ/EC）での売り切れ・削除を検知したため、eBayの出品を自動取り下げ（End Item）しました。",
        "color": 15158332, # 赤色
        "fields": [
            {
                "name": "🆔 eBay Item ID",
                "value": f"`{ebay_item_id}`",
                "inline": True
            },
            {
                "name": "📦 商品名",
                "value": title or "なし",
                "inline": False
            },
            {
                "name": "🔗 仕入れ元URL",
                "value": source_url,
                "inline": False
            },
            {
                "name": "ℹ️ 処理詳細",
                "value": message or "EndFixedPriceItem 成功",
                "inline": False
            }
        ],
        "footer": {
            "text": "eBay Arbitrage Hunter | 自動取り下げシステム"
        }
    }

    payload = {
        "content": f"⚠️ **eBayの出品が自動取り下げされました！** (Item ID: `{ebay_item_id}`)",
        "embeds": [embed]
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            return resp.status_code in [200, 204]
    except Exception as e:
        logger.error(f"Discord delist notification error: {e}")
        return False

