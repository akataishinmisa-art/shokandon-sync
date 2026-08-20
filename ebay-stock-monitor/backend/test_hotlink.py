import httpx

# ラクマの画像URLにRefererなしでアクセス
url = "https://img.fril.jp/img/744537749/m/2506615006.jpg"

r1 = httpx.get(url)
print("Without referer status:", r1.status_code)

r2 = httpx.get(url, headers={"Referer": ""})
print("Empty referer status:", r2.status_code)
