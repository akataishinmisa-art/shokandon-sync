import httpx
from bs4 import BeautifulSoup
import re
import asyncio
import logging

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
logger = logging.getLogger(__name__)

async def fetch_exact_condition(url: str, platform: str) -> str:
    """【説明文からの推測排除】添付画像の公式「商品の情報」スペックテーブルから「商品の状態」のみ直接ピンポイント抽出"""
    try:
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=6.0, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return "出品ページ参照"
            
            text = resp.text
            clean_text = re.sub(r'<[^>]+>', ' ', text)
            clean_text = re.sub(r'\s+', ' ', clean_text)

            m_cond = re.search(r'商品の状態\s*([^配送発ID出品カテゴリブランド]+)', clean_text)
            if m_cond:
                raw_val = m_cond.group(1).strip()
                m_exact = re.search(r'(新品、未使用|新品|未使用に近い|目立った傷や汚れなし|やや傷や汚れあり|傷や汚れあり|全体的に状態が悪い|ジャンク|中古)', raw_val)
                if m_exact:
                    return m_exact.group(1)
                return raw_val[:20].strip()

    except Exception as e:
        logger.error(f"Error fetching exact condition for {url}: {e}")

    return "出品ページ参照"
