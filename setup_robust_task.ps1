$taskName = "Shokandon_Hourly_AutoSync"

$action = New-ScheduledTaskAction -Execute "node.exe" -Argument "C:\Users\akata\.gemini\antigravity\scratch\saas_batch_engine.js --mode=standard" -WorkingDirectory "C:\Users\akata\.gemini\antigravity\scratch"

$trigger = New-ScheduledTaskTrigger -Daily -At 6:00AM
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Shokandon Robust Hourly Auto Sync Task"
Write-Host "ROBUST_TASK_SUCCESS"
