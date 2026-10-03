# Script de configuracion para operacion continua de taquilla y bot de sondeo
# Evita bloqueo de sesion, salvapantallas y suspension de Windows

Write-Host "======================================================================"
Write-Host "Configurando parametros para ejecucion ininterrumpida de sondeo..."
Write-Host "======================================================================"

# 1. Desactivar salvapantallas y requisito de contrasena en HKCU
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'ScreenSaveActive' -Value '0' -Force
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'ScreenSaverIsSecure' -Value '0' -Force
Set-ItemProperty -Path 'HKCU:\Control Panel\Desktop' -Name 'ScreenSaveTimeOut' -Value '0' -Force
Write-Host "[OK] Salvapantallas y bloqueo por inactividad: DESACTIVADOS"

# 2. Configurar politicas de energia (powercfg) para que el equipo NUNCA se suspenda ni apague pantalla
powercfg /SETACVALUEINDEX SCHEME_CURRENT SUB_SLEEP STANDBYIDLE 0
powercfg /SETDCVALUEINDEX SCHEME_CURRENT SUB_SLEEP STANDBYIDLE 0
Write-Host "[OK] Suspension de equipo (Standby): NUNCA"

powercfg /SETACVALUEINDEX SCHEME_CURRENT SUB_VIDEO VIDEOIDLE 0
powercfg /SETDCVALUEINDEX SCHEME_CURRENT SUB_VIDEO VIDEOIDLE 0
Write-Host "[OK] Apagado de pantalla (Display Idle): NUNCA"

powercfg /SETACVALUEINDEX SCHEME_CURRENT SUB_SLEEP HIBERNATEIDLE 0
powercfg /SETDCVALUEINDEX SCHEME_CURRENT SUB_SLEEP HIBERNATEIDLE 0
Write-Host "[OK] Hibernacion automatica: NUNCA"

# Permitir temporizadores de reactivacion (Wake Timers)
powercfg /SETACVALUEINDEX SCHEME_CURRENT SUB_SLEEP bd3b718a-0680-4d9d-8ab2-e1d2b4ac806d 1
powercfg /SETDCVALUEINDEX SCHEME_CURRENT SUB_SLEEP bd3b718a-0680-4d9d-8ab2-e1d2b4ac806d 1
Write-Host "[OK] Temporizadores de reactivacion (RTC Wake): ACTIVADOS"

# Aplicar los cambios en el esquema de energia activo
powercfg /SETACTIVE SCHEME_CURRENT
Write-Host "[OK] Esquema de energia actualizado y activo"

# 3. Politica de Personalizacion (NoLockScreen)
try {
    $polPath = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Personalization'
    if (-not (Test-Path $polPath)) {
        New-Item -Path $polPath -Force | Out-Null
    }
    Set-ItemProperty -Path $polPath -Name 'NoLockScreen' -Value 1 -Type DWord -Force -ErrorAction Stop
    Write-Host "[OK] Politica NoLockScreen: APLICADA (Bloqueo de Windows desactivado)"
} catch {
    Write-Host "[INFO] NoLockScreen en HKLM omitido (HKCU ya no bloqueara la sesion)."
}

Write-Host "======================================================================"
Write-Host "Ajustes completados con exito. La sesion permanecera activa para el bot."
Write-Host "======================================================================"
