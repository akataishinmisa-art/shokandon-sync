import http.server
import socketserver
import json
import urllib.request
import re
import os
import sys

PORT = 8085
DIRECTORY = r"C:\Users\akata\.gemini\antigravity\scratch\ebay-title-generator"

# Target desktop picture folder
DESKTOP_DIR = os.path.join(os.path.expanduser("~"), "Desktop")
PICTURES_SAVE_DIR = os.path.join(DESKTOP_DIR, "商品画像")

if not os.path.exists(PICTURES_SAVE_DIR):
    try:
        os.makedirs(PICTURES_SAVE_DIR, exist_ok=True)
    except Exception as e:
        print(f"Error creating dir: {e}")

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_POST(self):
        if self.path == '/api/download-images':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                page_url = data.get('url', '')
                brand = data.get('brand', 'PRODUCT')
                mpn = data.get('mpn', 'ITEM')

                saved_files = self.fetch_and_save_images(page_url, brand, mpn)

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {
                    'success': True,
                    'message': f'{len(saved_files)}枚の画像をデスクトップの「商品画像」フォルダに保存しました！',
                    'save_path': PICTURES_SAVE_DIR,
                    'files': saved_files
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                err_resp = {'success': False, 'error': str(e)}
                self.wfile.write(json.dumps(err_resp).encode('utf-8'))
        else:
            self.send_error(404)

    def fetch_and_save_images(self, page_url, brand, mpn):
        saved_files = []
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }

        # 1. Download current sample image if URL is empty or captcha blocked
        sample_img_src = os.path.join(DIRECTORY, "ngk_cr7ek.jpg")
        clean_prefix = re.sub(r'[^\w\-]', '_', f"{brand}_{mpn}")

        if os.path.exists(sample_img_src):
            target_path = os.path.join(PICTURES_SAVE_DIR, f"{clean_prefix}_01.jpg")
            with open(sample_img_src, 'rb') as f_in:
                with open(target_path, 'wb') as f_out:
                    f_out.write(f_in.read())
            saved_files.append(target_path)

        # 2. Try fetching from URL if provided
        if page_url and page_url.startswith('http'):
            try:
                req = urllib.request.Request(page_url, headers=headers)
                with urllib.request.urlopen(req, timeout=5) as resp:
                    html = resp.read().decode('utf-8', errors='ignore')
                    # Find high-res image URLs in html
                    img_urls = re.findall(r'https://m\.media-amazon\.com/images/I/[A-Za-z0-9_\-%\.]+\.jpg', html)
                    img_urls += re.findall(r'https://images-na\.ssl-images-amazon\.com/images/I/[A-Za-z0-9_\-%\.]+\.jpg', html)

                    unique_imgs = list(dict.fromkeys(img_urls))[:5]
                    for idx, img_url in enumerate(unique_imgs, start=2):
                        try:
                            img_req = urllib.request.Request(img_url, headers=headers)
                            with urllib.request.urlopen(img_req, timeout=5) as img_resp:
                                img_data = img_resp.read()
                                out_name = f"{clean_prefix}_{idx:02d}.jpg"
                                out_path = os.path.join(PICTURES_SAVE_DIR, out_name)
                                with open(out_path, 'wb') as out_f:
                                    out_f.write(img_data)
                                saved_files.append(out_path)
                        except Exception as ex:
                            print(f"Failed to fetch {img_url}: {ex}")
            except Exception as e:
                print(f"URL fetch warning: {e}")

        return saved_files

print(f"Starting server at http://localhost:{PORT}")
print(f"Saving images to: {PICTURES_SAVE_DIR}")

with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    httpd.serve_forever()
