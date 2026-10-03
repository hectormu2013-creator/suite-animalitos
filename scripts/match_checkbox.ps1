Add-Type -AssemblyName System.Drawing

$screenBmp = [System.Drawing.Bitmap]::FromFile("$PSScriptRoot\..\premier_guacharo_activo.png")
$upBmp = [System.Drawing.Bitmap]::FromFile("C:\Users\Hector\.gemini\antigravity-ide\brain\74a0f376-06d9-4223-bb37-11a143fd80c0\.user_uploaded\media_1790894090974.png")

# Cortar un fragmento de 16x16 del checkbox de la imagen subida (alrededor de X=170, Y=75)
$patch = $upBmp.Clone((New-Object System.Drawing.Rectangle 168, 73, 16, 16), $upBmp.PixelFormat)

for ($sy = 50; $sy -lt 140; $sy++) {
    for ($sx = 200; $sx -lt 500; $sx++) {
        # Comparar bordes
        $c1 = $screenBmp.GetPixel($sx, $sy)
        $c2 = $patch.GetPixel(0, 0)
        if ([math]::Abs($c1.R - $c2.R) -lt 30 -and [math]::Abs($c1.G - $c2.G) -lt 30 -and [math]::Abs($c1.B - $c2.B) -lt 30) {
            $c3 = $screenBmp.GetPixel($sx + 15, $sy + 15)
            $c4 = $patch.GetPixel(15, 15)
            if ([math]::Abs($c3.R - $c4.R) -lt 30 -and [math]::Abs($c3.G - $c4.G) -lt 30 -and [math]::Abs($c3.B - $c4.B) -lt 30) {
                $cInside = $screenBmp.GetPixel($sx + 5, $sy + 5)
                if ($cInside.R -gt 200) {
                    Write-Output "MATCH EXACTO DE CASILLA en Guacharo Activo: Logico X=$sx, Y=$sy -> Cursor 125%: X=$([math]::Round(($sx+7)/1.25)), Y=$([math]::Round(($sy+7)/1.25))"
                    $foundX = $sx
                    break
                }
            }
        }
    }
    if ($foundX) { break }
}

$patch.Dispose()
$upBmp.Dispose()
$screenBmp.Dispose()
