import httpx
from bs4 import BeautifulSoup
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = "https://paypayfleamarket.yahoo.co.jp/item/z659358212"
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"}

resp = httpx.get(url, headers=headers, follow_redirects=True, timeout=10.0)
text = resp.text

# 1. 「商品の情報」スペックテーブルブロックの抽出
spec_match = re.search(r'商品の情報(.*?)出品者', text, re.DOTALL)
spec_text = spec_match.group(1) if spec_match else text

# タグを除去して綺麗にする
clean_spec = re.sub(r'<[^>]+>', ' ', spec_text)
clean_spec = re.sub(r'\s+', ' ', clean_spec)

print("Clean Spec Section:", clean_spec[:300])

# 2. 「商品の状態」テーブル項目のピンポイント抽出
cond_match = re.search(r'商品の状態\s*([^配送発ID出品]+)', clean_spec)
condition_val = cond_match.group(1).strip() if cond_match else "未取得"

# 3. 「発送までの日数」テーブル項目のピンポイント抽出
ship_match = re.search(r'発送までの日数\s*([0-9０-９〜～\-ー日以内で発送即日24時間当日]+)', clean_spec)
shipping_val = ship_match.group(1).strip() if ship_match else "未取得"

print("----------------------------------------")
print("✅ ピンポイント抽出 [商品の状態]:", condition_val)
print("✅ ピンポイント抽出 [発送までの日数]:", shipping_val)
print("----------------------------------------")
