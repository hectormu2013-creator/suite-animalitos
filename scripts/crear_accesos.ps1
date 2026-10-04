$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')

$s1 = $ws.CreateShortcut((Join-Path $desktop "PRUEBA_PASO_A_PASO.lnk"))
$s1.TargetPath = "C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos\EJECUTAR_PRUEBA_PASO_A_PASO.bat"
$s1.WorkingDirectory = "C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos"
$s1.Save()

$s2 = $ws.CreateShortcut((Join-Path $desktop "INICIAR_SUITE.lnk"))
$s2.TargetPath = "C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos\INICIAR_SUITE.bat"
$s2.WorkingDirectory = "C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos"
$s2.Save()

Start-Process "explorer.exe" -ArgumentList "C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos"
Write-Output "Accesos directos creados en el Escritorio y carpeta abierta en Explorador."
