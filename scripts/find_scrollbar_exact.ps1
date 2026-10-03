Add-Type -AssemblyName System.Drawing
$b = [System.Drawing.Bitmap]::FromFile((Resolve-Path (Join-Path $PSScriptRoot "..\premier_tabla_sondeo.png")).Path)

# Busquemos la barra de desplazamiento entre X=770 y X=810
# A lo largo de Y=500
for ($x = 770; $x -le 810; $x++) {
    $c = $b.GetPixel($x, 500)
    Write-Output "X=$x : R=$($c.R), G=$($c.G), B=$($c.B)"
}
$b.Dispose()
