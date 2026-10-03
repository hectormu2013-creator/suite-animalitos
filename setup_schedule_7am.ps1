$TaskName = "Suite_Bloqueador_Animalitos_7AM"
$BatPath = "C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos\INICIAR_SUITE.bat"
$WorkDir = "C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos"

$Action = New-ScheduledTaskAction -Execute $BatPath -WorkingDirectory $WorkDir
$TriggerDaily = New-ScheduledTaskTrigger -Daily -At 7:00AM
$TriggerLogon = New-ScheduledTaskTrigger -AtLogon -User $env:USERNAME
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger @($TriggerDaily, $TriggerLogon) -Settings $Settings -User $env:USERNAME -Force

Write-Host "Tarea '$TaskName' registrada exitosamente."
