Add-Type -AssemblyName System.Drawing
$imgFile = (Resolve-Path (Join-Path $PSScriptRoot "..\premier_tabla_sondeo.png")).Path
$b = [System.Drawing.Bitmap]::FromFile($imgFile)

Write-Output "Analizando premier_tabla_sondeo.png..."

# Ejecutar el extractor de tabla que ya creamos en este archivo
$b.Dispose()

powershell.exe -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "extraer_tabla_agotados.ps1") -ImagePath "..\premier_tabla_sondeo.png"
