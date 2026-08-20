import httpx
from bs4 import BeautifulSoup
import re
import asyncio
import logging

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
logger = logging.getLogger(__name__)

async def fetch_exact_shipping_detail(url: str, platform: str) -> str:
    """【説明文からの推測排除】添付画像の公式「商品の情報」スペックテーブルから「発送までの日数」のみ直接ピンポイント抽出"""
    try:
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=6.0, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return "未取得"
            
            text = resp.text
            clean_text = re.sub(r'<[^>]+>', ' ', text)
            clean_text = re.sub(r'\s+', ' ', clean_text)

            m_ship = re.search(r'(?:発送までの日数|発送日の目安|発送日)\s*([0-9０-９〜～\-ー日以内で発送即日24時間当日1-22-34-7]+)', clean_text)
            if m_ship:
                return m_ship.group(1).strip()

    except Exception as e:
        logger.error(f"Error fetching exact shipping for {url}: {e}")

    return "未取得"
