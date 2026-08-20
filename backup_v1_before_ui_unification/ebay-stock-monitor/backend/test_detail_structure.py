import asyncio
import httpx
from bs4 import BeautifulSoup
import re
import json

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

async def check_yflea_and_rakuma():
    # 1. Yahooフリマの検索から最新の出品URLを1件取得
    url_yflea = "https://paypayfleamarket.yahoo.co.jp/search/PS%20Vita?open=1&sort=-openTime"
    url_rakuma = "https://fril.jp/s?query=PS%20Vita&transaction=selling&sort=created_at&order=desc"

    with open("detail_html_debug.txt", "w", encoding="utf-8") as out:
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=8.0, follow_redirects=True) as client:
            # Y!Flea
            resp = await client.get(url_yflea)
            soup = BeautifulSoup(resp.text, "html.parser")
            a_item = soup.find("a", href=re.compile(r"/item/"))
            if a_item:
                target_url = "https://paypayfleamarket.yahoo.co.jp" + a_item.get("href")
                out.write(f"Testing YFlea URL: {target_url}\n")
                r_item = await client.get(target_url)
                soup_item = BeautifulSoup(r_item.text, "html.parser")
                script = soup_item.find("script", id="__NEXT_DATA__")
                if script:
                    data = json.loads(script.string)
                    out.write(f"YFlea JSON keys: {list(data.keys())}\n")
                    # pageProps 探索
                    props = data.get("props", {}).get("pageProps", {})
                    out.write(f"pageProps keys: {list(props.keys())}\n")
                    for k in props:
                        if isinstance(props[k], dict):
                            out.write(f"  props[{k}] keys: {list(props[k].keys())[:10]}\n")
                            if "itemCondition" in props[k]:
                                out.write(f"    FOUND itemCondition: {props[k]['itemCondition']}\n")
                            if "shipmentDays" in props[k]:
                                out.write(f"    FOUND shipmentDays: {props[k]['shipmentDays']}\n")

            # Rakuma
            resp_rk = await client.get(url_rakuma)
            soup_rk = BeautifulSoup(resp_rk.text, "html.parser")
            a_rk = soup_rk.find("a", href=re.compile(r"item.fril.jp"))
            if a_rk:
                rk_url = a_rk.get("href")
                out.write(f"\nTesting Rakuma URL: {rk_url}\n")
                r_rk = await client.get(rk_url)
                soup_detail = BeautifulSoup(r_rk.text, "html.parser")
                for tr in soup_detail.find_all("tr"):
                    th = tr.find("th")
                    td = tr.find("td")
                    if th and td:
                        out.write(f"  Rakuma table: {th.text.strip()} -> {td.text.strip()[:30]}\n")

if __name__ == "__main__":
    asyncio.run(check_yflea_and_rakuma())
