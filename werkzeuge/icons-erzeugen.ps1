# Zeichnet das App-Symbol (Geschenk auf Terrakotta) in den benötigten Größen nach .\icons.
# Aufruf aus dem Projektordner:  .\werkzeuge\icons-erzeugen.ps1
Add-Type -AssemblyName System.Drawing

$ziel = Join-Path (Split-Path $PSScriptRoot -Parent) 'icons'
New-Item -ItemType Directory -Force $ziel | Out-Null

function New-Icon([int]$Size, [string]$Name) {
    $bmp = [System.Drawing.Bitmap]::new($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#b4432f'))

    $weiss = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#fff8f2'))
    $band = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#f2b84b'))
    $u = $Size / 100.0   # Raster 100 x 100; Motiv bleibt in der sicheren Mitte (für runde Android-Symbole)

    # Schleife
    $stift = [System.Drawing.Pen]::new($band, [single](5 * $u))
    $g.DrawEllipse($stift, [single](35 * $u), [single](25 * $u), [single](15 * $u), [single](14 * $u))
    $g.DrawEllipse($stift, [single](50 * $u), [single](25 * $u), [single](15 * $u), [single](14 * $u))
    # Deckel und Schachtel
    $g.FillRectangle($weiss, [single](26 * $u), [single](38 * $u), [single](48 * $u), [single](11 * $u))
    $g.FillRectangle($weiss, [single](30 * $u), [single](52 * $u), [single](40 * $u), [single](24 * $u))
    # Band senkrecht
    $g.FillRectangle($band, [single](46 * $u), [single](38 * $u), [single](8 * $u), [single](38 * $u))

    $bmp.Save((Join-Path $ziel $Name), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
}

New-Icon 192 'icon-192.png'
New-Icon 512 'icon-512.png'
New-Icon 180 'apple-touch-icon.png'
Get-ChildItem $ziel -Filter *.png | Select-Object Name, Length
