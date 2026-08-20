import re
import json

with open("backend/mercari_dump.html", "r", encoding="utf-8") as f:
    text = f.read()

# 画像URLやリンク
m_ids = set(re.findall(r'm\d{10,12}', text))
print("Found potential mercari item IDs:", len(m_ids), list(m_ids)[:10])

# 価格のパターン
prices = re.findall(r'"price":\s*(\d+)', text)
print("Found prices in JSON:", len(prices), prices[:10])

# static.mercdn.net 画像
images = re.findall(r'https://static\.mercdn\.net/item/detail/orig/photos/m\d+_\d+\.jpg', text)
print("Found Mercari image URLs:", len(images), images[:5])
