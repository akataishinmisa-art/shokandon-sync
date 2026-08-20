import os
import datetime

base_dir = r"C:\Users\akata\.gemini\antigravity"

total_size = 0
day_before_yesterday_size = 0
yesterday_size = 0
today_size = 0

date_day_before_yesterday = datetime.date(2026, 7, 27)
date_yesterday = datetime.date(2026, 7, 28)
date_today = datetime.date(2026, 7, 29)

for root, dirs, files in os.walk(base_dir):
    for f in files:
        fp = os.path.join(root, f)
        try:
            stat = os.stat(fp)
            size = stat.st_size
            total_size += size
            
            mtime = datetime.date.fromtimestamp(stat.st_mtime)
            if mtime == date_day_before_yesterday:
                day_before_yesterday_size += size
            elif mtime == date_yesterday:
                yesterday_size += size
            elif mtime == date_today:
                today_size += size
        except Exception:
            pass

def to_mb(b):
    return round(b / (1024 * 1024), 2)

print(f"Total Storage: {to_mb(total_size)} MB")
print(f"Day Before Yesterday (2026-07-27): {to_mb(day_before_yesterday_size)} MB ({day_before_yesterday_size:,} bytes)")
print(f"Yesterday (2026-07-28): {to_mb(yesterday_size)} MB ({yesterday_size:,} bytes)")
print(f"Today (2026-07-29): {to_mb(today_size)} MB ({today_size:,} bytes)")
