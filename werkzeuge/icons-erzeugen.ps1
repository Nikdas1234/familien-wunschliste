# Zeichnet das App-Symbol (Geschenk auf Terrakotta) in allen benötigten Größen:
# für die Web-App nach .\icons und für die Android-App nach .\android\app\src\main\res.
# Aufruf aus dem Projektordner:  .\werkzeuge\icons-erzeugen.ps1
Add-Type -AssemblyName System.Drawing

$projekt = Split-Path $PSScriptRoot -Parent
$web = Join-Path $projekt 'icons'
$res = Join-Path $projekt 'android\app\src\main\res'
New-Item -ItemType Directory -Force $web | Out-Null

# Form: 'Quadrat' = Fläche randlos, 'Kreis' = runde Fläche, 'Ohne' = nur das Motiv auf durchsichtigem Grund
function New-Icon([int]$Size, [string]$Pfad, [string]$Form = 'Quadrat') {
    $bmp = [System.Drawing.Bitmap]::new($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.Clear([System.Drawing.Color]::Transparent)

    $grund = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#b4432f'))
    $weiss = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#fff8f2'))
    $band = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#f2b84b'))
    $u = $Size / 100.0   # Raster 100 x 100; Motiv bleibt in der sicheren Mitte (für runde Android-Symbole)

    if ($Form -eq 'Quadrat') { $g.FillRectangle($grund, 0, 0, $Size, $Size) }
    if ($Form -eq 'Kreis') { $g.FillEllipse($grund, 0, 0, $Size, $Size) }

    # Schleife
    $stift = [System.Drawing.Pen]::new($band, [single](5 * $u))
    $g.DrawEllipse($stift, [single](35 * $u), [single](25 * $u), [single](15 * $u), [single](14 * $u))
    $g.DrawEllipse($stift, [single](50 * $u), [single](25 * $u), [single](15 * $u), [single](14 * $u))
    # Deckel und Schachtel
    $g.FillRectangle($weiss, [single](26 * $u), [single](38 * $u), [single](48 * $u), [single](11 * $u))
    $g.FillRectangle($weiss, [single](30 * $u), [single](52 * $u), [single](40 * $u), [single](24 * $u))
    # Band senkrecht
    $g.FillRectangle($band, [single](46 * $u), [single](38 * $u), [single](8 * $u), [single](38 * $u))

    $bmp.Save($Pfad, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
}

# Web-App
New-Icon 192 (Join-Path $web 'icon-192.png')
New-Icon 512 (Join-Path $web 'icon-512.png')
New-Icon 180 (Join-Path $web 'apple-touch-icon.png')

# Android: je Bildschirmdichte ein klassisches, ein rundes und ein Vordergrund-Symbol
if (Test-Path $res) {
    $dichten = @{ mdpi = 1; hdpi = 1.5; xhdpi = 2; xxhdpi = 3; xxxhdpi = 4 }
    foreach ($d in $dichten.GetEnumerator()) {
        $ordner = Join-Path $res "mipmap-$($d.Key)"
        New-Icon ([int](48 * $d.Value)) (Join-Path $ordner 'ic_launcher.png')
        New-Icon ([int](48 * $d.Value)) (Join-Path $ordner 'ic_launcher_round.png') 'Kreis'
        New-Icon ([int](108 * $d.Value)) (Join-Path $ordner 'ic_launcher_foreground.png') 'Ohne'
    }
}
"Symbole erzeugt."
