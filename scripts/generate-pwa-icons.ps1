Add-Type -AssemblyName System.Drawing
$sourcePath = Join-Path $PSScriptRoot "..\public\images\avsec-salem-logo.png"
if (-not (Test-Path $sourcePath)) {
    Write-Error "Source logo not found at $sourcePath"
    exit 1
}

$srcBmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path $sourcePath).Path)

function Resize-Image($src, $w, $h, $padRatio, $outPath, $bgColor) {
    $destBmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    if ($bgColor -ne $null) {
        $brush = New-Object System.Drawing.SolidBrush($bgColor)
        $g.FillRectangle($brush, 0, 0, $w, $h)
        $brush.Dispose()
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }

    $destW = [int]($w * $padRatio)
    $destH = [int]($h * $padRatio)
    $destX = [int](($w - $destW) / 2)
    $destY = [int](($h - $destH) / 2)

    $g.DrawImage($src, $destX, $destY, $destW, $destH)
    $g.Dispose()

    $destBmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
    Write-Host "Generated: $outPath ($w x $h)"
}

$imgDir = Join-Path $PSScriptRoot "..\public\images"
Resize-Image $srcBmp 192 192 1.0 (Join-Path $imgDir "pwa-icon-192.png") $null
Resize-Image $srcBmp 512 512 1.0 (Join-Path $imgDir "pwa-icon-512.png") $null
Resize-Image $srcBmp 512 512 0.8 (Join-Path $imgDir "pwa-icon-maskable-512.png") ([System.Drawing.Color]::White)

$srcBmp.Dispose()
Write-Host "PWA icons generation complete."
