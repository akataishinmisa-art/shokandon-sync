import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = "https://api.mercari.jp/v2/entities:search"
payload = {
    "userId": "",
    "pageSize": 100,
    "pageToken": "",
    "searchSessionId": "test_session_123",
    "indexRouting": "INDEX_ROUTING_UNSPECIFIED",
    "searchCondition": {
        "keyword": "EX-ZR1800",
        "status": ["STATUS_ON_SALE"],
        "sort": "SORT_CREATED_TIME",
        "order": "ORDER_DESC"
    },
    "serviceFrom": "surugaya"
}

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
    "X-Platform": "web"
}

req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers)
try:
    with urllib.request.urlopen(req, context=ctx, timeout=10) as response:
        data = json.loads(response.read().decode('utf-8'))
        items = data.get("items", [])
        with open("mercari_api_debug.txt", "w", encoding="utf-8") as f:
            f.write(f"Total items from Mercari API: {len(items)}\n")
            for it in items:
                f.write(f"ID: {it.get('id')}, Price: {it.get('price')}, Name: {it.get('name')}\n")
except Exception as e:
    with open("mercari_api_debug.txt", "w", encoding="utf-8") as f:
        f.write(f"Error: {e}\n")
