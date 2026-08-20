import httpx
from bs4 import BeautifulSoup
import re
import asyncio

async def test_mercari_fetch():
    # メルカリ検索から最初の商品URLを取得して詳細をテスト
    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}, timeout=10.0, follow_redirects=True) as client:
        # 例としてメルカリのURL
        # メルカリの内部APIまたはDOM
        print("Checking Mercari detail response...")
        # メルカリのアイテムIDからデータ取得
