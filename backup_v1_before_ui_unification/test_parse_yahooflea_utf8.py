import httpx
from bs4 import BeautifulSoup
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = "https://paypayfleamarket.yahoo.co.jp/item/z659358212"
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"}

resp = httpx.get(url, headers=headers, follow_redirects=True, timeout=10.0)
text = resp.text

# 1. 商品の状態抽出
m_cond = re.search(r'傷や汚れあり|全体的に状態が悪い|やや傷や汚れあり|目立った傷や汚れなし|未使用に近い|新品', text)
print("Condition Match:", m_cond.group(0) if m_cond else "None")

# 2. 発送までの日数抽出
m_ship = re.search(r'([1１2２3３4４7７]+[~〜～\-ー]*[1１2２3３4４7７]*日で発送|即日|24時間|当日)', text)
print("Shipping Match:", m_ship.group(0) if m_ship else "None")

# 3. JSON / JSON-LD データからの精密抽出
m_json_cond = re.search(r'\"itemCondition\"\s*:\s*\"([^\"]+)\"', text)

print("JSON Condition Match:", m_json_cond.group(1) if m_json_cond else "None")
