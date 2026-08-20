import re

title = "【動作確認済】OLYMPUS CAMEDIA FE-150 デジタルカメラ 充電器セット オールドコンデジ オリンパス"
title_lower = title.lower()

accessory_ng_words = [
    "充電器", "チャージャー", "バッテリー", "電池", "ケーブル", "avc-", "cb-", "nb-",
    "保護フィルム", "保護シール", "フィルム", "シール", "取扱説明書", "説明書", "マニュアル",
    "ケース", "カバー", "ストラップ", "キャップ", "フード", "アダプタ", "互換充電", "互換電池"
]

matched_ng = [ng for ng in accessory_ng_words if ng in title_lower]
print(f"Matched NG words in title: {matched_ng}")
