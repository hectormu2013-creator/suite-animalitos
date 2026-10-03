$desktop = [Environment]::GetFolderPath('Desktop')
$w = New-Object -ComObject WScript.Shell
$s = $w.CreateShortcut((Join-Path $desktop "Capturar Guacharo.lnk"))
$s.TargetPath = "C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos\CAPTURAR_GUACHARO.bat"
$s.WorkingDirectory = "C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos"
$s.IconLocation = "shell32.dll,23"
$s.Description = "Seleccionar Guacharo Activo y Calibrar"
$s.Save()

Write-Output "Acceso directo creado con exito en: $desktop\Capturar Guacharo.lnk"
