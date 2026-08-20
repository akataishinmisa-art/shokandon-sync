import re

sample_text = """
self.__next_f.push([1,"1f:[\"$\",\"div\",null,{\"className\":\"merListItem\",\"children\":[{\"title\":\"発送までの日数\",\"value\":\"2~3日で発送\"}]}]"])
"""

sample_text_2 = """
{"shippingDuration":2,"shippingMethod":{"id":1,"name":"らくらくメルカリ便"}}
"""

sample_text_3 = """
"shipping_duration":2, "shipping_days":"2~3日で発送"
"""

def parse_mercari_shipping_text(html: str) -> str:
    # 1. 直接テキスト
    m = re.search(r'発送までの日数[^\w\d]*([1１][~〜～\-ー][2２]日で発送|[2２][~〜～\-ー][3３]日で発送|[4４][~〜～\-ー][7７]日で発送|即日|24時間|当日)', html)
    if m:
        return m.group(1).replace("１", "1").replace("２", "2").replace("３", "3").replace("４", "4").replace("７", "7").replace("~", "〜")
    
    # 2. RSC / JSON内の "value":"2~3日で発送" または "shippingDuration" / "shipping_duration"
    m_val = re.search(r'発送までの日数[^\"]*\"[^\"]*\"value\":\"([^\"]+)\"', html)
    if m_val:
        return m_val.group(1).replace("~", "〜")

    m_code = re.search(r'\"shipping_?duration\"?\s*:\s*(\d+)', html, re.IGNORECASE)
    if m_code:
        code = int(m_code.group(1))
        if code == 1: return "1〜2日で発送"
        if code == 2: return "2〜3日で発送"
        if code == 3: return "4〜7日で発送"
        
    return "1〜2日で発送"

print("Test 1:", parse_mercari_shipping_text(sample_text))
print("Test 2:", parse_mercari_shipping_text(sample_text_2))
print("Test 3:", parse_mercari_shipping_text(sample_text_3))
