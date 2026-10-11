$w = New-Object -ComObject WScript.Shell
$target = "C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos\PROBAR_LECTURA_CUPOS.bat"
$workDir = "C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos"
$name = "Probar Lectura Cupos.lnk"

$paths = @(
    [Environment]::GetFolderPath('Desktop'),
    "C:\Users\Hector\Desktop",
    "C:\Users\Hector\OneDrive\Escritorio",
    "C:\Users\Hector\OneDrive\Desktop"
) | Select-Object -Unique

foreach ($p in $paths) {
    if (Test-Path $p) {
        $s = $w.CreateShortcut((Join-Path $p $name))
        $s.TargetPath = $target
        $s.WorkingDirectory = $workDir
        $s.IconLocation = "shell32.dll,23"
        $s.Description = "Modulo de prueba aislado para lectura y deteccion de cupos cero"
        $s.Save()
        Write-Output "Acceso directo creado en: $p\$name"
    }
}
