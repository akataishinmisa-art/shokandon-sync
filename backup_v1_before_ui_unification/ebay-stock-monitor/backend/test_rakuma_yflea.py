import asyncio
import httpx
from bs4 import BeautifulSoup
import re
import urllib.parse

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

async def test_rakuma_and_yflea():
    kw = "PlayStation Vita PCH-2000"
    
    with open("test_rakuma_yflea.txt", "w", encoding="utf-8") as out:
        # 1. ラクマ
        out.write("=== Testing Rakuma ===\n")
        encoded_kw = urllib.parse.quote(kw)
        url_rakuma = f"https://fril.jp/s?query={encoded_kw}&transaction=selling&sort=created_at&order=desc"
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(url_rakuma, headers={"User-Agent": USER_AGENT})
                out.write(f"Rakuma Status: {resp.status_code}, Length: {len(resp.text)}\n")
                soup = BeautifulSoup(resp.text, "html.parser")
                items = soup.find_all("div", class_=re.compile(r"item"))
                out.write(f"Rakuma div.item count: {len(items)}\n")
                for it in items[:5]:
                    title_elem = it.find("img")
                    price_elem = it.find(class_=re.compile(r"item-box__item-price|price"))
                    link_elem = it.find("a", href=re.compile(r"item.fril.jp"))
                    out.write(f"  item: link={bool(link_elem)}, price={bool(price_elem)}, title={bool(title_elem)}\n")
                    if title_elem:
                        out.write(f"    title: {title_elem.get('alt', '')}\n")
        except Exception as e:
            out.write(f"Rakuma Exception: {e}\n")

        # 2. Yahoo!フリマ
        out.write("\n=== Testing Yahoo Fleamarket ===\n")
        url_yflea = f"https://paypayfleamarket.yahoo.co.jp/search/{encoded_kw}?open=1&sort=-openTime"
        try:
            async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(url_yflea)
                out.write(f"Yahoo Flea Status: {resp.status_code}, Length: {len(resp.text)}\n")
                if resp.status_code != 200:
                    out.write(f"Response: {resp.text[:300]}\n")
                soup = BeautifulSoup(resp.text, "html.parser")
                items = soup.find_all("a", href=re.compile(r"/item/"))
                out.write(f"Yahoo Flea a[href*='/item/'] count: {len(items)}\n")
                script_next = soup.find("script", id="__NEXT_DATA__")
                out.write(f"Yahoo Flea __NEXT_DATA__ present: {bool(script_next)}\n")
        except Exception as e:
            out.write(f"Yahoo Flea Exception: {e}\n")

if __name__ == "__main__":
    asyncio.run(test_rakuma_and_yflea())
