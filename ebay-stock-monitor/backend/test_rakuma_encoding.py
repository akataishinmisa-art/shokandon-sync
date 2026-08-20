import httpx
import urllib.parse
from bs4 import BeautifulSoup

def test():
    # ラクマでは半角スペースを "+" に置換して検索
    encoded_kw = urllib.parse.quote_plus("OLYMPUS FE-150")
    url = f"https://fril.jp/s?query={encoded_kw}&transaction=selling"
    r = httpx.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"}, follow_redirects=True)
    soup = BeautifulSoup(r.text, "html.parser")
    items = soup.find_all("div", class_=lambda c: c and "item" in c)
    print("Rakuma quote_plus status:", r.status_code, "items count:", len(items))

if __name__ == "__main__":
    test()
