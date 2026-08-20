import httpx
from bs4 import BeautifulSoup
import re

url = "https://paypayfleamarket.yahoo.co.jp/item/z659358212"
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"}

resp = httpx.get(url, headers=headers, follow_redirects=True, timeout=10.0)
text = resp.text
soup = BeautifulSoup(text, "html.parser")

print("StatusCode:", resp.status_code)

# 1. 商品の状態抽出
m_cond = re.search(r'商品の状態.*?([新品・未使用|未使用に近い|目立った傷や汚れなし|やや傷や汚れあり|傷や汚れあり|全体的に状態が悪い]+)', text, re.DOTALL)
print("Regex Condition Match:", m_cond.group(1) if m_cond else "None")

# 2. 発送までの日数抽出
m_ship = re.search(r'発送までの日数.*?([1１2２3３4４7７]+[~〜～\-ー]*[1１2２3３4４7７]*日[以で]*発送|即日|24時間|当日)', text, re.DOTALL)
print("Regex Shipping Match:", m_ship.group(1) if m_ship else "None")

# 3. DOM 構造から抽出
for el in soup.find_all(["dt", "th", "span", "div"]):
    t = el.text.strip()
    if "商品の状態" in t:
        parent = el.parent
        print("DOM Condition Found:", parent.text.strip().replace("\n", " "))
    if "発送までの日数" in t:
        parent = el.parent
        print("DOM Shipping Found:", parent.text.strip().replace("\n", " "))
