import httpx
from bs4 import BeautifulSoup
import urllib.parse
import re

kw = urllib.parse.quote("Canon PowerShot S110")
url = f"https://fril.jp/s?query={kw}&transaction=selling&max=31000&min=6000"
resp = httpx.get(url, headers={"User-Agent": "Mozilla/5.0"})
soup = BeautifulSoup(resp.text, "html.parser")
items = soup.find_all("div", class_=re.compile(r"item"))

m555_item = [it for it in items if "M555" in it.text]
if m555_item:
    it = m555_item[0]
    title_elem = it.find("img")
    title = title_elem.get("alt", "") if title_elem else ""
    price_elem = it.find(class_=re.compile(r"item-box__item-price|price"))
    price_text = price_elem.text.strip() if price_elem else ""
    
    price_clean = re.sub(r"[^\d]", "", price_text)
    price = float(price_clean) if price_clean else 0.0

    # フィルターの各条件をチェック
    exclude_keywords = ["ジャンク", "故障", "不動", "部品取り", "箱のみ", "写真のみ", "現状渡し", "訳あり"]
    accessory_ng_words = ["充電器", "チャージャー", "バッテリー", "電池", "ケーブル", "avc-", "cb-", "nb-", "保護フィルム", "保護シール", "フィルム", "シール", "取扱説明書", "説明書", "マニュアル", "ケース", "カバー", "ストラップ", "キャップ", "フード", "アダプタ", "互換充電", "互換電池"]
    model_tokens = ["Canon", "PowerShot", "S110"]
    
    title_lower = title.lower()
    chk1 = any(ex in title_lower for ex in exclude_keywords)
    chk2 = any(ng in title_lower for ng in accessory_ng_words)
    chk3 = not any(token.lower() in title_lower for token in model_tokens)
    
    print("Price:", price)
    print("Check 1 (user exclude):", chk1)
    print("Check 2 (accessory NG):", chk2, [ng for ng in accessory_ng_words if ng in title_lower])
    print("Check 3 (model token missing):", chk3)
