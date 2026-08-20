import httpx
from bs4 import BeautifulSoup
import re
import asyncio

async def test_rakuma_s10():
    url = "https://fril.jp/s?query=Canon%20PowerShot%20S10&transaction=selling"
    headers = {"User-Agent": "Mozilla/5.0"}
    async with httpx.AsyncClient(headers=headers, timeout=10.0, follow_redirects=True) as client:
        resp = await client.get(url)
        soup = BeautifulSoup(resp.text, "html.parser")
        items = soup.find_all("div", class_=re.compile(r"item"))
        
        target_url = None
        for it in items:
            if "8,380" in it.text or "8380" in it.text or "S10" in it.text:
                a = it.find("a", href=re.compile(r"item.fril.jp"))
                if a:
                    target_url = a["href"]
                    print("Found S10 URL:", target_url)
                    break
                    
        if target_url:
            r_det = await client.get(target_url)
            s_det = BeautifulSoup(r_det.text, "html.parser")
            for tr in s_det.find_all("tr"):
                if "発送日の目安" in tr.text or "発送日" in tr.text:
                    td = tr.find("td")
                    if td:
                        print("Exact Rakuma text:", td.text.strip())

asyncio.run(test_rakuma_s10())
