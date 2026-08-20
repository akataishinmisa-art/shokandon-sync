import os
import sys
import webbrowser
import time
import uvicorn

# プロジェクトルートとbackendをPythonパスに追加
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(CURRENT_DIR, "backend")

if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# 作業ディレクトリをbackendに設定
os.chdir(BACKEND_DIR)

def open_browser():
    time.sleep(1.5)
    webbrowser.open("http://127.0.0.1:8000")

if __name__ == "__main__":
    print("=" * 60)
    print("  eBay Arbitrage Hunter - Starting Server...")
    print("  URL: http://127.0.0.1:8000")
    print("=" * 60)
    
    # 別スレッドでブラウザを自動オープン
    import threading
    threading.Thread(target=open_browser, daemon=True).start()
    
    # サーバー起動 (コード変更の即時反映)
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
