import httpx
from bs4 import BeautifulSoup
import re
import asyncio
import logging

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
logger = logging.getLogger(__name__)

def clean_html_to_text(html_content: str) -> str:
    """HTMLからタグを取り除き単一スペースのテキストに変換"""
    text = re.sub(r'<[^>]+>', ' ', html_content)
    return re.sub(r'\s+', ' ', text)

async def fetch_mercari_detail_playwright(url: str):
    """メルカリ / メルカリShopsの公式「商品の情報」仕様テーブルからピンポイント抽出"""
    condition = "出品ページ参照"
    shipping = "出品ページ参照"
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto(url, wait_until="domcontentloaded", timeout=12000)
            await page.wait_for_timeout(1500)
            
            body_text = await page.inner_text("body")
            await browser.close()

            clean_text = re.sub(r'\s+', ' ', body_text)
            
            # 公式スペックテーブル「商品の状態」ピンポイント抽出
            m_cond = re.search(r'商品の状態\s*([^配送発ID出品]+)', clean_text)
            if m_cond:
                val = m_cond.group(1).strip()
                m_exact = re.search(r'(新品、未使用|新品|未使用に近い|目立った傷や汚れなし|やや傷や汚れあり|傷や汚れあり|全体的に状態が悪い)', val)
                if m_exact:
                    condition = m_exact.group(1)

            # 公式スペックテーブル「発送までの日数」ピンポイント抽出
            m_ship = re.search(r'発送までの日数\s*([0-9０-９〜～\-ー日以内で発送即日24時間当日1-22-34-7]+)', clean_text)
            if m_ship:
                shipping = m_ship.group(1).strip()

    except Exception as e:
        logger.error(f"Mercari detail playwright error: {e}")

    return condition, shipping

async def fetch_exact_item_details(url: str, platform: str):
    """【説明文からの推測排除】添付画像の公式「商品の情報」スペックテーブルから直接ピンポイント抽出"""
    condition = "出品ページ参照"
    shipping = "出品ページ参照"
    
    try:
        # 1. メルカリ / メルカリShops
        if "mercari" in url or "メルカリ" in platform:
            return await fetch_mercari_detail_playwright(url)

        # 2. Yahoo!フリマ / ヤフオク / 楽天ラクマ (高速httpx)
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=7.0, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                html = resp.text
                clean_text = clean_html_to_text(html)

                # 公式スペックテーブル「商品の状態」のピンポイント抽出
                m_cond = re.search(r'商品の状態\s*([^配送発ID出品カテゴリブランド]+)', clean_text)
                if m_cond:
                    raw_val = m_cond.group(1).strip()
                    m_exact = re.search(r'(新品、未使用|新品|未使用に近い|目立った傷や汚れなし|やや傷や汚れあり|傷や汚れあり|全体的に状態が悪い|ジャンク|中古)', raw_val)
                    if m_exact:
                        condition = m_exact.group(1)
                    else:
                        condition = raw_val[:20].strip()

                # 公式スペックテーブル「発送までの日数 / 発送日の目安」のピンポイント抽出
                m_ship = re.search(r'(?:発送までの日数|発送日の目安|発送日)\s*([0-9０-９〜～\-ー日以内で発送即日24時間当日1-22-34-7]+)', clean_text)
                if m_ship:
                    shipping = m_ship.group(1).strip()

    except Exception as e:
        logger.error(f"Error fetching exact details for {url}: {e}")

    return condition, shipping
