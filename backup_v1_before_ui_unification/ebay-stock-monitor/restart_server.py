import os, sys, subprocess, time

try:
    stdout = subprocess.check_output('netstat -ano | findstr :8000', shell=True).decode()
    for line in stdout.splitlines():
        if 'LISTENING' in line:
            parts = line.strip().split()
            pid = parts[-1]
            if pid and pid != '0':
                subprocess.run(f'taskkill /F /PID {pid}', shell=True, capture_output=True)
except Exception:
    pass

time.sleep(1)
print("Starting fresh uvicorn...")
subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8000"],
    cwd=r"C:\Users\akata\.gemini\antigravity\scratch\ebay-stock-monitor\backend",
    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
)
print("Uvicorn restarted cleanly.")
