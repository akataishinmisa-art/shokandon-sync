import sys
sys.path.insert(0, "backend")
from database import get_all_target_items
import re

items = get_all_target_items()
target = items[0]
exclude_keywords = [w.strip().lower() for w in target.get("exclude_keywords", "").split(",") if w.strip()]
print("Exclude keywords list:", exclude_keywords)

title = "★Canon キャノン コンパクトデジカメ PowerShot S110 ブラック 動作確認済み 中古 006900"
title_lower = title.lower()

# 1. ユーザー設定の除外キーワード判定
for ex in exclude_keywords:
    if ex in title_lower:
        print(f"-> REJECTED by User Exclude Keyword: '{ex}'")

# 2. アクセサリ自動NGワード判定
accessory_ng_words = [
    "ケース", "カバー", "ストラップ", "バッテリー", "チャージャー", "充電器", 
    "アダプター", "フード", "キャップ", "フィルター", "ケーブル", "フィルム", 
    "取説", "説明書", "マニュアル", "箱のみ", "元箱のみ", "外箱のみ", "ジャンク品", "空箱", "シール"
]
for ng in accessory_ng_words:
    if ng in title_lower:
        print(f"-> REJECTED by Accessory NG Word: '{ng}'")
