<#
.SYNOPSIS
  Compress PDF files using Ghostscript (image downsampling) + optional qpdf polish.

.DESCRIPTION
  Downsamples images to a target DPI (default 300) with ImageDownsampleThreshold=1.0
  so any image above the target is reduced. Optionally runs qpdf afterwards for
  lossless stream/object recompression.

.PARAMETER Input
  Path to the source PDF (or folder if -Recurse).

.PARAMETER Output
  Output PDF path. Defaults to "<name>.compressed.pdf" next to the input.

.PARAMETER Dpi
  Target DPI for color/gray/mono images. Default 300.

.PARAMETER Preset
  Ghostscript PDFSETTINGS preset: screen | ebook | printer | prepress | default.
  When set, overrides manual DPI knobs with Ghostscript's preset defaults.

.PARAMETER SkipQpdf
  Skip the qpdf lossless polish step.

.PARAMETER Recurse
  Treat -Input as a folder and compress every *.pdf inside.

.PARAMETER Aggressive
  Aggressive mode: force JPEG (DCT) re-encoding of raster images with a tunable
  quality factor. Text and vectors stay untouched (Ghostscript only rasterizes
  embedded images, never page content). Pairs well with -Dpi 150/200.

.PARAMETER JpegQuality
  JPEG quality 1-100 used when -Aggressive is set. Default 70 (good balance).
  Try 60 for maximum shrink, 80 for near-lossless look.

.EXAMPLE
  ./compress-pdf.ps1 -Input .\big.pdf

.EXAMPLE
  ./compress-pdf.ps1 -Input .\docs -Recurse -Dpi 200

.EXAMPLE
  ./compress-pdf.ps1 -Input .\big.pdf -Preset ebook
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [Alias('Input')]
  [string]$Path,

  [string]$Output,

  [int]$Dpi = 300,

  [ValidateSet('screen','ebook','printer','prepress','default')]
  [string]$Preset,

  [switch]$SkipQpdf,

  [switch]$Recurse,

  [switch]$Aggressive,

  [ValidateRange(1,100)]
  [int]$JpegQuality = 70
)

$ErrorActionPreference = 'Stop'

function Resolve-Tool {
  param([string[]]$Candidates, [string]$FriendlyName)
  foreach ($c in $Candidates) {
    $cmd = Get-Command $c -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
  }
  throw "$FriendlyName not found. Tried: $($Candidates -join ', ')"
}

$gs   = Resolve-Tool -Candidates @('gswin64c.exe','gswin32c.exe','gs') -FriendlyName 'Ghostscript'
$qpdf = $null
if (-not $SkipQpdf) {
  try { $qpdf = Resolve-Tool -Candidates @('qpdf.exe','qpdf') -FriendlyName 'qpdf' }
  catch { Write-Warning "qpdf not found — skipping lossless polish."; $SkipQpdf = $true }
}

function Compress-One {
  param([string]$In, [string]$Out)

  $tmp = if ($SkipQpdf) { $Out } else { [System.IO.Path]::ChangeExtension($Out, '.gs.pdf') }

  $gsArgs = @(
    '-sDEVICE=pdfwrite','-dNOPAUSE','-dBATCH','-dQUIET','-dSAFER',
    '-dCompatibilityLevel=1.6'
  )
  if ($Preset) {
    $gsArgs += "-dPDFSETTINGS=/$Preset"
  } elseif ($Aggressive) {
    $monoDpi = [Math]::Max($Dpi, 600)
    $q = $JpegQuality
    $gsArgs += @(
      "-dColorImageResolution=$Dpi","-dGrayImageResolution=$Dpi","-dMonoImageResolution=$monoDpi",
      '-dDownsampleColorImages=true','-dDownsampleGrayImages=true','-dDownsampleMonoImages=true',
      '-dColorImageDownsampleType=/Bicubic','-dGrayImageDownsampleType=/Bicubic','-dMonoImageDownsampleType=/Subsample',
      '-dColorImageDownsampleThreshold=1.0','-dGrayImageDownsampleThreshold=1.0','-dMonoImageDownsampleThreshold=1.0',
      '-dAutoFilterColorImages=false','-dAutoFilterGrayImages=false',
      '-dEncodeColorImages=true','-dEncodeGrayImages=true','-dEncodeMonoImages=true',
      '-dColorImageFilter=/DCTEncode','-dGrayImageFilter=/DCTEncode','-dMonoImageFilter=/CCITTFaxEncode',
      "-dJPEGQ=$q"
    )
  } else {
    $gsArgs += @(
      "-dColorImageResolution=$Dpi","-dGrayImageResolution=$Dpi","-dMonoImageResolution=$Dpi",
      '-dDownsampleColorImages=true','-dDownsampleGrayImages=true','-dDownsampleMonoImages=true',
      '-dColorImageDownsampleThreshold=1.0','-dGrayImageDownsampleThreshold=1.0','-dMonoImageDownsampleThreshold=1.0'
    )
  }
  $gsArgs += @("-sOutputFile=$tmp", $In)

  Write-Host "→ Ghostscript: $In" -ForegroundColor Cyan
  & $gs @gsArgs
  if ($LASTEXITCODE -ne 0) { throw "Ghostscript failed on $In" }

  if (-not $SkipQpdf) {
    Write-Host "→ qpdf polish: $tmp" -ForegroundColor Cyan
    & $qpdf --compress-streams=y --recompress-flate --object-streams=generate $tmp $Out
    if ($LASTEXITCODE -ne 0) { throw "qpdf failed on $tmp" }
    Remove-Item $tmp -Force
  }

  $before = (Get-Item $In).Length
  $after  = (Get-Item $Out).Length
  $pct    = if ($before -gt 0) { [math]::Round(100 - ($after / $before * 100), 1) } else { 0 }
  Write-Host ("✔ {0} → {1}  ({2:N2} MB → {3:N2} MB, -{4}%)" -f $In, $Out, ($before/1MB), ($after/1MB), $pct) -ForegroundColor Green
}

if ($Recurse) {
  if (-not (Test-Path $Path -PathType Container)) { throw "-Recurse requires a folder path." }
  $files = Get-ChildItem -LiteralPath $Path -Filter *.pdf -Recurse -File | Where-Object { $_.Name -notmatch '\.compressed(\.gs)?\.pdf$' }
  foreach ($f in $files) {
    $out = [System.IO.Path]::Combine($f.DirectoryName, [System.IO.Path]::GetFileNameWithoutExtension($f.Name) + '.compressed.pdf')
    Compress-One -In $f.FullName -Out $out
  }
} else {
  if (-not (Test-Path $Path -PathType Leaf)) { throw "Input file not found: $Path" }
  $in = (Resolve-Path $Path).Path
  if (-not $Output) {
    $dir = Split-Path $in -Parent
    $name = [System.IO.Path]::GetFileNameWithoutExtension($in)
    $Output = Join-Path $dir "$name.compressed.pdf"
  }
  Compress-One -In $in -Out $Output
}
