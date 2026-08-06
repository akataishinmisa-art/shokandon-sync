import os
import shutil

src_img = r"C:\Users\akata\.gemini\antigravity\brain\b8f6a10d-312b-4c35-bfbb-7159c594123e\.user_uploaded\media__1785245846966.png"

# Target destinations
web_img_jpg = r"C:\Users\akata\.gemini\antigravity\scratch\ebay-title-generator\ngk_cr7ek.jpg"
web_img_png = r"C:\Users\akata\.gemini\antigravity\scratch\ebay-title-generator\ngk_cr7ek.png"
desktop_img = os.path.join(os.path.expanduser("~"), "Desktop", "商品画像", "NGK_CR7EK_Amazon_Actual_Photo.png")

os.makedirs(os.path.dirname(desktop_img), exist_ok=True)

try:
    from PIL import Image
    im = Image.open(src_img)
    # Crop the main image bounding box inside the screenshot
    w, h = im.size
    # Crop central image area (Amazon product main view)
    crop_area = (int(w * 0.08), int(h * 0.03), int(w * 0.95), int(h * 0.95))
    cropped = im.crop(crop_area)
    cropped.save(web_img_png)
    cropped.convert('RGB').save(web_img_jpg)
    cropped.save(desktop_img)
    print("Cropped and saved image successfully with PIL!")
except Exception as e:
    print(f"PIL error or not installed: {e}, falling back to direct copy.")
    shutil.copy(src_img, web_img_jpg)
    shutil.copy(src_img, web_img_png)
    shutil.copy(src_img, desktop_img)
