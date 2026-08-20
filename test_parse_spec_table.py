import httpx
from bs4 import BeautifulSoup
import sys

sys.stdout.reconfigure(encoding='utf-8')

url = "https://paypayfleamarket.yahoo.co.jp/item/z659358212"
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"}

resp = httpx.get(url, headers=headers, follow_redirects=True, timeout=10.0)
text = resp.text
soup = BeautifulSoup(text, "html.parser")

print("=== Yahoo Flea Table Spec Parser Test ===")

# 方法1: テーブル / リスト構造 (th/td, dt/dd, tr, div)
condition = None
shipping = None

# A. BeautifulSoup で仕様情報領域（商品の情報）を精密解析
for row in soup.find_all(["tr", "div", "dl", "p"]):
    row_text = row.text.strip()
    # "商品の状態" の直後の要素をピンポイント抽出
    if "商品の状態" in row_text and not condition:
        # 子要素や隣接要素を探索
        children = [c.text.strip() for c in row.find_all(["td", "dd", "span", "div", "p"]) if c.text.strip()]
        for c in children:
            if c != "商品の状態" and any(k in c for k in ["新品", "未使用", "目立った傷や汚れなし", "やや傷や汚れあり", "傷や汚れあり", "全体的に状態が悪い"]):
                condition = c
                break
    if "発送までの日数" in row_text and not shipping:
        children = [c.text.strip() for c in row.find_all(["td", "dd", "span", "div", "p"]) if c.text.strip()]
        for c in children:
            if c != "発送までの日数" and ("日" in c or "即日" in c or "24時間" in c):
                shipping = c
                break

print("Extracted Condition:", condition)
print("Extracted Shipping:", shipping)
