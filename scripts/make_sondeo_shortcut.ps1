$desktop = [Environment]::GetFolderPath('Desktop')
$w = New-Object -ComObject WScript.Shell
$s = $w.CreateShortcut((Join-Path $desktop "Probar Sondeo Seguro.lnk"))
$s.TargetPath = "C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos\PROBAR_SONDEO_CONTROLADO.bat"
$s.WorkingDirectory = "C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos"
$s.Description = "Prueba controlada de marcaje y limpieza segura con N"
$s.Save()

Write-Output "Acceso directo 'Probar Sondeo Seguro' creado en: $desktop\Probar Sondeo Seguro.lnk"
