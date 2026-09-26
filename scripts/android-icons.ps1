# Regenerates Android launcher icons from the studio mark without cropping.
#
#   powershell -ExecutionPolicy Bypass -File scripts/android-icons.ps1
#
# The R in rs-logo.png already fills most of its tile, so we shrink further:
# legacy mipmaps 58%, adaptive foreground 52% (inside Android's ~66% safe
# zone) — letterboxed, never cropped.
param(
  [string]$Source = (Join-Path $PSScriptRoot '..\src\web\rs-logo.png'),
  [string]$Res = (Join-Path $PSScriptRoot '..\android\app\src\main\res'),
  [double]$LegacyScale = 0.58,
  [double]$AdaptiveScale = 0.52
)

Add-Type -AssemblyName System.Drawing

function New-PaddedIcon {
  param(
    [string]$SourcePath,
    [string]$DestPath,
    [int]$Size,
    [double]$ContentScale = 0.58
  )
  $src = [System.Drawing.Image]::FromFile((Resolve-Path $SourcePath))
  try {
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::White)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $content = [int][Math]::Floor($Size * $ContentScale)
    if ($content % 2 -ne 0) { $content -= 1 }
    $boxX = [int](($Size - $content) / 2)
    $scale = [Math]::Min($content / $src.Width, $content / $src.Height)
    $dw = [int][Math]::Floor($src.Width * $scale)
    $dh = [int][Math]::Floor($src.Height * $scale)
    $dx = $boxX + [int](($content - $dw) / 2)
    $dy = $boxX + [int](($content - $dh) / 2)
    $g.DrawImage($src, (New-Object System.Drawing.Rectangle $dx, $dy, $dw, $dh))
    $g.Dispose()
    $dir = Split-Path $DestPath -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $bmp.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "wrote $DestPath ($Size @ $ContentScale)"
  } finally {
    $src.Dispose()
  }
}

$map = @{
  'mipmap-mdpi' = 48
  'mipmap-hdpi' = 72
  'mipmap-xhdpi' = 96
  'mipmap-xxhdpi' = 144
  'mipmap-xxxhdpi' = 192
}
foreach ($kv in $map.GetEnumerator()) {
  $dir = Join-Path $Res $kv.Key
  New-PaddedIcon -SourcePath $Source -DestPath (Join-Path $dir 'ic_launcher.png') -Size $kv.Value -ContentScale $LegacyScale
  New-PaddedIcon -SourcePath $Source -DestPath (Join-Path $dir 'ic_launcher_round.png') -Size $kv.Value -ContentScale $LegacyScale
}

New-Item -ItemType Directory -Force -Path (Join-Path $Res 'drawable') | Out-Null
New-PaddedIcon -SourcePath $Source -DestPath (Join-Path $Res 'drawable\ic_launcher_foreground.png') -Size 432 -ContentScale $AdaptiveScale
