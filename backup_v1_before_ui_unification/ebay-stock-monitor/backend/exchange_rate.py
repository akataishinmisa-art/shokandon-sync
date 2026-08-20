import httpx
import logging
from typing import Optional
from database import get_all_settings, update_setting

logger = logging.getLogger(__name__)

async def fetch_usd_jpy_rate() -> float:
    """無料のオープン為替APIからUSD/JPYレートを取得し、DBを更新する"""
    settings = get_all_settings()
    fallback_rate = float(settings.get("usd_jpy_rate", "155.0"))
    
    # open.er-api.com (無料・キー不要・高安定)
    url = "https://open.er-api.com/v6/latest/USD"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                rates = data.get("rates", {})
                jpy_rate = rates.get("JPY")
                if jpy_rate and isinstance(jpy_rate, (int, float)):
                    rate_val = round(float(jpy_rate), 2)
                    update_setting("usd_jpy_rate", str(rate_val))
                    return rate_val
    except Exception as e:
        logger.warning(f"Failed to fetch live exchange rate: {e}")
        
    # フォールバック (frankfurter)
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get("https://api.frankfurter.app/latest?from=USD&to=JPY")
            if resp.status_code == 200:
                data = resp.json()
                jpy_rate = data.get("rates", {}).get("JPY")
                if jpy_rate:
                    rate_val = round(float(jpy_rate), 2)
                    update_setting("usd_jpy_rate", str(rate_val))
                    return rate_val
    except Exception as e:
        logger.warning(f"Failed fallback exchange rate: {e}")
        
    return fallback_rate

def get_current_usd_jpy_rate() -> float:
    settings = get_all_settings()
    try:
        return float(settings.get("usd_jpy_rate", "155.0"))
    except:
        return 155.0
