Add-Type -AssemblyName System.Drawing
$b = [System.Drawing.Bitmap]::FromFile("$PSScriptRoot/../crop_buttons.png")

# Analizar la fila Y=28 (que es Y=68 absoluta)
Write-Output "Analizando fila Y=28 en crop_buttons:"
$inBtn = $false
$btnStart = 0
for ($x = 0; $x -lt $b.Width; $x++) {
    $p = $b.GetPixel($x, 28)
    # Azul del boton: R < 50, G > 120, B > 200
    $isBlue = ($p.B -gt 180 -and $p.R -lt 80 -and $p.G -gt 100)
    if ($isBlue -and -not $inBtn) {
        $inBtn = $true
        $btnStart = $x
    } elseif (-not $isBlue -and $inBtn) {
        $inBtn = $false
        $btnEnd = $x - 1
        $w = $btnEnd - $btnStart + 1
        if ($w -gt 10) {
            $cenRel = [int](($btnStart + $btnEnd) / 2)
            $cenAbs = 1100 + $cenRel
            Write-Output "Boton Azul: RelX=[$btnStart..$btnEnd] (Ancho: $w), CentroAbsX=$cenAbs"
        }
    }
}
$b.Dispose()
