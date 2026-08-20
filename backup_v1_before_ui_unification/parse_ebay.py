import re
import json

with open('ebay_item.html', 'r', encoding='utf-8', errors='ignore') as f:
    html = f.read()

# Check error page
if '4xx-bkgd.png' in html or 'Error Page | eBay' in html:
    print('STATUS: Error Page (Not Found)')

# Title match
t = re.search(r'<title>(.*?)</title>', html, re.I)
print('Title:', t.group(1) if t else 'N/A')

# Meta description match
m_desc = re.search(r'name=["\']description["\']\s+content=["\'](.*?)["\']', html, re.I)
if not m_desc:
    m_desc = re.search(r'content=["\'](.*?)["\']\s+name=["\']description["\']', html, re.I)
print('Meta Desc:', m_desc.group(1) if m_desc else 'N/A')

# Meta og:price
og_p = re.search(r'property=["\']product:price:amount["\']\s+content=["\'](.*?)["\']', html, re.I)
print('OG Price:', og_p.group(1) if og_p else 'N/A')

# ld+json
for m in re.finditer(r'<script\s+type=["\']application/ld\+json["\']>(.*?)</script>', html, re.S | re.I):
    try:
        data = json.loads(m.group(1))
        print('--- JSON-LD ---')
        print(json.dumps(data, indent=2))
    except Exception as e:
        pass
