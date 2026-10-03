$w = New-Object -ComObject WScript.Shell
$target = "C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos\PROBAR_GRANJITA_TECLADO.bat"
$workDir = "C:\Users\Hector\.gemini\antigravity-ide\scratch\pronosticador_de_animalitos"
$name = "Probar La Granjita Teclado.lnk"

# 1. Escritorio estándar de Windows
$desktop = [Environment]::GetFolderPath('Desktop')
$s1 = $w.CreateShortcut((Join-Path $desktop $name))
$s1.TargetPath = $target
$s1.WorkingDirectory = $workDir
$s1.Description = "Prueba de entrada por teclado en La Granjita"
$s1.Save()
Write-Output "Acceso directo creado en: $desktop\$name"

# 2. C:\Users\Hector\Desktop (si es diferente)
$localDesktop = "C:\Users\Hector\Desktop"
if ((Test-Path $localDesktop) -and ($localDesktop -ne $desktop)) {
    $s2 = $w.CreateShortcut((Join-Path $localDesktop $name))
    $s2.TargetPath = $target
    $s2.WorkingDirectory = $workDir
    $s2.Save()
    Write-Output "Acceso directo creado en: $localDesktop\$name"
}

# 3. OneDrive Escritorio si existe
$oneDriveDesktop = "C:\Users\Hector\OneDrive\Escritorio"
if (Test-Path $oneDriveDesktop) {
    $s3 = $w.CreateShortcut((Join-Path $oneDriveDesktop $name))
    $s3.TargetPath = $target
    $s3.WorkingDirectory = $workDir
    $s3.Save()
    Write-Output "Acceso directo creado en: $oneDriveDesktop\$name"
}

$oneDriveDesktopEn = "C:\Users\Hector\OneDrive\Desktop"
if (Test-Path $oneDriveDesktopEn) {
    $s4 = $w.CreateShortcut((Join-Path $oneDriveDesktopEn $name))
    $s4.TargetPath = $target
    $s4.WorkingDirectory = $workDir
    $s4.Save()
    Write-Output "Acceso directo creado en: $oneDriveDesktopEn\$name"
}
