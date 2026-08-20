import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_target_item
from monitor_engine import monitor_engine
from scraper import ScraperManager

async def test_trace():
    init_db()
    # 全ターゲットを確認
    from database import get_all_target_items
    targets = get_all_target_items()
    
    with open("trace_filters.txt", "w", encoding="utf-8") as out:
        for t in targets:
            out.write(f"\n========================================\n")
            out.write(f"Target ID {t['id']}: {t['name']} | KW: {t['keyword']}\n")
            out.write(f"MaxPrice: {t['max_buy_price_jpy']}, MinProfit: {t['min_profit_jpy']}, Exclude: {t['exclude_keywords']}\n")
            
            # 各スクレイパーを単体実行
            kw = t["keyword"]
            yf = await ScraperManager.search_yahoo_fleamarket(kw, max_price=0, min_price=0, search_mode="recent")
            rk = await ScraperManager.search_rakuma(kw, max_price=0, min_price=0, search_mode="recent")
            ya = await ScraperManager.search_yahoo_auction(kw, max_price=0, min_price=0, search_mode="recent")
            
            out.write(f"  [RAW RESULTS] Y!Flea: {len(yf)}件, Rakuma: {len(rk)}件, Y!Auc: {len(ya)}件\n")
            
            # Y!Fleaのサンプル
            for it in yf[:3]:
                out.write(f"    Y!Flea item: ¥{it['price_jpy']} | {it['title'][:40]}\n")
            # Rakumaのサンプル
            for it in rk[:3]:
                out.write(f"    Rakuma item: ¥{it['price_jpy']} | {it['title'][:40]}\n")

            # monitor_engine の process_items を通す
            yf_filtered = monitor_engine.process_items_debug(t, yf, "Yahoo!フリマ", out)
            rk_filtered = monitor_engine.process_items_debug(t, rk, "ラクマ", out)
            out.write(f"  [AFTER FILTER] Y!Flea: {len(yf_filtered)}件, Rakuma: {len(rk_filtered)}件\n")

if __name__ == "__main__":
    # monitor_engine にデバッグ用メソッドを追加して実行
    def process_items_debug(self, target_item, items, platform_name, out):
        results = []
        name_lower = target_item["name"].lower()
        model_tokens = []
        for word in re.findall(r'[a-zA-Z0-9\-]{2,}', name_lower):
            if any(char.isdigit() for char in word) and len(word) >= 3:
                model_tokens.append(word)

        exclude_list = [k.strip().lower() for k in target_item.get("exclude_keywords", "").split(",") if k.strip()]
        max_buy_price = float(target_item.get("max_buy_price_jpy") or 0)
        min_buy_price = max_buy_price * 0.15 if max_buy_price > 0 else 0.0

        for found in items:
            title = found["title"]
            title_lower = title.lower()
            price_jpy = float(found["price_jpy"])

            if any(ex in title_lower for ex in exclude_list):
                out.write(f"      [REJECT EXCLUDE] {title[:30]}\n")
                continue

            if model_tokens:
                if not any(token in title_lower for token in model_tokens):
                    out.write(f"      [REJECT MODEL_TOKENS: {model_tokens}] {title[:30]}\n")
                    continue

            if price_jpy > max_buy_price and max_buy_price > 0:
                out.write(f"      [REJECT MAX_PRICE: {price_jpy} > {max_buy_price}] {title[:30]}\n")
                continue

            if price_jpy < min_buy_price:
                out.write(f"      [REJECT MIN_PRICE: {price_jpy} < {min_buy_price}] {title[:30]}\n")
                continue

            results.append(found)
        return results

    import types
    import re
    monitor_engine.process_items_debug = types.MethodType(process_items_debug, monitor_engine)
    asyncio.run(test_trace())
