Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_guacharo_activo.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

Write-Output "--- Escaneando segundo checkbox (7:00p W) de X=420 a X=550 ---"
for ($x = 420; $x -lt 550; $x += 2) {
    $c = $bmp.GetPixel($x, 82)
    # Borde de casilla negra
    if ($c.R -lt 40 -and $c.G -lt 40 -and $c.B -lt 40) {
        $cInside = $bmp.GetPixel($x + 5, 87)
        if ($cInside.R -gt 200 -and $cInside.G -gt 200 -and $cInside.B -gt 200) {
            Write-Output "Segundo checkbox detectado en Logico X=$x, Y=82 -> Cursor 125%: X=$([math]::Round(($x+5)/1.25)), Y=$([math]::Round(87/1.25))"
        }
    }
}
$bmp.Dispose()
