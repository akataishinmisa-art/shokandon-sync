import asyncio
import httpx
from bs4 import BeautifulSoup
import re
import json

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0"
]

def clean_shipping_days(text: str) -> str:
    if not text:
        return "出品ページ参照"
    t = text.strip().replace("\n", " ").replace("、", "").replace(",", "")
    prefixes = [
        "支払い手続きから", "支払い手続き後", "お支払い手続きから", "お支払い手続き後",
        "支払いから", "支払い後", "お支払いから", "お支払い後",
        "入金確認後", "ご入金確認後", "入金から", "決済後"
    ]
    for p in prefixes:
        t = t.replace(p, "").strip()
    return t or "出品ページ参照"

async def test_enrich_real_urls():
    test_urls = [
        ("ヤフオク", "https://auctions.yahoo.co.jp/jp/auction/o1240932106"),
        ("Yahoo!フリマ", "https://paypayfleamarket.yahoo.co.jp/item/z472392430"),
        ("ラクマ", "https://item.fril.jp/02796e67dbd3923dbe0daeb1adfb57ea")
    ]

    with open("enrich_results.txt", "w", encoding="utf-8") as out:
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENTS[0]}, timeout=6.0, follow_redirects=True) as client:
            for platform, url in test_urls:
                try:
                    resp = await client.get(url)
                    out.write(f"[{platform}] {url} -> Status: {resp.status_code}\n")
                    if resp.status_code == 200:
                        soup = BeautifulSoup(resp.text, "html.parser")
                        cond = "出品ページ参照"
                        ship = "出品ページ参照"

                        # 1. Yahoo!フリマ
                        if "paypayfleamarket" in url:
                            script = soup.find("script", id="__NEXT_DATA__")
                            if script:
                                data = json.loads(script.string)
                                item_props = data.get("props", {}).get("pageProps", {}).get("item", {})
                                cond = item_props.get("itemCondition", {}).get("name") or cond
                                ship = item_props.get("shipmentDays", {}).get("name") or ship
                        
                        # 2. ヤフオク
                        elif "auctions.yahoo.co.jp" in url:
                            for el in soup.find_all(["dt", "th", "span", "div"]):
                                txt = el.text.strip()
                                if "状態" in txt and cond == "出品ページ参照":
                                    sib = el.find_next_sibling(["dd", "td", "span", "p"])
                                    if sib:
                                        cond = sib.text.strip().replace("\n", " ")
                                if ("発送までの日数" in txt or "発送日" in txt) and ship == "出品ページ参照":
                                    sib = el.find_next_sibling(["dd", "td", "span", "p"])
                                    if sib:
                                        ship = sib.text.strip().replace("\n", " ")

                        # 3. ラクマ
                        elif "fril.jp" in url:
                            for tr in soup.find_all("tr"):
                                th = tr.find("th")
                                td = tr.find("td")
                                if th and td:
                                    if "商品の状態" in th.text:
                                        cond = td.text.strip().replace("\n", " ")
                                    elif "発送日の目安" in th.text or "発送日" in th.text:
                                        ship = td.text.strip().replace("\n", " ")

                        ship_clean = clean_shipping_days(ship)
                        out.write(f"  -> Extracted: Cond='{cond}', Ship='{ship_clean}'\n")
                except Exception as e:
                    out.write(f"  -> Error: {e}\n")
                await asyncio.sleep(0.3)

if __name__ == "__main__":
    asyncio.run(test_enrich_real_urls())
