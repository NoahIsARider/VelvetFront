param(
  [Parameter(Mandatory = $true)][string]$Atlas,
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [Parameter(Mandatory = $true)][string]$Prefix,
  [int]$Columns = 4,
  [int]$Rows = 4,
  [int]$CanvasSize = 384,
  [int]$SafeSize = 304
)

Add-Type -AssemblyName System.Drawing
$atlasPath = (Resolve-Path -LiteralPath $Atlas).Path
$outputPath = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputDirectory))
$workspacePath = [System.IO.Path]::GetFullPath((Get-Location).Path)
if (-not $outputPath.StartsWith($workspacePath, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Output directory must stay inside the workspace."
}
[System.IO.Directory]::CreateDirectory($outputPath) | Out-Null

$source = [System.Drawing.Bitmap]::FromFile($atlasPath)
try {
  $cellWidth = [Math]::Floor($source.Width / $Columns)
  $cellHeight = [Math]::Floor($source.Height / $Rows)
  for ($row = 0; $row -lt $Rows; $row++) {
    for ($column = 0; $column -lt $Columns; $column++) {
      $left = $cellWidth
      $top = $cellHeight
      $right = -1
      $bottom = -1
      for ($y = 0; $y -lt $cellHeight; $y++) {
        for ($x = 0; $x -lt $cellWidth; $x++) {
          if ($source.GetPixel(($column * $cellWidth) + $x, ($row * $cellHeight) + $y).A -gt 8) {
            if ($x -lt $left) { $left = $x }
            if ($x -gt $right) { $right = $x }
            if ($y -lt $top) { $top = $y }
            if ($y -gt $bottom) { $bottom = $y }
          }
        }
      }
      $canvas = New-Object System.Drawing.Bitmap $CanvasSize, $CanvasSize, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      try {
        if ($right -ge $left -and $bottom -ge $top) {
          $contentWidth = $right - $left + 1
          $contentHeight = $bottom - $top + 1
          $scale = [Math]::Min($SafeSize / $contentWidth, $SafeSize / $contentHeight)
          $drawWidth = [Math]::Max(1, [Math]::Round($contentWidth * $scale))
          $drawHeight = [Math]::Max(1, [Math]::Round($contentHeight * $scale))
          $drawX = [Math]::Round(($CanvasSize - $drawWidth) / 2)
          $drawY = [Math]::Round(($CanvasSize - $drawHeight) / 2)
          $graphics = [System.Drawing.Graphics]::FromImage($canvas)
          try {
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $sourceRect = New-Object System.Drawing.Rectangle (($column * $cellWidth) + $left), (($row * $cellHeight) + $top), $contentWidth, $contentHeight
            $destinationRect = New-Object System.Drawing.Rectangle $drawX, $drawY, $drawWidth, $drawHeight
            $graphics.DrawImage($source, $destinationRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
          } finally { $graphics.Dispose() }
        }
        $name = '{0}-r{1}-c{2}.png' -f $Prefix, $row, $column
        $canvas.Save((Join-Path $outputPath $name), [System.Drawing.Imaging.ImageFormat]::Png)
      } finally { $canvas.Dispose() }
    }
  }
} finally { $source.Dispose() }
