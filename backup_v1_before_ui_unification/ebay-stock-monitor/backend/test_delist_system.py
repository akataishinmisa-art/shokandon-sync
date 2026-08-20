import asyncio
import sys
import os

# backend ディレクトリをパスに追加
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import init_db, create_ebay_delist_item, get_all_ebay_delist_items, delete_ebay_delist_item
from ebay_api import EbayAPIClient
from ebay_auto_delister import check_source_url_stock, run_auto_delist_check_now

def test_delist_system():
    print("--- 1. データベース初期化テスト ---")
    init_db()

    print("--- 2. eBay API クライアントシミュレーションテスト ---")
    client = EbayAPIClient()
    res = client.end_fixed_price_item("123456789012")
    print("EndFixedPriceItem (Simulation):", res)
    assert res["success"] is True

    print("--- 3. 在庫状況チェックテスト (模擬URL) ---")
    # メルカリ売り切れ模擬 or 正常ページ
    is_sold, reason = check_source_url_stock("https://jp.mercari.com/item/m00000000000")
    print(f"Stock Check Result: is_sold={is_sold}, reason={reason}")

    print("--- 4. DBアイテム作成 ＆ 自動取り下げ一括実行テスト ---")
    item_id = create_ebay_delist_item("999888777666", "https://jp.mercari.com/item/m00000000000", title="テスト監視商品")
    items = get_all_ebay_delist_items()
    print(f"登録アイテム数: {len(items)}")

    # 一括チェック実行
    result = asyncio.run(run_auto_delist_check_now())
    print("Delist Check Now Output:", result)

    # クリーンアップ
    delete_ebay_delist_item(item_id)
    print("[SUCCESS] All unit tests completed successfully!")

if __name__ == "__main__":
    test_delist_system()
