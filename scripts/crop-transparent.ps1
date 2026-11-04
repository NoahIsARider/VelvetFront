param(
  [Parameter(Mandatory = $true)][string]$InputImage,
  [Parameter(Mandatory = $true)][string]$OutputImage,
  [int]$Padding = 8
)
Add-Type -AssemblyName System.Drawing
$source = [System.Drawing.Bitmap]::FromFile((Resolve-Path -LiteralPath $InputImage).Path)
try {
  $left = $source.Width; $top = $source.Height; $right = -1; $bottom = -1
  for ($y = 0; $y -lt $source.Height; $y++) {
    for ($x = 0; $x -lt $source.Width; $x++) {
      if ($source.GetPixel($x, $y).A -gt 8) {
        if ($x -lt $left) { $left = $x }; if ($x -gt $right) { $right = $x }
        if ($y -lt $top) { $top = $y }; if ($y -gt $bottom) { $bottom = $y }
      }
    }
  }
  $left = [Math]::Max(0, $left - $Padding); $top = [Math]::Max(0, $top - $Padding)
  $right = [Math]::Min($source.Width - 1, $right + $Padding); $bottom = [Math]::Min($source.Height - 1, $bottom + $Padding)
  $width = $right - $left + 1; $height = $bottom - $top + 1
  $target = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($target)
    try { $graphics.DrawImage($source, 0, 0, (New-Object System.Drawing.Rectangle $left,$top,$width,$height), [System.Drawing.GraphicsUnit]::Pixel) }
    finally { $graphics.Dispose() }
    $target.Save([System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputImage)), [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "${width}x${height}"
  } finally { $target.Dispose() }
} finally { $source.Dispose() }
