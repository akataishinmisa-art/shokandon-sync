$Action = New-ScheduledTaskAction -Execute "node.exe" -Argument "C:\Users\akata\.gemini\antigravity\scratch\process_with_line_notify.js" -WorkingDirectory "C:\Users\akata\.gemini\antigravity\scratch"
$Trigger = New-ScheduledTaskTrigger -Once -At 6:00AM -RepetitionInterval (New-TimeSpan -Hours 1)
Register-ScheduledTask -TaskName "ShokandonHourlySync" -Action $Action -Trigger $Trigger -Force
Write-Host "Windows Task Scheduler registered successfully!"
