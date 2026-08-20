
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut('C:\Users\akata\Desktop\商管どん.lnk')
$sc.TargetPath = 'C:\Users\akata\Desktop\商管どん.bat'
$sc.IconLocation = 'shell32.dll,13'
$sc.Save()
