# Windows Task Scheduler Setup for Shokandon Master Batch Engine
$taskName = "ShokandonHourlySync"
$scriptPath = "C:\Users\akata\.gemini\antigravity\scratch\saas_batch_engine.js"
$workDir = "C:\Users\akata\.gemini\antigravity\scratch"

$action = New-ScheduledTaskAction -Execute "node.exe" -Argument "$scriptPath --mode=standard" -WorkingDirectory $workDir
$trigger = New-ScheduledTaskTrigger -Daily -At 6:00AM
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Shokandon Master Batch Engine Hourly Auto Sync Task"

Write-Host "✅ Registered Task Scheduler Task: $taskName successfully!"
