try {
    [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if ($engine) {
        Write-Output "Windows OCR disponible. Idioma: $($engine.RecognizerLanguage.DisplayName)"
    } else {
        Write-Output "Windows OCR no disponible directamente por perfil de idioma."
    }
} catch {
    Write-Output "Windows OCR no disponible: $($_.Exception.Message)"
}
