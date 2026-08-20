import httpx
import json

url = "https://api.mercari.jp/v2/entities:search"

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "X-Platform": "web",
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json"
}

payload = {
    "userId": "",
    "pageSize": 50,
    "pageToken": "",
    "searchSessionId": "test_session_12345",
    "indexRouting": "INDEX_ROUTING_UNSPECIFIED",
    "thumbnailTypes": [],
    "searchCondition": {
        "keyword": "Canon PowerShot S110",
        "excludeKeyword": "",
        "sort": "SORT_CREATED_TIME",
        "order": "ORDER_DESC",
        "status": ["STATUS_ON_SALE"],
        "sizeId": [],
        "categoryId": [],
        "brandId": [],
        "sellerId": [],
        "priceMin": 0,
        "priceMax": 46031,
        "itemConditionId": [],
        "shippingPayerId": []
    },
    "defaultDatasets": [],
    "serviceFrom": "suram"
}

resp = httpx.post(url, headers=headers, json=payload, timeout=10.0)
print("API Status:", resp.status_code)
if resp.status_code == 200:
    data = resp.json()
    items = data.get("items", [])
    print("API Items count:", len(items))
    for it in items[:10]:
        item_id = it.get("id")
        name = it.get("name")
        price = it.get("price")
        thumbnails = it.get("thumbnails", [])
        img = thumbnails[0] if thumbnails else ""
        print(f"[{price}円] {name} -> https://jp.mercari.com/item/{item_id}")
else:
    print("API Error Response:", resp.text[:300])
