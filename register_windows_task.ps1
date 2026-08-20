$taskName = "Shokandon_Hourly_AutoSync"
$action = New-ScheduledTaskAction -Execute "node.exe" -Argument "C:\Users\akata\.gemini\antigravity\scratch\saas_batch_engine.js --mode=standard" -WorkingDirectory "C:\Users\akata\.gemini\antigravity\scratch"

# 朝6:00から24時間、1時間おきに実行
$trigger = New-ScheduledTaskTrigger -Daily -At 6:00AM
$trigger.Repetition = (New-ScheduledTaskTrigger -Once -At 6:00AM -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Hours 18)).Repetition

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Description "Shokandon Hourly Auto Sync Task"
Write-Host "SUCCESS_REGISTERED"
