param (
    [string]$Hora = "07:00",
    [string]$Activo = "true"
)

$TaskName = "Suite_Bloqueador_Animalitos_7AM"
$WorkDir = $PSScriptRoot
$BatPath = Join-Path $PSScriptRoot "INICIAR_SUITE.bat"

try {
    $isActivo = ($Activo -eq "true" -or $Activo -eq "1" -or $Activo -eq "$true" -or $Activo -eq "True")

    if (-not $isActivo) {
        Disable-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Out-Null
        $res = @{
            ok = $true
            message = "Tarea programada desactivada temporalmente."
            state = "Disabled"
            hora = $Hora
        }
        $res | ConvertTo-Json
        exit 0
    }

    # Convertir formato HH:mm a h:mmtt (ej: 07:00 -> 7:00AM)
    $cleanHora = $Hora.Trim()
    $dt = [DateTime]::ParseExact($cleanHora, "HH:mm", [System.Globalization.CultureInfo]::InvariantCulture)
    $triggerTime = $dt.ToString("h:mmtt", [System.Globalization.CultureInfo]::InvariantCulture)

    $Action = New-ScheduledTaskAction -Execute $BatPath -WorkingDirectory $WorkDir
    $TriggerDaily = New-ScheduledTaskTrigger -Daily -At $triggerTime
    $TriggerLogon = New-ScheduledTaskTrigger -AtLogon -User $env:USERNAME
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -WakeToRun
    $Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger @($TriggerDaily, $TriggerLogon) -Settings $Settings -Principal $Principal -Force | Out-Null
    Enable-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Out-Null

    # Evitar que Windows entre en suspensión o apague el sistema mientras está conectado a corriente (Modo Viaje 24/7)
    try {
        & powercfg.exe /change standby-timeout-ac 0 | Out-Null
        & powercfg.exe /change hibernate-timeout-ac 0 | Out-Null
        & powercfg.exe /change monitor-timeout-ac 0 | Out-Null
    } catch {}

    $task = Get-ScheduledTask -TaskName $TaskName
    $taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName

    $res = @{
        ok = $true
        message = "Hora de activacion configurada exitosamente para las $cleanHora ($triggerTime)."
        hora = $cleanHora
        triggerTime = $triggerTime
        nextRun = $taskInfo.NextRunTime.ToString()
        state = $task.State.ToString()
    }
    $res | ConvertTo-Json
} catch {
    $err = @{
        ok = $false
        message = $_.Exception.Message
    }
    $err | ConvertTo-Json
    exit 1
}
