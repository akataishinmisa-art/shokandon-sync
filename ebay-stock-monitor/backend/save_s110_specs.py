import sqlite3
import os

s110_specs = """1. 世界的な「Y2K・Vintage Digicam」トレンドでの立ち位置
「スマホの過剰な補正」に飽きたZ世代の最適解
近年のTikTokやInstagramを発端とするレトロデジカメブームにおいて、PowerShot Sシリーズは「トイカメラほどチープすぎず、本格的なエモい空気感が撮れる名機」としてプレミアムな人気を誇ります。

1/1.7型高感度CMOS × 約1,210万画素の絶妙な描写
あえて画素数を欲張らないことで、1画素あたりの受光面積を確保。スマホ特有のシャープネス強調や塗り絵のような不自然さがなく、自然なスキントーン（肌色）とフィルムライクな階調を生み出します。

2. S110ならではの優れた実力・スペックの強み
・F2.0の明るい広角24mmレンズ（光学5倍ズーム）: 暗所や夜のパーティー、カフェスナップでもブレずに撮れ、自然なボケ味が楽しめます。
・Wi-Fi搭載でスマホ転送が簡単: 撮影したエモい写真をその場ですぐスマホに転送し、SNSに投稿可能。
・手のひらサイズの高品位アルミボディ: ポケットに入るコンパクトさで日常使いや旅行に最適。

■ eBay出品用 英語訴求フレーズ (Item Description)
【Headline】
[Mint / Near Mint] Canon PowerShot S110 Digital Camera Black / White [English Menu / Wi-Fi / F2.0] Y2K

【Description】
Classic Y2K Look with Modern Convenience:
"Equipped with a fast F2.0 wide-angle 24mm lens and 1/1.7\\" CMOS sensor, the S110 captures nostalgic, warm, and natural skin tones that smartphones cannot replicate."

Easy Sharing & Global Use:
"Features built-in Wi-Fi for quick transfer to your smartphone, a responsive touchscreen, and English language support. Compact, lightweight, and perfect for street photography and everyday memories."
"""

db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "monitor.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE target_items ADD COLUMN specs_note TEXT DEFAULT ''")
except Exception:
    pass

cursor.execute("UPDATE target_items SET specs_note = ? WHERE name LIKE '%S110%' OR keyword LIKE '%S110%'", (s110_specs.strip(),))
conn.commit()

cursor.execute("SELECT id, name, LENGTH(specs_note) FROM target_items WHERE name LIKE '%S110%'")
rows = cursor.fetchall()
for r in rows:
    safe_name = r[1].encode('ascii', errors='replace').decode('ascii')
    print(f"[OK] Target ID {r[0]} ({safe_name}) updated! Saved specs length: {r[2]} chars")

conn.close()
