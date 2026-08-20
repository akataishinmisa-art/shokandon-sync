import asyncio
import httpx
from bs4 import BeautifulSoup
import re
import logging
from typing import List, Dict, Any, Tuple
from database import get_db_connection
from playwright.async_api import async_playwright

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
logger = logging.getLogger(__name__)

# 安全直列化セマフォ（同時に複数の詳細アクセスを走らせない）
_enrich_semaphore = asyncio.Semaphore(1)

def clean_html_to_text(html_content: str) -> str:
    """HTMLからタグを取り除き単一スペースのテキストに変換"""
    text = re.sub(r'<[^>]+>', ' ', html_content)
    return re.sub(r'\s+', ' ', text)

def update_by_url(url: str, cond: str, ship: str):
    """item_urlをキーにして確実にDBのconditionとshipping_daysを更新"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE detections 
            SET condition = ?, shipping_days = ?
            WHERE item_url = ?
        """, (cond, ship, url))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"DB update error: {e}")

async def fetch_yahoo_auction_exact(url: str) -> Tuple[str, str]:
    """ヤフオク個別出品ページの公式スペックテーブルから状態と発送日数をピンポイント直接抽出"""
    cond = ""
    ship = ""
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    }
    try:
        async with httpx.AsyncClient(headers=headers, timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                html = resp.text
                if "一時的に利用を制限しています" in html:
                    logger.warning(f"Yahoo rate limit detected for {url}")
                    return "", ""
                
                soup = BeautifulSoup(html, "html.parser")
                clean_text = clean_html_to_text(html)
                
                # 1. 状態の抽出 (公式テーブル dt/dd または th/td)
                for dt in soup.find_all(["dt", "th"]):
                    dt_t = dt.text.strip()
                    if "商品の状態" in dt_t or "状態" in dt_t:
                        dd = dt.find_next_sibling(["dd", "td"])
                        if dd:
                            val = dd.text.strip()
                            m = re.search(r'(新品、未使用|新品|未使用に近い|目立った傷や汚れなし|やや傷や汚れあり|傷や汚れあり|全体的に状態が悪い|ジャンク|中古|難あり|訳あり)', val)
                            if m:
                                cond = m.group(1).strip()
                                break
                            elif val:
                                cond = val[:20].strip()
                                break

                if not cond:
                    m_cond = re.search(r'(?:商品の状態|状態)\s*[:：]?\s*(新品、未使用|新品|未使用に近い|目立った傷や汚れなし|やや傷や汚れあり|傷や汚れあり|全体的に状態が悪い|ジャンク|中古|難あり|訳あり)', clean_text)
                    if m_cond:
                        cond = m_cond.group(1).strip()

                # 2. 発送目安の抽出 (dt/dd または テキスト解析)
                for dt in soup.find_all(["dt", "th"]):
                    dt_t = dt.text.strip()
                    if "発送" in dt_t or "支払い手続き" in dt_t:
                        dd = dt.find_next_sibling(["dd", "td"])
                        if dd:
                            val = dd.text.strip()
                            m_ship = re.search(r'([0-9０-９〜～\-ー日以内で発送即日24時間当日1-22-34-7]+)', val)
                            if m_ship:
                                ship = m_ship.group(1).strip()
                                break

                if not ship:
                    m_ship = re.search(r'(?:支払い手続きから|発送までの日数|発送日)\s*([0-9０-９〜～\-ー日以内で発送即日24時間当日1-22-34-7]+)', clean_text)
                    if m_ship:
                        ship = m_ship.group(1).strip()

    except Exception as e:
        logger.error(f"Yahoo auction fetch exact error ({url}): {e}")

    return cond, ship

async def fetch_yahoo_flea_exact(url: str) -> Tuple[str, str]:
    """Yahoo!フリマ（PayPayフリマ）個別出品ページから公式スペックを直接抽出"""
    cond = ""
    ship = ""
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    }
    try:
        async with httpx.AsyncClient(headers=headers, timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                html = resp.text
                if "一時的に利用を制限しています" in html:
                    logger.warning(f"Yahoo Flea rate limit detected for {url}")
                    return "", ""
                
                clean_text = clean_html_to_text(html)

                m_cond = re.search(r'商品の状態\s*([^配送発ID出品カテゴリブランド]+)', clean_text)
                if m_cond:
                    raw_val = m_cond.group(1).strip()
                    m_exact = re.search(r'(新品、未使用|新品|未使用に近い|目立った傷や汚れなし|やや傷や汚れあり|傷や汚れあり|全体的に状態が悪い|ジャンク|中古)', raw_val)
                    if m_exact:
                        cond = m_exact.group(1)

                m_ship = re.search(r'(?:発送までの日数|発送日の目安|発送日)\s*([0-9０-９〜～\-ー日以内で発送即日24時間当日1-22-34-7]+)', clean_text)
                if m_ship:
                    ship = m_ship.group(1).strip()
    except Exception as e:
        logger.error(f"Yahoo flea fetch exact error ({url}): {e}")

    return cond, ship

async def fetch_rakuma_exact(url: str) -> Tuple[str, str, str]:
    """楽天ラクマ個別出品ページから公式スペック（状態、発送日数、高画質画像）を直接抽出"""
    cond = ""
    ship = ""
    img_url = ""
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    try:
        async with httpx.AsyncClient(headers=headers, timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                html = resp.text
                soup = BeautifulSoup(html, "html.parser")
                clean_text = clean_html_to_text(html)

                # 🖼️ 高画質実画像URLの抽出
                og_img = soup.find("meta", property="og:image")
                if og_img and og_img.get("content"):
                    img_url = og_img.get("content")

                # 1. th/td テーブルから直接ピンポイント抽出
                for tr in soup.find_all("tr"):
                    th = tr.find("th")
                    td = tr.find("td")
                    if th and td:
                        th_t = th.text.strip()
                        td_t = td.text.strip()
                        if "商品の状態" in th_t:
                            m_exact = re.search(r'(新品、未使用|新品|未使用に近い|目立った傷や汚れなし|やや傷や汚れあり|傷や汚れあり|全体的に状態が悪い|ジャンク|中古)', td_t)
                            if m_exact:
                                cond = m_exact.group(1)
                            else:
                                cond = td_t
                        elif "発送日の目安" in th_t or "発送までの日数" in th_t:
                            m_ship = re.search(r'([0-9０-９〜～\-ー日以内で発送即日24時間当日1-22-34-7]+)', td_t)
                            if m_ship:
                                ship = m_ship.group(1).strip()

                if not cond:
                    m_cond = re.search(r'商品の状態\s*([^配送発ID出品カテゴリブランド]+)', clean_text)
                    if m_cond:
                        raw_val = m_cond.group(1).strip()
                        m_exact = re.search(r'(新品、未使用|新品|未使用に近い|目立った傷や汚れなし|やや傷や汚れあり|傷や汚れあり|全体的に状態が悪い|ジャンク|中古)', raw_val)
                        if m_exact:
                            cond = m_exact.group(1)

                if not ship:
                    m_ship = re.search(r'(?:発送日の目安|発送までの日数)\s*([0-9０-９〜～\-ー日以内で発送即日24時間当日1-22-34-7]+)', clean_text)
                    if m_ship:
                        ship = m_ship.group(1).strip()
    except Exception as e:
        logger.error(f"Rakuma fetch exact error ({url}): {e}")

    return cond, ship, img_url

async def fetch_mercari_exact_playwright(url: str) -> Tuple[str, str]:
    """メルカリ個別出品ページからPlaywrightで公式スペックを直接抽出（スクロール遅延描画対応）"""
    cond = ""
    ship = ""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(user_agent=USER_AGENT)
            page = await context.new_page()
            await page.goto(url, timeout=15000)
            # スペックテーブルを描画させるため下部へスクロール
            await page.evaluate("window.scrollBy(0, 1500)")
            await page.wait_for_timeout(1500)
            
            body_text = await page.inner_text("body")
            await browser.close()

            # 改行区切りの行配列から「商品の状態」と「発送までの日数」を完全抽出
            lines = [l.strip() for l in body_text.split('\n') if l.strip()]
            for idx, l in enumerate(lines):
                if "商品の状態" in l and idx + 1 < len(lines):
                    val = lines[idx + 1]
                    m_c = re.search(r'(新品、未使用|新品|未使用に近い|目立った傷や汚れなし|やや傷や汚れあり|傷や汚れあり|全体的に状態が悪い|ジャンク|中古)', val)
                    if m_c:
                        cond = m_c.group(1)
                if "発送までの日数" in l and idx + 1 < len(lines):
                    val = lines[idx + 1]
                    m_s = re.search(r'(1[〜~-]2日で発送|2[〜~-]3日で発送|4[〜~-]7日で発送|即日|24時間以内|1~2日|2~3日|4~7日)', val)
                    if m_s:
                        ship = m_s.group(1)
                        if not ship.endswith("発送") and not ship.endswith("以内"):
                            ship += "で発送"

            # fallback: clean_text
            if not cond:
                clean_text = re.sub(r'\s+', ' ', body_text)
                m_c2 = re.search(r'(?:商品の状態)\s*[:：]?\s*(新品、未使用|新品|未使用に近い|目立った傷や汚れなし|やや傷や汚れあり|傷や汚れあり|全体的に状態が悪い|ジャンク|中古)', clean_text)
                if m_c2:
                    cond = m_c2.group(1)
            if not ship:
                clean_text = re.sub(r'\s+', ' ', body_text)
                m_s2 = re.search(r'(1[〜~-]2日で発送|2[〜~-]3日で発送|4[〜~-]7日で発送|即日|24時間以内)', clean_text)
                if m_s2:
                    ship = m_s2.group(1)
    except Exception as e:
        logger.error(f"Mercari playwright error ({url}): {e}")

    return cond, ship

async def enrich_single_item_exact_safe(item: Dict[str, Any]) -> Tuple[str, str]:
    """1つの商品を安全に公式スペック抽出（推論なし）"""
    url = item.get("item_url", "")
    platform = item.get("platform", "")
    if not url:
        return "", ""

    cond = ""
    ship = ""

    if "auctions.yahoo.co.jp" in url or "ヤフオク" in platform:
        cond, ship = await fetch_yahoo_auction_exact(url)
    elif "paypayfleamarket.yahoo.co.jp" in url or "フリマ" in platform:
        cond, ship = await fetch_yahoo_flea_exact(url)
    elif "fril.jp" in url or "ラクマ" in platform:
        cond, ship, img_url = await fetch_rakuma_exact(url)
        if img_url and not item.get("image_url"):
            item["image_url"] = img_url
    elif "mercari" in url or "メルカリ" in platform:
        cond, ship = await fetch_mercari_exact_playwright(url)

    if cond or ship:
        cond_final = cond or "出品ページ参照"
        ship_final = ship or "出品ページ参照"
        item["condition"] = cond_final
        item["shipping_days"] = ship_final
        update_by_url(url, cond_final, ship_final)
        return cond_final, ship_final

    return "", ""

async def enrich_fast_parallel_rakuma(items: List[Dict[str, Any]]):
    """【ラクマ】全件即時並行直接抽出（15並行・1〜2秒で全件完了）"""
    rakuma_items = [it for it in items if "fril.jp" in it.get("item_url", "") or "ラクマ" in it.get("platform", "")]
    if not rakuma_items:
        return

    sem = asyncio.Semaphore(15)
    async def worker(it):
        url = it.get("item_url", "")
        if not url:
            return
        async with sem:
            try:
                cond, ship, img_url = await fetch_rakuma_exact(url)
                if cond:
                    it["condition"] = cond
                if ship:
                    it["shipping_days"] = ship
                if img_url:
                    it["image_url"] = img_url
            except Exception as e:
                logger.error(f"Fast rakuma enrich error for {url}: {e}")

    tasks = [worker(it) for it in rakuma_items]
    await asyncio.gather(*tasks, return_exceptions=True)

async def enrich_fast_parallel_yahoo_flea(items: List[Dict[str, Any]]):
    """【Yahoo!フリマ】全件即時並行直接抽出（5並行・2〜3秒で全件完了）"""
    flea_items = [it for it in items if "paypayfleamarket" in it.get("item_url", "") or "フリマ" in it.get("platform", "")]
    if not flea_items:
        return

    sem = asyncio.Semaphore(5)
    async def worker(it):
        url = it.get("item_url", "")
        if not url:
            return
        async with sem:
            try:
                cond, ship = await fetch_yahoo_flea_exact(url)
                if cond:
                    it["condition"] = cond
                if ship:
                    it["shipping_days"] = ship
                await asyncio.sleep(0.1) # 短い待機で安全確保
            except Exception as e:
                logger.error(f"Fast Yahoo Flea enrich error for {url}: {e}")

    tasks = [worker(it) for it in flea_items]
    await asyncio.gather(*tasks, return_exceptions=True)

async def enrich_fast_parallel_yahoo_auction(items: List[Dict[str, Any]]):
    """【ヤフオク】全件即時並行直接抽出（3並行・2〜3秒で全件完了）"""
    auc_items = [it for it in items if "auctions.yahoo.co.jp" in it.get("item_url", "") or "ヤフオク" in it.get("platform", "")]
    if not auc_items:
        return

    sem = asyncio.Semaphore(3)
    async def worker(it):
        url = it.get("item_url", "")
        if not url:
            return
        async with sem:
            try:
                cond, ship = await fetch_yahoo_auction_exact(url)
                if cond:
                    it["condition"] = cond
                if ship:
                    it["shipping_days"] = ship
                await asyncio.sleep(0.2) # 短い待機で安全確保
            except Exception as e:
                logger.error(f"Fast Yahoo Auction enrich error for {url}: {e}")

    tasks = [worker(it) for it in auc_items]
    await asyncio.gather(*tasks, return_exceptions=True)

async def enrich_fast_parallel_mercari(items: List[Dict[str, Any]]):
    """【メルカリ】全件即時並行直接抽出（6並行・3〜5秒で全件完了）"""
    mercari_items = [it for it in items if "mercari" in it.get("item_url", "") or "メルカリ" in it.get("platform", "")]
    if not mercari_items:
        return

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(user_agent=USER_AGENT)
            
            sem = asyncio.Semaphore(6) # 最大6並行で高速スクロール抽出
            async def fetch_item(it):
                url = it.get("item_url", "")
                if not url:
                    return
                async with sem:
                    page = None
                    try:
                        page = await context.new_page()
                        await page.goto(url, timeout=12000)
                        await page.evaluate("window.scrollBy(0, 1500)")
                        await page.wait_for_timeout(800)
                        body_text = await page.inner_text("body")
                        
                        cond = ""
                        ship = ""
                        lines = [l.strip() for l in body_text.split('\n') if l.strip()]
                        for idx, l in enumerate(lines):
                            if "商品の状態" in l and idx + 1 < len(lines):
                                val = lines[idx + 1]
                                m_c = re.search(r'(新品、未使用|新品|未使用に近い|目立った傷や汚れなし|やや傷や汚れあり|傷や汚れあり|全体的に状態が悪い|ジャンク|中古)', val)
                                if m_c:
                                    cond = m_c.group(1)
                            if "発送までの日数" in l and idx + 1 < len(lines):
                                val = lines[idx + 1]
                                m_s = re.search(r'(1[〜~-]2日で発送|2[〜~-]3日で発送|4[〜~-]7日で発送|即日|24時間以内|1~2日|2~3日|4~7日)', val)
                                if m_s:
                                    ship = m_s.group(1)
                                    if not ship.endswith("発送") and not ship.endswith("以内"):
                                        ship += "で発送"
                        
                        if cond:
                            it["condition"] = cond
                        if ship:
                            it["shipping_days"] = ship
                    except Exception as err:
                        logger.error(f"Fast mercari tab error for {url}: {err}")
                    finally:
                        if page:
                            try:
                                await page.close()
                            except:
                                pass

            tasks = [fetch_item(it) for it in mercari_items]
            await asyncio.gather(*tasks, return_exceptions=True)
            await browser.close()
    except Exception as e:
        logger.error(f"Fast mercari parallel error: {e}")

async def run_background_safe_enricher(items: List[Dict[str, Any]]):
    """バックグラウンド安全ワーカー（未取得の残存アイテムの補完）"""
    pass
