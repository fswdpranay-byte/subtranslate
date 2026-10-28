# Generates the PWA / Play Store launcher icons with System.Drawing.
# Usage: npm run icons   (Windows PowerShell)
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'public\icons'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$targets = @(
  @{ Name = 'icon-192.png'; Size = 192; Maskable = $false },
  @{ Name = 'icon-512.png'; Size = 512; Maskable = $false },
  @{ Name = 'maskable-512.png'; Size = 512; Maskable = $true },
  @{ Name = 'apple-touch-icon.png'; Size = 180; Maskable = $false },
  @{ Name = 'favicon-32.png'; Size = 32; Maskable = $false }
)

function New-RoundedPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

foreach ($target in $targets) {
  $size = [int]$target.Size
  $maskable = [bool]$target.Maskable
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::Transparent)

  $padding = if ($maskable) { [float]($size * 0.14) } else { [float]($size * 0.02) }
  $tile = $size - ($padding * 2)
  $radius = [float]($tile * 0.24)

  if ($maskable) {
    $bg = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#0F172A'))
    $g.FillRectangle($bg, 0, 0, $size, $size)
    $bg.Dispose()
  }

  $rect = New-Object System.Drawing.RectangleF($padding, $padding, $tile, $tile)
  $path = New-RoundedPath $padding $padding $tile $tile $radius
  $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.ColorTranslator]::FromHtml('#22D3EE'),
    [System.Drawing.ColorTranslator]::FromHtml('#8B5CF6'),
    [float]45
  )
  $g.FillPath($gradient, $path)
  $gradient.Dispose()
  $path.Dispose()

  # Waveform bars
  $barColor = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#071018'))
  $heights = @(0.26, 0.48, 0.72, 0.44, 0.24)
  $barWidth = [float]($size * 0.072)
  $gap = [float]($size * 0.043)
  $totalWidth = ($barWidth * 5) + ($gap * 4)
  $startX = ($size - $totalWidth) / 2
  $centerY = [float]($size * 0.5)

  for ($i = 0; $i -lt 5; $i++) {
    $barHeight = [float]($size * $heights[$i])
    $x = $startX + ($i * ($barWidth + $gap))
    $y = $centerY - ($barHeight / 2)
    $barRadius = $barWidth / 2
    $barPath = New-RoundedPath $x $y $barWidth $barHeight $barRadius
    $g.FillPath($barColor, $barPath)
    $barPath.Dispose()
  }
  $barColor.Dispose()

  $file = Join-Path $outDir $target.Name
  $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  Write-Host "Generated $file"
}

# ---------------------------------------------------------------------------
# Android launcher icons (regenerated only when the android/ project exists)
# ---------------------------------------------------------------------------
$androidRes = Join-Path $root 'android\app\src\main\res'
if (Test-Path $androidRes) {
  $sourcePath = Join-Path $outDir 'icon-512.png'
  $source = [System.Drawing.Image]::FromFile($sourcePath)
  $densities = @(
    @{ Dir = 'mipmap-mdpi'; Size = 48 },
    @{ Dir = 'mipmap-hdpi'; Size = 72 },
    @{ Dir = 'mipmap-xhdpi'; Size = 96 },
    @{ Dir = 'mipmap-xxhdpi'; Size = 144 },
    @{ Dir = 'mipmap-xxxhdpi'; Size = 192 }
  )

  foreach ($density in $densities) {
    $size = [int]$density.Size
    $dir = Join-Path $androidRes $density.Dir
    New-Item -ItemType Directory -Force -Path $dir | Out-Null

    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.DrawImage($source, 0, 0, $size, $size)
    $bmp.Save((Join-Path $dir 'ic_launcher.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Save((Join-Path $dir 'ic_launcher_round.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()

    # Adaptive-icon foreground uses a 108dp canvas. Keep the artwork inside the
    # central 72dp safe zone so launcher masks never crop the waveform.
    $fgSize = [int]($size * 2.25)
    $artSize = [int]($fgSize * 0.72)
    $artOffset = [int](($fgSize - $artSize) / 2)
    $fg = New-Object System.Drawing.Bitmap($fgSize, $fgSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $fgGraphics = [System.Drawing.Graphics]::FromImage($fg)
    $fgGraphics.Clear([System.Drawing.Color]::Transparent)
    $fgGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $fgGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $fgGraphics.DrawImage($source, $artOffset, $artOffset, $artSize, $artSize)
    $fg.Save((Join-Path $dir 'ic_launcher_foreground.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $fgGraphics.Dispose()
    $fg.Dispose()

    Write-Host "Generated Android icons in $dir"
  }

  $source.Dispose()
}
