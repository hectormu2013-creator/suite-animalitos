param(
    [int]$Paso = 1,
    [string]$Loteria = "GUACHARO ACTIVO"
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.WindowsRuntime

# Registrar tipos WinRT para OCR nativo de Windows
[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.FileAccessMode, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null

$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
}[0]

function Await($asyncOp, $type) {
    $m = $asTaskGeneric.MakeGenericMethod($type)
    $task = $m.Invoke($null, @($asyncOp))
    $task.Wait()
    return $task.Result
}

function BuscarPosicionLoteriaPorOCR($bmpPantalla, $nombreLoteria) {
    # Recortar la columna de loterias (X: 10 a 360, Y: 80 a 580)
    $cropX = 10
    $cropY = 80
    $cropW = 350
    $cropH = 500

    $rect = New-Object System.Drawing.Rectangle $cropX, $cropY, $cropW, $cropH
    $crop = $bmpPantalla.Clone($rect, $bmpPantalla.PixelFormat)
    $tempOcrLot = Join-Path $PSScriptRoot "temp_ocr_step_find.png"
    $crop.Save($tempOcrLot, [System.Drawing.Imaging.ImageFormat]::Png)
    $crop.Dispose()

    try {
        $storageFile = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync([System.IO.Path]::GetFullPath($tempOcrLot))) ([Windows.Storage.StorageFile])
        $stream = Await ($storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
        $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $softwareBitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
        if ($null -eq $engine) {
            $lang = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | Where-Object { $_.LanguageTag -like "es*" } | Select-Object -First 1
            if (-not $lang) {
                $lang = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | Select-Object -First 1
            }
            if ($lang) {
                $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
            }
        }
        $ocrRes = Await ($engine.RecognizeAsync($softwareBitmap)) ([Windows.Media.Ocr.OcrResult])

        Write-Host " -> [OCR INFO] Lineas de texto detectadas en el menu lateral: $(@($ocrRes.Lines).Count)" -ForegroundColor Cyan
        $nomUpper = $nombreLoteria.ToUpper().Trim()

        foreach ($line in $ocrRes.Lines) {
            $rawText = $line.Text.Trim()
            $t = $rawText.ToUpper()

            # Normalizar variaciones de OCR sobre LOTTO: [OTTO, 1OTTO, |OTTO, IOTTO, OTTO ACTIVO -> LOTTO
            $tNorm = $t -replace '[\[\|1!I]OTTO', 'LOTTO'
            $tNorm = $tNorm -replace 'LOTO', 'LOTTO'
            if ($tNorm -like "*OTTO ACTIVO*") {
                $tNorm = $tNorm -replace 'OTTO ACTIVO', 'LOTTO ACTIVO'
            }

            # Extraer el nombre base removiendo conteos de sorteos como (1), (3), (I), "), etc.
            $delim = @('(', '[', '"', "'", '=', ')', ']')
            $tBase = $tNorm.Split($delim, [System.StringSplitOptions]::RemoveEmptyEntries)[0].Trim()

            $match = $false

            if ($nomUpper -like "*RICACHONA*") {
                if ($tBase -like "*RICACHONA*") { $match = $true }
            } elseif ($nomUpper -like "*GRANJITA*PLUS*") {
                if ($tBase -like "*GRANJITA*PLUS*") { $match = $true }
            } elseif ($nomUpper -like "*GRANJITA*") {
                if ($tBase -like "*GRANJITA*" -and $tBase -notlike "*PLUS*") { $match = $true }
            } elseif ($nomUpper -like "*CENTENA*PLUS*") {
                if ($tBase -like "*CENTENA*PLUS*" -or $tBase -like "*CENTENA*PTUS*") { $match = $true }
            } elseif ($nomUpper -like "*CENTENA*") {
                if ($tBase -like "*CENTENA*" -and $tBase -notlike "*PLUS*" -and $tBase -notlike "*PTUS*") { $match = $true }
            } elseif ($nomUpper -like "*CHANCE*") {
                if ($tBase -like "*CHANCE*") { $match = $true }
            } elseif ($nomUpper -like "*MILLONARIO*") {
                if ($tBase -like "*MILLONARIO*" -or $tBase -like "*GUACHARITO*") { $match = $true }
            } elseif ($nomUpper -like "*GUACHARO*") {
                if ($tBase -like "*GUACHARO*" -and $tBase -notlike "*MILLONARIO*" -and $tBase -notlike "*GUACHARITO*") { $match = $true }
            } elseif ($nomUpper -like "*LOTTO*INT*") {
                if ($tNorm -like "*LOTTO*INT*" -or $tNorm -like "*LOTTO*'NT*" -or $tNorm -like "*LOTTO*ACTIVO*INT*") { $match = $true }
            } elseif ($nomUpper -like "*LOTTO*") {
                # LOTTO ACTIVO NACIONAL: debe coincidir con LOTTO, OTTO o ACTIVO, pero NO ser Internacional ('NT, INT, INTERNACIONAL, etc.) ni Guacharo
                $esGuacharo = ($tNorm -like "*GUACHAR*")
                $esInt = ($tNorm -like "*INT*" -or $tNorm -like "*'NT*" -or $tNorm -like "*INTERNACIONAL*")
                $tieneLottoU_Otto = ($tNorm -like "*LOTTO*" -or $tNorm -like "*OTTO*")
                $tieneActivo = ($tNorm -like "*ACTIVO*")

                if (($tieneLottoU_Otto -or $tieneActivo) -and -not $esGuacharo -and -not $esInt) {
                    $match = $true
                }
            } elseif ($nomUpper -like "*MEGA*") {
                if ($tBase -like "*MEGA*") { $match = $true }
            } elseif ($nomUpper -like "*SELVA*") {
                if ($tBase -like "*SELVA*") { $match = $true }
            } else {
                if ($tBase -like ("*" + $nomUpper + "*")) { $match = $true }
            }

            if ($match) {
                Write-Host " -> [OCR OK] Coincidencia encontrada: '$rawText' para '$nombreLoteria'" -ForegroundColor Green
                $firstWord = $null
                foreach ($w in $line.Words) { $firstWord = $w; break }
                $topY = [int]$firstWord.BoundingRect.Y
                $h = [int]$firstWord.BoundingRect.Height
                $screenY = $cropY + $topY + [int]($h / 2)
                return [PSCustomObject]@{
                    Encontrado = $true
                    Y = $screenY
                    TextoDetectado = $rawText
                }
            }
        }
    } catch {
        Write-Host " -> [AVISO OCR] Error durante escaneo de loterias: $($_.Exception.Message)" -ForegroundColor Yellow
    } finally {
        if (Test-Path $tempOcrLot) { Remove-Item $tempOcrLot -Force -ErrorAction SilentlyContinue }
    }

    return [PSCustomObject]@{
        Encontrado = $false
        Y = 0
        TextoDetectado = ""
    }
}

Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

public class StepTester {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    public delegate bool EnumChildProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumChildWindows(IntPtr hWndParent, EnumChildProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, UIntPtr dwExtraInfo);

    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP   = 0x0004;

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    public const uint BM_CLICK = 0x00F5;

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left, Top, Right, Bottom;
    }

    public static bool DismissExceptionDialog(IntPtr parent) {
        IntPtr btn = IntPtr.Zero;
        EnumChildWindows(parent, (ch, cl) => {
            StringBuilder t = new StringBuilder(256);
            GetWindowText(ch, t, 256);
            string txt = t.ToString().Trim();
            if (txt.Equals("Continuar", StringComparison.OrdinalIgnoreCase) || txt.Equals("&Continuar", StringComparison.OrdinalIgnoreCase)) {
                btn = ch;
                return false;
            }
            return true;
        }, IntPtr.Zero);

        if (btn != IntPtr.Zero) {
            SendMessage(btn, BM_CLICK, IntPtr.Zero, IntPtr.Zero);
            return true;
        }
        return false;
    }

    public static bool DismissAllExceptions() {
        bool dismissed = false;
        EnumWindows((hWnd, lParam) => {
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            try {
                Process p = Process.GetProcessById((int)pid);
                if (p.ProcessName.Equals("PremierPlussPC20", StringComparison.OrdinalIgnoreCase)) {
                    if (DismissExceptionDialog(hWnd)) {
                        dismissed = true;
                    }
                }
            } catch {}
            return true;
        }, IntPtr.Zero);
        return dismissed;
    }

    public static IntPtr FindPremier() {
        IntPtr found = IntPtr.Zero;
        try {
            Process[] procs = Process.GetProcessesByName("PremierPlussPC20");
            foreach (Process p in procs) {
                IntPtr mw = p.MainWindowHandle;
                if (mw != IntPtr.Zero) {
                    found = mw;
                    break;
                }
            }
        } catch {}

        if (found == IntPtr.Zero) {
            EnumWindows((hWnd, lParam) => {
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                try {
                    Process p = Process.GetProcessById((int)pid);
                    if (p.ProcessName.Equals("PremierPlussPC20", StringComparison.OrdinalIgnoreCase)) {
                        RECT r;
                        GetWindowRect(hWnd, out r);
                        int w = r.Right - r.Left;
                        int h = r.Bottom - r.Top;
                        bool vis = IsWindowVisible(hWnd);
                        bool min = IsIconic(hWnd);
                        if (min || (vis && w > 300 && h > 200)) {
                            found = hWnd;
                            return false;
                        }
                        if (found == IntPtr.Zero) {
                            found = hWnd;
                        }
                    }
                } catch {}
                return true;
            }, IntPtr.Zero);
        }

        return found;
    }

    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
    }
}
"@

[StepTester]::SetProcessDPIAware() | Out-Null

function ObtenerCasillasMarcadas($bmpPantalla, $panelLeft = 320, $panelTop = 35, $panelWidth = 580, $panelHeight = 95) {
    $w = [Math]::Min($panelWidth, ($bmpPantalla.Width - $panelLeft))
    $h = [Math]::Min($panelHeight, ($bmpPantalla.Height - $panelTop))
    if ($w -le 0 -or $h -le 0) { return @() }
    $rect = New-Object System.Drawing.Rectangle $panelLeft, $panelTop, $w, $h
    $crop = $bmpPantalla.Clone($rect, $bmpPantalla.PixelFormat)

    $greenPoints = @()
    for ($y = 0; $y -lt $crop.Height; $y++) {
        for ($x = 0; $x -lt $crop.Width; $x++) {
            $c = $crop.GetPixel($x, $y)
            if ($c.G -gt 130 -and $c.G -gt ($c.R + 40) -and $c.G -gt ($c.B + 40)) {
                $greenPoints += [PSCustomObject]@{ X = $x; Y = $y }
            }
        }
    }
    $crop.Dispose()

    $clusters = @()
    foreach ($pt in $greenPoints) {
        $foundCl = $null
        foreach ($cl in $clusters) {
            if ([Math]::Abs($cl.X - $pt.X) -le 25 -and [Math]::Abs($cl.Y - $pt.Y) -le 20) {
                $foundCl = $cl
                break
            }
        }
        if ($foundCl) {
            $foundCl.Count++
            $foundCl.SumX += $pt.X
            $foundCl.SumY += $pt.Y
        } else {
            $clusters += [PSCustomObject]@{
                X = $pt.X
                Y = $pt.Y
                SumX = $pt.X
                SumY = $pt.Y
                Count = 1
            }
        }
    }

    $cajas = @()
    foreach ($cl in $clusters) {
        if ($cl.Count -ge 20) {
            $cajas += [PSCustomObject]@{
                X = $panelLeft + [int]($cl.SumX / $cl.Count)
                Y = $panelTop + [int]($cl.SumY / $cl.Count)
                CropX = [int]($cl.SumX / $cl.Count)
                CropY = [int]($cl.SumY / $cl.Count)
                Pixels = $cl.Count
            }
        }
    }
    return $cajas
}

function AsegurarSoloProximoSorteo($isTester = $true) {
    Write-Output " -> [SORTEO] Verificando casillas de sorteo marcadas en pantalla..."
    Start-Sleep -Milliseconds 250
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmpScreen = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $g = [System.Drawing.Graphics]::FromImage($bmpScreen)
    $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $g.Dispose()

    $marcadas = ObtenerCasillasMarcadas $bmpScreen 320 35 580 95
    $bmpScreen.Dispose()

    $hayNoDeseados = $false
    foreach ($m in $marcadas) {
        $esQ = ($m.CropX -lt 90 -and $m.CropY -lt 38)
        if (-not $esQ) {
            $hayNoDeseados = $true
            break
        }
    }

    if ($hayNoDeseados -or $marcadas.Count -gt 1) {
        Write-Output " -> [SORTEO] Detectadas casillas marcadas previamente ($($marcadas.Count)). Limpiando..."
        foreach ($m in $marcadas) {
            Write-Output "    -> Desmarcando casilla en X=$($m.X), Y=$($m.Y)..."
            if ($isTester) {
                [StepTester]::Click($m.X, $m.Y)
            } else {
                [PremierFullProbe]::Click($m.X, $m.Y)
            }
            Start-Sleep -Milliseconds 120
        }
        Start-Sleep -Milliseconds 200
        Write-Output " -> [SORTEO] Marcando exclusivamente el proximo sorteo con tecla 'Q'..."
        try { [System.Windows.Forms.SendKeys]::SendWait("q") } catch {}
        Start-Sleep -Milliseconds 250
    } elseif ($marcadas.Count -eq 1) {
        Write-Output " -> [SORTEO] El proximo sorteo (Q) ya esta marcado correctamente."
    } else {
        Write-Output " -> [SORTEO] Ningun sorteo marcado. Marcando proximo sorteo con tecla 'Q'..."
        try { [System.Windows.Forms.SendKeys]::SendWait("q") } catch {}
        Start-Sleep -Milliseconds 250
    }
}

$hwnd = [StepTester]::FindPremier()
if ($hwnd -eq [IntPtr]::Zero) {
    Write-Output "[ERROR] Premier Pluss 2.0 no esta abierto en el escritorio."
    Write-Output "Por favor abre la taquilla de Premier Pluss y vuelve a intentarlo."
    exit 1
}

Write-Output "=========================================================="
Write-Output "  PREMIER PLUSS 2.0 DETECTADO (HWND: $hwnd)"
Write-Output "=========================================================="

switch ($Paso) {
    1 {
        Write-Output "`n[PASO 1] Enfocando Premier Pluss y descartando errores previos..."
        [StepTester]::ShowWindow($hwnd, 9) | Out-Null
        [StepTester]::ShowWindow($hwnd, 3) | Out-Null
        [StepTester]::SetForegroundWindow($hwnd) | Out-Null
        Start-Sleep -Milliseconds 400

        $descartado = [StepTester]::DismissAllExceptions()
        if ($descartado) {
            Write-Output " -> [OK] Se detecto el cuadro de error y se pulso 'Continuar' automaticamente."
        } else {
            # Intentar tambien con Enter en caso de que sea un cuadro estandar
            try { [System.Windows.Forms.SendKeys]::SendWait("{ENTER}") } catch {}
            Write-Output " -> [OK] Ventana enfocada."
        }
        Start-Sleep -Milliseconds 300
        Write-Output " -> Asegurando pestana ANIMALITOS (F2)..."
        try { [System.Windows.Forms.SendKeys]::SendWait("{F2}") } catch {}
        Write-Output " -> [OK] Premier Pluss en pestana Animalitos y listo."
    }

    2 {
        Write-Output "`n[PASO 2] Localizando Loteria ($Loteria) mediante OCR visual y Marcando Sorteo..."
        [StepTester]::ShowWindow($hwnd, 9) | Out-Null
        [StepTester]::ShowWindow($hwnd, 3) | Out-Null
        [StepTester]::SetForegroundWindow($hwnd) | Out-Null
        Start-Sleep -Milliseconds 600

        Write-Output " -> Asegurando pestana ANIMALITOS con tecla F2..."
        try {
            [System.Windows.Forms.SendKeys]::SendWait("{F2}")
            Start-Sleep -Milliseconds 400
        } catch {}

        Write-Output " -> Escaneando columna de loterias mediante OCR visual en tiempo real..."
        $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bmpScreen = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
        $g = [System.Drawing.Graphics]::FromImage($bmpScreen)
        $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
        $g.Dispose()

        $pos = BuscarPosicionLoteriaPorOCR $bmpScreen $Loteria
        $bmpScreen.Dispose()

        if (-not $pos.Encontrado -or $pos.Y -le 0) {
            Write-Output "`n❌ [ALERTA OCR] La loteria '$Loteria' no se encuentra visible en el menu de Premier Pluss."
            Write-Output " -> Causa: Todos sus sorteos del dia ya concluyeron (o aun no han abierto)."
            Write-Output " -> Medida de seguridad: Se aborta la seleccion para evitar clics accidentales en otra loteria."
            break
        }

        $lotY = $pos.Y
        Write-Output " -> [OCR EXITO] '$($pos.TextoDetectado)' encontrada exactamente en Y=$lotY."
        Write-Output " -> Haciendo clic en X=135, Y=$lotY..."
        [StepTester]::Click(135, $lotY)
        Start-Sleep -Milliseconds 600

        # Asegurar que no haya sorteos previos marcados y marcar exclusivamente el proximo (Q)
        AsegurarSoloProximoSorteo $true

        Write-Output "`n[VERIFICACION] Mira la pantalla de Premier Pluss: ¿Esta seleccionada la loteria ($Loteria) y marcada la casilla del sorteo?"
    }

    3 {
        Write-Output "`n[PASO 3] Probando Inyeccion Rapida de 3 Animales de Prueba (Monto 3000 Bs)..."
        [StepTester]::ShowWindow($hwnd, 9) | Out-Null
        [StepTester]::ShowWindow($hwnd, 3) | Out-Null
        [StepTester]::SetForegroundWindow($hwnd) | Out-Null
        Start-Sleep -Milliseconds 300

        # Precargar Monto F6
        Write-Output " -> Precargando monto 3000 Bs en F6..."
        [System.Windows.Forms.SendKeys]::SendWait("{F6}")
        Start-Sleep -Milliseconds 150
        [System.Windows.Forms.SendKeys]::SendWait("3000")
        Start-Sleep -Milliseconds 150
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
        Start-Sleep -Milliseconds 250

        # Ingresar 3 animales: 00, 0, 1
        $testAnimals = @("00", "0", "1")
        Write-Output " -> Ingresando 3 animales a velocidad ultrarrapida..."
        foreach ($a in $testAnimals) {
            Write-Host "    -> Ingresando animal '$a'..."
            [System.Windows.Forms.SendKeys]::SendWait("{F5}")
            Start-Sleep -Milliseconds 35
            [System.Windows.Forms.SendKeys]::SendWait("$a")
            Start-Sleep -Milliseconds 40
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            Start-Sleep -Milliseconds 50
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            Start-Sleep -Milliseconds 120
        }

        Write-Output "`n[VERIFICACION] ¿Aparecieron los 3 animales en la lista 'Jugadas del ticket' sin ningun error?"
    }

    4 {
        Write-Output "`n[PASO 4] Cancelando jugadas y limpiando pantalla de Premier con Tecla 'N'..."
        [StepTester]::ShowWindow($hwnd, 9) | Out-Null
        [StepTester]::ShowWindow($hwnd, 3) | Out-Null
        [StepTester]::SetForegroundWindow($hwnd) | Out-Null
        Start-Sleep -Milliseconds 200

        try {
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            Start-Sleep -Milliseconds 200
            [System.Windows.Forms.SendKeys]::SendWait("n")
            Start-Sleep -Milliseconds 300
            [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
            Start-Sleep -Milliseconds 200
        } catch {}

        Write-Output " -> [OK] Pantalla restablecida a 0 jugadas."
        Write-Output "`n[VERIFICACION] ¿Quedo la pantalla limpia en 0 jugadas?"
    }
}
