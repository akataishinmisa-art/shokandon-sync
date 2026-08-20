import httpx
import re
import urllib.parse
import logging
import asyncio
from bs4 import BeautifulSoup
from typing import List, Dict, Any
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

class ScraperManager:
    """各プラットフォームの新着・出品中検索スクレイパー"""
    
    @staticmethod
    async def search_all(keyword: str, max_price: float = 0.0, min_price: float = 0.0, platform: str = "all", search_mode: str = "recent") -> List[Dict[str, Any]]:
        results = []
        
        # 4モール（メルカリ・ヤフーフリマ・ヤフオク・ラクマ）を完全並列（パラレル）同時スクレイピングで爆速化！(25秒 -> 3〜5秒)
        tasks = [
            ScraperManager.search_mercari_playwright(keyword, max_price, min_price, search_mode=search_mode),
            ScraperManager.search_yahoo_fleamarket(keyword, max_price, min_price, search_mode=search_mode),
            ScraperManager.search_yahoo_auction(keyword, max_price, min_price, search_mode=search_mode),
            ScraperManager.search_rakuma(keyword, max_price, min_price, search_mode=search_mode)
        ]
        
        task_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for idx, res in enumerate(task_results):
            if isinstance(res, list):
                results.extend(res)
            elif isinstance(res, Exception):
                logger.error(f"Parallel scrape error on task {idx}: {res}")

        # 重複削除 (URL一意)
        seen_urls = set()
        unique_results = []
        for r in results:
            if r["item_url"] not in seen_urls:
                seen_urls.add(r["item_url"])
                unique_results.append(r)
                
        return unique_results

    @staticmethod
    async def search_mercari_playwright(keyword: str, max_price: float = 0.0, min_price: float = 0.0, search_mode: str = "recent") -> List[Dict[str, Any]]:
        """メルカリ検索 (Playwright)"""
        clean_kw = re.sub(r'\s+', ' ', keyword).strip()
        encoded_kw = urllib.parse.quote(clean_kw)
        # 全体検索（または商品全検索）時はおすすめ順（全期間の適合商品）
        sort_param = "&sort=created_time&order=desc" if search_mode == "recent" else ""
        url = f"https://jp.mercari.com/search?keyword={encoded_kw}&status=on_sale{sort_param}"
        if max_price > 0:
            url += f"&price_max={int(max_price)}"
        if min_price > 0:
            url += f"&price_min={int(min_price)}"

        results = []
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(user_agent=USER_AGENT)
            page = await context.new_page()
            
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                await page.wait_for_selector("li[data-testid='item-cell'], a[href*='/item/m']", timeout=10000)
                await page.evaluate("window.scrollBy(0, 1000)")
                await asyncio.sleep(0.5)
            except Exception as e:
                logger.warning(f"Mercari selector wait notice: {e}")

            items_raw = await page.eval_on_selector_all("li[data-testid='item-cell'], a[href*='/item/m']", """elements => {
                return elements.map(el => {
                    const a = el.tagName.toLowerCase() === 'a' ? el : el.querySelector('a');
                    const img = el.querySelector('img');
                    return {
                        url: a ? a.href : '',
                        title: (a && a.getAttribute('aria-label')) ? a.getAttribute('aria-label').replace('のサムネイル', '').trim() : (img ? img.alt.replace('のサムネイル', '').trim() : ''),
                        image_url: img ? img.src : '',
                        raw_text: el.innerText
                    };
                });
            }""")
            
            await browser.close()

            for it in items_raw:
                url_clean = it.get("url", "")
                title = it.get("title", "")
                img_url = it.get("image_url", "")
                raw = it.get("raw_text", "")
                
                # 価格パース
                p_match = re.search(r'[¥\￥]?\s*([0-9,]+)', raw)
                price = int(p_match.group(1).replace(',', '')) if p_match else 0
                
                # 発送日数の抽出
                shipping_days = "---------"
                if "即日" in raw or "即日" in title or "24時間" in raw or "24時間" in title or "24h" in raw:
                    shipping_days = "⚡ 即日〜24h以内"
                elif "1~2日" in raw or "1〜2日" in raw or "1～2日" in raw:
                    shipping_days = "🚚 1〜2日で発送"
                elif "2~3日" in raw or "2〜3日" in raw or "2～3日" in raw:
                    shipping_days = "🚚 2〜3日で発送"
                elif "4~7日" in raw or "4〜7日" in raw or "4～7日" in raw:
                    shipping_days = "⚠️ 4〜7日で発送"

                # メルカリは固定価格フリマ
                is_auction = False

                if url_clean and price > 0:
                    if min_price > 0 and price < min_price:
                        continue
                    if max_price > 0 and price > max_price:
                        continue
                    results.append({
                        "title": title or keyword,
                        "price_jpy": float(price),
                        "item_url": url_clean,
                        "image_url": img_url,
                        "platform": "メルカリ",
                        "condition": "",
                        "shipping_days": shipping_days if shipping_days != "---------" else "",
                        "is_auction": is_auction
                    })
                    if len(results) >= 40:
                        break
                    
        return results[:40]

    @staticmethod
    async def search_yahoo_fleamarket(keyword: str, max_price: float = 0.0, min_price: float = 0.0, search_mode: str = "recent") -> List[Dict[str, Any]]:
        """Yahoo!フリマ検索 (直近: -openTime / 全体: -price 高い順)"""
        clean_kw = re.sub(r'\s+', ' ', keyword).strip()
        encoded_kw = urllib.parse.quote(clean_kw)
        sort_val = "-openTime" if search_mode == "recent" else "-price"
        # 💡 Yahoo!フリマ公式の「新品、未使用」「未使用に近い」「目立った傷や汚れなし」限定絞り込み
        url = f"https://paypayfleamarket.yahoo.co.jp/search/{encoded_kw}?open=1&sort={sort_val}&conditions=NEW,UNUSED,USED10"
        if max_price > 0:
            url += f"&priceMax={int(max_price)}"
        if min_price > 0:
            url += f"&priceMin={int(min_price)}"

        results = []
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
            "Referer": "https://paypayfleamarket.yahoo.co.jp/",
            "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin"
        }
        try:
            async with httpx.AsyncClient(headers=headers, timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    return results

                soup = BeautifulSoup(resp.text, "html.parser")
                items = soup.find_all("a", href=re.compile(r"/item/"))
                for a in items:
                    href = a.get("href", "")
                    full_url = f"https://paypayfleamarket.yahoo.co.jp{href}" if href.startswith("/") else href
                    img = a.find("img")
                    title = img.get("alt", "") if img else a.text.strip()
                    img_url = img.get("src", "") if img else ""
                    text = a.text.replace(",", "")
                    price_match = re.search(r'(\d+)\s*円', text)
                    price = int(price_match.group(1)) if price_match else 0

                    if full_url and price > 0:
                        if min_price > 0 and price < min_price:
                            continue
                        if max_price > 0 and price > max_price:
                            continue
                        results.append({
                            "title": title or keyword,
                            "price_jpy": price,
                            "item_url": full_url,
                            "image_url": img_url,
                            "platform": "Yahoo!フリマ",
                            "seller_name": "",
                            "condition": "",
                            "shipping_days": "",
                            "is_auction": False
                        })
        except Exception as e:
            logger.error(f"Yahoo Fleamarket error: {e}")
        return results[:25]

    @staticmethod
    async def search_yahoo_auction(keyword: str, max_price: float = 0.0, min_price: float = 0.0, search_mode: str = "recent") -> List[Dict[str, Any]]:
        """ヤフオク検索 (直近: s1=new / 全体: s1=cb 高い順)"""
        clean_kw = re.sub(r'\s+', ' ', keyword).strip()
        encoded_kw = urllib.parse.quote(clean_kw)
        sort_param = "s1=new&o1=d" if search_mode == "recent" else "s1=bidorbuyprice&o1=d"
        # 💡 ヤフオク公式の「未使用」「未使用に近い」「目立った傷や汚れなし」限定絞り込み (istatus=1,3,4)
        url = f"https://auctions.yahoo.co.jp/search/search?p={encoded_kw}&va={encoded_kw}&is_postage_mode=1&dest_pref_code=13&exflg=1&b=1&n=50&istatus=1,3,4&{sort_param}"
        if max_price > 0:
            url += f"&max={int(max_price)}"
        if min_price > 0:
            url += f"&min={int(min_price)}"

        results = []
        try:
            async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    return results

                soup = BeautifulSoup(resp.text, "html.parser")
                items = soup.find_all("li", class_=re.compile(r"Product"))
                for it in items:
                    title_a = it.find("a", class_=re.compile(r"Product__titleLink|Product__title"))
                    if not title_a:
                        continue
                    title = title_a.text.strip()
                    item_url = title_a.get("href", "")
                    img = it.find("img")
                    img_url = img.get("src", "") if img else ""

                    # ヤフオクの価格抽出（即決価格と現在価格）
                    buynow_price = 0
                    current_price = 0

                    bonus_div = it.find(class_=re.compile(r"Product__bonus"))
                    if bonus_div:
                        bn_attr = bonus_div.get("data-auction-buynowprice")
                        pr_attr = bonus_div.get("data-auction-price")
                        if bn_attr and bn_attr.isdigit():
                            buynow_price = int(bn_attr)
                        if pr_attr and pr_attr.isdigit():
                            current_price = int(pr_attr)

                    # DOMからの価格フォールバック
                    if buynow_price == 0 or current_price == 0:
                        for p_block in it.find_all(class_=re.compile(r"Product__price")):
                            label_el = p_block.find(class_=re.compile(r"Product__label"))
                            val_el = p_block.find(class_=re.compile(r"Product__priceValue"))
                            if val_el:
                                p_num = int(re.sub(r'[^\d]', '', val_el.text) or 0)
                                if label_el and "即決" in label_el.text and p_num > 0:
                                    buynow_price = p_num
                                elif label_el and "現在" in label_el.text and p_num > 0:
                                    current_price = p_num
                                elif current_price == 0 and p_num > 0:
                                    current_price = p_num

                    # 💡 ユーザー要望: 即決価格が存在する場合は即決価格（今すぐ買える定額）を優先採用！
                    if buynow_price > 0:
                        price = buynow_price
                        is_auction = False  # 即決可能なので通常のフリマと同様に扱う
                    else:
                        price = current_price
                        is_auction = True   # 入札のみのオークション

                    # 🚚 送料抽出（送料別の場合、本体価格に送料を自動合算）
                    shipping_fee = 0
                    postage_div = it.find(class_=re.compile(r"Product__postage|Product__delivery"))
                    if postage_div:
                        p_text = postage_div.text.strip().replace(",", "")
                        if "無料" not in p_text:
                            m_post = re.search(r'(\d+)\s*円', p_text)
                            if m_post:
                                shipping_fee = int(m_post.group(1))

                    base_price = price
                    total_price = price + shipping_fee

                    if item_url and total_price > 0:
                        if min_price > 0 and total_price < min_price:
                            continue
                        if max_price > 0 and total_price > max_price:
                            continue
                        results.append({
                            "title": title,
                            "price_jpy": total_price,
                            "raw_price_jpy": base_price,
                            "shipping_fee_jpy": shipping_fee,
                            "item_url": item_url,
                            "image_url": img_url,
                            "platform": "ヤフオク",
                            "seller_name": "",
                            "is_auction": is_auction
                        })
                        if len(results) >= 15:
                            break
        except Exception as e:
            logger.error(f"Yahoo Auction error: {e}")
        return results[:15]

    @staticmethod
    async def search_rakuma(keyword: str, max_price: float = 0.0, min_price: float = 0.0, search_mode: str = "recent") -> List[Dict[str, Any]]:
        """楽天ラクマ検索 (おすすめ順・販売中・価格指定)"""
        clean_kw = re.sub(r'\s+', ' ', keyword).strip()
        encoded_kw = urllib.parse.quote(clean_kw)
        # 💡 ユーザー画面と100%一致させるため、おすすめ順・販売中・価格範囲で直接検索
        url = f"https://fril.jp/search/{encoded_kw}?transaction=selling"
        if max_price > 0:
            url += f"&max={int(max_price)}"
        if min_price > 0:
            url += f"&min={int(min_price)}"

        results = []
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
            "Referer": "https://fril.jp/"
        }

        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    items = soup.find_all("div", class_=re.compile(r"item"))
                    for it in items:
                        title_elem = it.find("img")
                        price_elem = it.find(class_=re.compile(r"item-box__item-price|price"))
                        link_elem = it.find("a", href=re.compile(r"item.fril.jp"))
                        
                        if link_elem and price_elem and title_elem:
                            href = link_elem.get("href", "")
                            title = title_elem.get("alt", "")
                            img_src = (
                                title_elem.get("data-original") or 
                                title_elem.get("data-src") or 
                                title_elem.get("src", "")
                            )
                            price_clean = re.sub(r"[^\d]", "", price_elem.text)
                            price = float(price_clean) if price_clean else 0.0
                            
                            if href and price > 0 and title:
                                if min_price > 0 and price < min_price:
                                    continue
                                shipping_days = "⚡ 当日発送" if ("即日" in title or "当日" in title) else ""
                                results.append({
                                    "title": title,
                                    "price_jpy": price,
                                    "item_url": href,
                                    "image_url": img_src,
                                    "platform": "ラクマ",
                                    "condition": "",
                                    "shipping_days": shipping_days,
                                    "is_auction": False
                                })
        except Exception as e:
            logger.error(f"Rakuma scrape error: {e}")
        return results[:40]
