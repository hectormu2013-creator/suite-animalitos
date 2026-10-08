# ==============================================================================
# INSTALADOR AUTÓNOMO Y BOOTSTRAP DE NODO DE PESCA - SUITE ANIMALITOS
# Permite convertir cualquier PC con Windows en una taquilla de pesca autónoma.
# ==============================================================================

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$targetDir = "C:\SuiteAnimalitos"
$repoZipUrl = "https://github.com/hectormu2013-creator/suite-animalitos/archive/refs/heads/main.zip"
$cloudflaredUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
$masterUrl = "https://suite-animalitos.onrender.com"

Clear-Host
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "    INSTALADOR PROFESIONAL DE NODO DE PESCA - SUITE ANIMALITOS 2.0" -ForegroundColor Yellow
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar Elevación / Administrador
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[!] Solicitando permisos de Administrador..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"irm $masterUrl/api/installer/bootstrap.ps1 | iex`"" -Verb RunAs
    exit
}

Write-Host "[1/6] Verificando entorno de ejecucion en Windows..." -ForegroundColor Green

# 2. Verificar o Instalar Node.js
$nodeInstalled = $false
try {
    $v = & node -v 2>$null
    if ($v) { $nodeInstalled = $true; Write-Host " -> Node.js ya esta instalado: $v" -ForegroundColor Gray }
} catch {}

if (-not $nodeInstalled) {
    Write-Host " -> Node.js no detectado. Instalando automaticamente con winget..." -ForegroundColor Yellow
    try {
        & winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
        # Refrescar PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        Write-Host " -> [OK] Node.js instalado con exito." -ForegroundColor Green
    } catch {
        Write-Host " -> Descargando instalador directo de Node.js LTS..." -ForegroundColor Yellow
        $nodeMsi = "$env:TEMP\node_setup.msi"
        Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi" -OutFile $nodeMsi
        Start-Process msiexec.exe -ArgumentList "/i `"$nodeMsi`" /qn /norestart" -Wait
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    }
}

# 3. Preparar Directorio de Instalacion
Write-Host "`n[2/6] Preparando carpeta de destino ($targetDir)..." -ForegroundColor Green
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

# 4. Descargar / Actualizar Codigo Fuente desde GitHub
Write-Host "`n[3/6] Descargando la ultima version oficial de la Suite..." -ForegroundColor Green
$zipPath = "$env:TEMP\suite_latest.zip"
$extractTemp = "$env:TEMP\suite_extracted"
if (Test-Path $extractTemp) { Remove-Item $extractTemp -Recurse -Force }

Invoke-WebRequest -Uri $repoZipUrl -OutFile $zipPath
Expand-Archive -Path $zipPath -DestinationPath $extractTemp -Force

# Copiar archivos a la carpeta final preservando configs locales si existen
$extractedFolder = Join-Path $extractTemp "suite-animalitos-main"
Get-ChildItem -Path $extractedFolder | ForEach-Object {
    $dest = Join-Path $targetDir $_.Name
    if ($_.Name -eq "config.json" -and (Test-Path $dest)) {
        # Preservar config local si ya existe
    } else {
        Copy-Item -Path $_.FullName -Destination $dest -Recurse -Force
    }
}
Remove-Item $zipPath -Force
Remove-Item $extractTemp -Recurse -Force
Write-Host " -> [OK] Archivos de la Suite actualizados en $targetDir." -ForegroundColor Green

# 4.1 Configurar este equipo como el Nodo de Pesca Dedicado y Principal (maquina_1)
$cfgFile = Join-Path $targetDir "config.json"
$configSynced = $false
try {
    # Intentar obtener la configuración oficial viva desde Render
    Write-Host " -> Sincronizando configuracion oficial desde la nube..." -ForegroundColor Gray
    $cloudCfg = Invoke-RestMethod -Uri "$masterUrl/api/config" -TimeoutSec 8
    if ($cloudCfg -and $cloudCfg.general) {
        $cloudCfg.general.maquinaLocalId = "maquina_1"
        $cloudCfg.general.maquinaEncargadaVerificacionesId = "maquina_1"
        if ($cloudCfg.general.maquinas) {
            foreach ($m in $cloudCfg.general.maquinas) {
                if ($m.id -eq "maquina_1") {
                    $m.activa = $true
                    $m.prioridad = 1
                    $m.esEncargadaVerificaciones = $true
                    $m.nombre = "Nodo Taquilla Dedicado (Producción)"
                }
                if ($m.id -eq "maquina_2") {
                    $m.esEncargadaVerificaciones = $false
                    $m.prioridad = 2
                }
            }
        }
        $cloudCfg | ConvertTo-Json -Depth 10 | Set-Content $cfgFile -Encoding UTF8
        $configSynced = $true
        Write-Host " -> [OK] Configuracion viva de la nube sincronizada con exito." -ForegroundColor Green
    }
} catch {
    Write-Host " -> [Info] Nube no disponible temporalmente. Aplicando configuracion base local..." -ForegroundColor Yellow
}

if (-not $configSynced -and (Test-Path $cfgFile)) {
    try {
        $cfgJson = Get-Content $cfgFile -Raw | ConvertFrom-Json
        if ($cfgJson.general) {
            $cfgJson.general.maquinaLocalId = "maquina_1"
            $cfgJson.general.maquinaEncargadaVerificacionesId = "maquina_1"
            if ($cfgJson.general.maquinas) {
                foreach ($m in $cfgJson.general.maquinas) {
                    if ($m.id -eq "maquina_1") {
                        $m.activa = $true
                        $m.prioridad = 1
                        $m.esEncargadaVerificaciones = $true
                        $m.nombre = "Nodo Taquilla Dedicado (Producción)"
                    }
                    if ($m.id -eq "maquina_2") {
                        $m.esEncargadaVerificaciones = $false
                        $m.prioridad = 2
                    }
                }
            }
        }
        $cfgJson | ConvertTo-Json -Depth 10 | Set-Content $cfgFile -Encoding UTF8
        Write-Host " -> [OK] Nodo preconfigurado como taquilla principal y verificadora (maquina_1)." -ForegroundColor Green
    } catch {
        Write-Host " -> [Aviso] Manteniendo config por defecto: $_" -ForegroundColor Yellow
    }
}

# 5. Instalar Binario del Tunel Cloudflare (cloudflared.exe)
Write-Host "`n[4/6] Verificando binario de tunel remoto Cloudflare..." -ForegroundColor Green
$cfExe = Join-Path $targetDir "cloudflared.exe"
if (-not (Test-Path $cfExe)) {
    Write-Host " -> Descargando cloudflared.exe para tunel de acceso remoto..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $cloudflaredUrl -OutFile $cfExe
    Write-Host " -> [OK] cloudflared.exe descargado." -ForegroundColor Green
}

# 6. Instalar Dependencias de Node.js
Write-Host "`n[5/6] Instalando dependencias de Node.js (express, etc.)..." -ForegroundColor Green
Set-Location -Path $targetDir
& npm install --omit=dev --silent 2>$null
Write-Host " -> [OK] Dependencias listas." -ForegroundColor Green

# 7. Crear Accesos Directos en el Escritorio
Write-Host "`n[6/6] Creando accesos directos en el Escritorio..." -ForegroundColor Green
$desktop = [Environment]::GetFolderPath('Desktop')
$ws = New-Object -ComObject WScript.Shell

# Acceso 1: Iniciar Suite
$s1 = $ws.CreateShortcut((Join-Path $desktop "INICIAR_SUITE.lnk"))
$s1.TargetPath = (Join-Path $targetDir "INICIAR_SUITE.bat")
$s1.WorkingDirectory = $targetDir
$s1.Save()

# Acceso 2: Actualizar Suite
$s2 = $ws.CreateShortcut((Join-Path $desktop "ACTUALIZAR_SUITE.lnk"))
$s2.TargetPath = (Join-Path $targetDir "ACTUALIZAR_DESDE_GITHUB.bat")
$s2.WorkingDirectory = $targetDir
$s2.Save()

# Acceso 3: Pruebas Paso a Paso
$s3 = $ws.CreateShortcut((Join-Path $desktop "PRUEBA_PASO_A_PASO.lnk"))
$s3.TargetPath = (Join-Path $targetDir "EJECUTAR_PRUEBA_PASO_A_PASO.bat")
$s3.WorkingDirectory = $targetDir
$s3.Save()

Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "    ¡INSTALACION COMPLETADA EXITOSAMENTE! 🚀" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Se han creado 3 accesos directos en tu Escritorio:" -ForegroundColor White
Write-Host "  1. [INICIAR_SUITE]        -> Arranca la taquilla y el tunel remoto" -ForegroundColor Cyan
Write-Host "  2. [ACTUALIZAR_SUITE]     -> Descarga mejoras de GitHub en 3 segundos" -ForegroundColor Cyan
Write-Host "  3. [PRUEBA_PASO_A_PASO]   -> Banco de calibracion y pruebas" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para arrancar este nodo de produccion:" -ForegroundColor Yellow
Write-Host "  1. Abre Premier Pluss con tu usuario de taquilla." -ForegroundColor White
Write-Host "  2. Dale doble clic al icono INICIAR_SUITE en el Escritorio." -ForegroundColor White
Write-Host ""
Write-Host "Presiona cualquier tecla para iniciar la Suite ahora mismo..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Start-Process (Join-Path $targetDir "INICIAR_SUITE.bat")
