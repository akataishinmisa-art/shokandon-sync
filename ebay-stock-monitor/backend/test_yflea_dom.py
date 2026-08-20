import asyncio
import httpx
from bs4 import BeautifulSoup
import re

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

async def check_yflea_dom():
    url = "https://paypayfleamarket.yahoo.co.jp/item/z663324958"
    with open("yflea_dom.txt", "w", encoding="utf-8") as out:
        async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(url)
            soup = BeautifulSoup(resp.text, "html.parser")
            for el in soup.find_all(["dt", "th", "span", "p", "div", "td"]):
                txt = el.text.strip()
                if "状態" in txt or "発送" in txt:
                    out.write(f"Element <{el.name}>: '{txt}'\n")
                    if el.next_sibling:
                        out.write(f"   next_sibling: '{el.next_sibling.text.strip()}'\n")
                    parent = el.parent
                    if parent:
                        out.write(f"   parent text: '{parent.text.strip()[:60]}'\n")

if __name__ == "__main__":
    asyncio.run(check_yflea_dom())
