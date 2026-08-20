import httpx
from bs4 import BeautifulSoup
import urllib.parse
import re

# 1. "Canon PowerShot S110" で検索した場合
kw1 = urllib.parse.quote("Canon PowerShot S110")
url1 = f"https://fril.jp/s?query={kw1}&transaction=selling&max=31000&min=6000"
resp1 = httpx.get(url1, headers={"User-Agent": "Mozilla/5.0"})
soup1 = BeautifulSoup(resp1.text, "html.parser")
items1 = soup1.find_all("div", class_=re.compile(r"item"))
print(f"Results for '{kw1}': {len(items1)}")
has_m555_1 = any("M555" in it.text for it in items1)
print(f"Found M555 in kw1: {has_m555_1}")

# 2. "PowerShot S110" で検索した場合（Canonを外した型番検索）
kw2 = urllib.parse.quote("PowerShot S110")
url2 = f"https://fril.jp/s?query={kw2}&transaction=selling&max=31000&min=6000"
resp2 = httpx.get(url2, headers={"User-Agent": "Mozilla/5.0"})
soup2 = BeautifulSoup(resp2.text, "html.parser")
items2 = soup2.find_all("div", class_=re.compile(r"item"))
print(f"Results for '{kw2}': {len(items2)}")
has_m555_2 = any("M555" in it.text for it in items2)
print(f"Found M555 in kw2: {has_m555_2}")
