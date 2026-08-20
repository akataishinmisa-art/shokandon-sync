import asyncio
import httpx
from bs4 import BeautifulSoup
import re

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

test_urls = [
    "https://auctions.yahoo.co.jp/jp/auction/o1226764555",
    "https://auctions.yahoo.co.jp/jp/auction/k1230977523",
    "https://paypayfleamarket.yahoo.co.jp/item/w1223409468",
    "https://paypayfleamarket.yahoo.co.jp/item/k1228944515"
]

async def test():
    with open("parse_details_result.txt", "w", encoding="utf-8") as out:
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=8.0, follow_redirects=True) as client:
            for url in test_urls:
                out.write(f"\n--- URL: {url} ---\n")
                resp = await client.get(url)
                if resp.status_code != 200:
                    out.write(f"Failed with status: {resp.status_code}\n")
                    continue
                
                soup = BeautifulSoup(resp.text, "html.parser")
                
                cond = None
                ship = None
                
                # ヤフオク
                if "auctions.yahoo.co.jp" in url:
                    for el in soup.find_all(["dt", "th", "span", "div"]):
                        txt = el.text.strip()
                        if "状態" in txt and not cond:
                            sib = el.find_next_sibling(["dd", "td", "span", "p"])
                            if sib:
                                cond = sib.text.strip().replace("\n", " ")
                        if ("発送までの日数" in txt or "発送日" in txt) and not ship:
                            sib = el.find_next_sibling(["dd", "td", "span", "p"])
                            if sib:
                                ship = sib.text.strip().replace("\n", " ")
                
                # Yahoo!フリマ (PayPayフリマ) - HTML内の __NEXT_DATA__ JSON またはタグ
                elif "paypayfleamarket" in url:
                    script = soup.find("script", id="__NEXT_DATA__")
                    if script:
                        try:
                            import json
                            data = json.loads(script.string)
                            item_props = data.get("props", {}).get("pageProps", {}).get("item", {})
                            cond = item_props.get("itemCondition", {}).get("name")
                            ship = item_props.get("shipmentDays", {}).get("name")
                        except Exception as e:
                            out.write(f"JSON parse error: {e}\n")
                    
                    if not cond or not ship:
                        for el in soup.find_all(["dt", "th", "span", "p", "div"]):
                            txt = el.text.strip()
                            if "商品の状態" == txt and not cond:
                                sib = el.find_next_sibling()
                                if sib:
                                    cond = sib.text.strip()
                            if "発送までの日数" == txt and not ship:
                                sib = el.find_next_sibling()
                                if sib:
                                    ship = sib.text.strip()
                
                out.write(f"Condition: {cond}\n")
                out.write(f"Shipping: {ship}\n")

if __name__ == "__main__":
    asyncio.run(test())
