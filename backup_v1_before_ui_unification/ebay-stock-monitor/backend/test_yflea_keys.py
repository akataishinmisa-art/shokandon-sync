import asyncio
import httpx
from bs4 import BeautifulSoup
import json
import urllib.parse

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

async def check_keys():
    kw = "PlayStation Vita PCH-2000"
    encoded_kw = urllib.parse.quote(kw)
    url = f"https://paypayfleamarket.yahoo.co.jp/search/{encoded_kw}?open=1&sort=-openTime"
    
    with open("yflea_keys.txt", "w", encoding="utf-8") as out:
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(url)
            soup = BeautifulSoup(resp.text, "html.parser")
            script = soup.find("script", id="__NEXT_DATA__")
            if script:
                data = json.loads(script.string)
                pageProps = data.get("props", {}).get("pageProps", {})
                out.write(f"pageProps keys: {list(pageProps.keys())}\n")
                if "initialState" in pageProps:
                    out.write(f"initialState keys: {list(pageProps['initialState'].keys())}\n")
                # 辞書の中を再帰検索して items を探す
                def find_items(d, path=""):
                    if isinstance(d, dict):
                        for k, v in d.items():
                            if k == "items" or k == "itemList" or k == "searchResult":
                                out.write(f"Found {k} at {path}.{k}: length {len(v) if isinstance(v, list) else type(v)}\n")
                                if isinstance(v, list) and len(v) > 0:
                                    out.write(f"  sample item keys: {list(v[0].keys()) if isinstance(v[0], dict) else type(v[0])}\n")
                                    out.write(f"  sample item: {json.dumps(v[0], ensure_ascii=False)[:300]}\n")
                            find_items(v, f"{path}.{k}")
                    elif isinstance(d, list):
                        for i, el in enumerate(d[:2]):
                            find_items(el, f"{path}[{i}]")
                find_items(pageProps, "pageProps")

if __name__ == "__main__":
    asyncio.run(check_keys())
