Add-Type -AssemblyName System.Drawing

$imgFile = Join-Path $PSScriptRoot "..\premier_pantalla_calibrada.png"
$bmp = [System.Drawing.Bitmap]::FromFile($imgFile)

Write-Output "=== ANALISIS DE ELEMENTOS DE PANTALLA PREMIER PLUSS 2.0 ==="

# 1. LOTERIAS (X: 15 a 235)
# Cada fila tiene un alto aproximado
# Fila 0 (Encabezado azul: ANIMALITOS LA RICACHONA): Y ≈ 152 a 178
# Fila 1 (GRANJITA PLUS): Y ≈ 179 a 204
# Fila 2 (LA GRANJITA): Y ≈ 205 a 230
# Fila 3 (CENTENA ANIMALITOS): Y ≈ 231 a 256
# Fila 4 (CENTENA PLUS): Y ≈ 257 a 282
# Fila 5 (CHANCE ANIMAL A): Y ≈ 283 a 308
# Fila 6 (GUACHARITO MILLONARIO): Y ≈ 309 a 334
# Fila 7 (GUACHARO ACTIVO): Y ≈ 335 a 360
# Fila 8 (LOTTO ACTIVO): Y ≈ 361 a 386

# Verificamos color de texto o borde en cada fila
for ($row = 0; $row -le 11; $row++) {
    $y = 165 + ($row * 27)
    Write-Output "Fila Lotería $row -> Centro estimado: X=120, Y=$y"
}

# 2. BOTONES SUPERIORES (Y ≈ 82)
# Imprimir (Printer icon): X ≈ 1285, Y ≈ 82
# Agregar (+): X ≈ 1335, Y ≈ 82
# Moneda (Bs): X ≈ 1385, Y ≈ 82
# Input NUM (F5): X ≈ 955, Y ≈ 82
# Input MONTO (F6): X ≈ 1075, Y ≈ 82

# 3. TABLA DE JUGADAS (X ≈ 900 a 1530, Y ≈ 120 a 700)
# Columnas: Num (X ≈ 935), Nombre (X ≈ 1080), Monto (X ≈ 1350)

# 4. BOTON NUEVO (N) / CANCELAR
# ¿Cómo se limpia un ticket en Premier Pluss?
# Atajo estándar: N o Alt+N o F2 o Escape o Ctrl+N o botón "Nuevo" si existe
# O borrado de fila

$bmp.Dispose()
