from bs4 import BeautifulSoup
import re

with open("yahoo_auction_search.html", "r", encoding="utf-8") as f:
    html = f.read()

soup = BeautifulSoup(html, "html.parser")
products = soup.find_all("li", class_=re.compile(r"Product"))
print("Found Product items in Yahoo Auction:", len(products))

for p in products[:5]:
    title = p.find(class_=re.compile(r"Product__title|title"))
    price = p.find(class_=re.compile(r"Product__priceValue|price"))
    # その他の属性やテキストを探す
    detail = p.find(class_=re.compile(r"Product__otherInfo|otherInfo|detail|data"))
    all_text = p.get_text(separator=" | ", strip=True)
    print("--- Item ---")
    print("  Title:", title.text.strip() if title else "N/A")
    print("  Price:", price.text.strip() if price else "N/A")
    print("  All text snippets:", all_text)
