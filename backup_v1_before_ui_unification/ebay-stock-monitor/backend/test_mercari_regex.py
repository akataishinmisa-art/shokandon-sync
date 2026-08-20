import re

test_mercari_html = """
<div class="product-info">
  <p>発送元の地域: 京都府</p>
  <p>発送までの日数</p>
  <div>2〜3日で発送</div>
</div>
"""

m = re.search(r'発送までの日数.*?([1１][~〜～\-ー][2２]日で発送|[2２][~〜～\-ー][3３]日で発送|[4４][~〜～\-ー][7７]日で発送|即日|24時間)', test_mercari_html, re.DOTALL)
print("Result:", m.group(1) if m else "None")
