import urllib.request
import re
import os
import json

asin = "B001RLZ94S"
url = f"https://www.amazon.co.jp/dp/{asin}"

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
}

desktop_dir = os.path.join(os.path.expanduser("~"), "Desktop", "商品画像")
os.makedirs(desktop_dir, exist_ok=True)

print("Fetching Amazon page...")
try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8', errors='ignore')

        # Extract image URLs from Amazon's hiRes / large image JSON block
        hires_urls = re.findall(r'"hiRes"\s*:\s*"(https://m\.media-amazon\.com/images/I/[^"]+\.jpg)"', html)
        large_urls = re.findall(r'"large"\s*:\s*"(https://m\.media-amazon\.com/images/I/[^"]+\.jpg)"', html)

        all_urls = list(dict.fromkeys(hires_urls + large_urls))

        if not all_urls:
            # Fallback regex for Amazon image CDN URLs
            all_urls = list(dict.fromkeys(re.findall(r'https://m\.media-amazon\.com/images/I/[A-Za-z0-9_\-+%\.]+\._AC_[A-Za-z0-9_\-]+\_\.jpg', html)))

        print(f"Found {len(all_urls)} images.")

        saved_paths = []
        for i, img_url in enumerate(all_urls[:4], start=1):
            # Convert to highest resolution by stripping modification suffixes if present
            clean_url = re.sub(r'\._AC_[^\.]+\.', '.', img_url)
            print(f"Downloading Image {i}: {clean_url}")
            try:
                img_req = urllib.request.Request(clean_url, headers=headers)
                with urllib.request.urlopen(img_req) as img_resp:
                    data = img_resp.read()
                    out_path = os.path.join(desktop_dir, f"NGK_CR7EK_Amazon_Original_{i}.jpg")
                    with open(out_path, 'wb') as f:
                        f.write(data)
                    saved_paths.append(out_path)
                    print(f"Saved to {out_path}")
            except Exception as e:
                print(f"Failed to download {clean_url}: {e}")

except Exception as e:
    print(f"Error: {e}")
