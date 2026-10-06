# Regenerates the launcher icons from rs-cursor-logo.png (1024x1024, dark rounded square).
# Run from anywhere: powershell -File android/branding/make-icons.ps1
Add-Type -AssemblyName System.Drawing
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$res = Join-Path $here '..\app\src\main\res'
$src = [System.Drawing.Bitmap]::FromFile((Join-Path $here 'rs-cursor-logo.png'))
$bg = [System.Drawing.ColorTranslator]::FromHtml('#14120B')

function New-Canvas([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    return @($bmp, $g)
}

# Draw the logo centred at $scale of the canvas.
function Draw-Logo($g, [int]$size, [double]$scale) {
    $w = [int]([math]::Round($size * $scale))
    $o = [int](($size - $w) / 2)
    $g.DrawImage($src, $o, $o, $w, $w)
}

function Save($bmp, $g, [string]$path) {
    $g.Dispose()
    New-Item -ItemType Directory -Force (Split-Path $path) | Out-Null
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

# Adaptive foreground: 108dp canvas at 4x. The hexagon is ~63% of the logo; at
# 0.92 it spans ~58% of the canvas, inside the 66dp safe circle. The logo's own
# dark square blends into the matching background colour.
$fg = New-Canvas 432
Draw-Logo $fg[1] 432 0.92
Save $fg[0] $fg[1] (Join-Path $res 'drawable\ic_launcher_foreground.png')

$sizes = @{ 'mdpi' = 48; 'hdpi' = 72; 'xhdpi' = 96; 'xxhdpi' = 144; 'xxxhdpi' = 192 }
foreach ($d in $sizes.Keys) {
    $s = $sizes[$d]
    # Legacy square: the logo as drawn, rounded corners and all.
    $sq = New-Canvas $s
    Draw-Logo $sq[1] $s 1.0
    Save $sq[0] $sq[1] (Join-Path $res "mipmap-$d\ic_launcher.png")

    # Legacy round: dark disc, logo clipped to it.
    $rd = New-Canvas $s
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(0, 0, $s - 1, $s - 1)
    $brush = New-Object System.Drawing.SolidBrush $bg
    $rd[1].FillPath($brush, $path)
    $rd[1].SetClip($path)
    Draw-Logo $rd[1] $s 1.12
    $brush.Dispose(); $path.Dispose()
    Save $rd[0] $rd[1] (Join-Path $res "mipmap-$d\ic_launcher_round.png")
}
$src.Dispose()
Write-Output 'icons written'
