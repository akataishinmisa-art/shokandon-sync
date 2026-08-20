import sys
sys.path.insert(0, "backend")
from database import get_all_target_items
import re

items = get_all_target_items()
for t in items:
    print("Target:", t["name"])
    print("  Keyword:", t["keyword"])
    print("  Max buy price JPY:", t["max_buy_price_jpy"])
    print("  Exclude keywords:", t["exclude_keywords"])

title = "★Canon キャノン コンパクトデジカメ PowerShot S110 ブラック 動作確認済み 中古 006900"
price = 30000

# 判定シミュレーション
t = items[0]
max_p = t["max_buy_price_jpy"]
min_p = max_p * 0.20

print(f"\nEvaluating title: {title}")
print(f"Price: {price} vs Max: {max_p}, Min: {min_p}")

if price > max_p:
    print(f"-> REJECTED: Price {price} > Max buy price {max_p}")
elif price < min_p:
    print(f"-> REJECTED: Price {price} < Min price {min_p}")
else:
    print("-> ACCEPTED by price criteria")
