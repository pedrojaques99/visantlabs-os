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
  Output PDF path. Defaults to "<name> -.pdf" next to the input.

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
  Try 60 for maximum shrink, 80 for near-lossless look. In -Mobile, default 85.

.PARAMETER Mobile
  Modo CELULAR/WhatsApp. PDF que trava no celular quase nunca e' problema de MB:
  e' MEGAPIXEL + CMYK. O visualizador mobile descomprime a imagem inteira na RAM,
  entao 9600x5400 em CMYK = 52 Mpx x 4 canais = ~207 MB de RAM so' pra abrir 1 pagina.
  Este modo converte CMYK->sRGB (4 canais -> 3), reamostra pra -Dpi (padrao 150),
  re-encoda em JPEG -JpegQuality (padrao 85) e lineariza (fast web view).
  Saida vai pra "<nome> - MOBILE.pdf", nunca sobrescreve o original de impressao.

.PARAMETER ReportOnly
  So' diagnostica: lista cada imagem (px, Mpx, espaco de cor) e estima a RAM de
  decodificacao, com veredito de se o PDF trava no celular. Nao grava nada.

.EXAMPLE
  ./compress-pdf.ps1 -Input .\big.pdf

.EXAMPLE
  ./compress-pdf.ps1 -Input .\docs -Recurse -Dpi 200

.EXAMPLE
  ./compress-pdf.ps1 -Input .\big.pdf -Preset ebook

.EXAMPLE
  ./compress-pdf.ps1 -Input .\lona.pdf -Mobile

.EXAMPLE
  ./compress-pdf.ps1 -Input .\entrega -Recurse -ReportOnly
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

  [switch]$Mobile,

  [switch]$ReportOnly,

  [ValidateRange(1,100)]
  [int]$JpegQuality = 70
)

$ErrorActionPreference = 'Stop'

# Modo mobile tem defaults proprios: 150 dpi e' o ponto doce (visualmente
# identico ao original mesmo com zoom em texto miudo; 120 ja' amolece rotulo).
if ($Mobile) {
  if (-not $PSBoundParameters.ContainsKey('Dpi'))         { $Dpi = 150 }
  if (-not $PSBoundParameters.ContainsKey('JpegQuality')) { $JpegQuality = 85 }
}
$script:Suffix = if ($Mobile) { ' - MOBILE.pdf' } else { ' -.pdf' }

function Resolve-Tool {
  param([string[]]$Candidates, [string]$FriendlyName)
  foreach ($c in $Candidates) {
    $cmd = Get-Command $c -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
  }
  throw "$FriendlyName not found. Tried: $($Candidates -join ', ')"
}

$gs   = $null
$qpdf = $null
$pdfimages = $null

# -ReportOnly nao grava nada: so' precisa do pdfimages (Poppler).
if ($ReportOnly) {
  $pdfimages = Resolve-Tool -Candidates @('pdfimages.exe','pdfimages') -FriendlyName 'pdfimages (Poppler)'
} else {
  $gs = Resolve-Tool -Candidates @('gswin64c.exe','gswin32c.exe','gs') -FriendlyName 'Ghostscript'
  if (-not $SkipQpdf) {
    try { $qpdf = Resolve-Tool -Candidates @('qpdf.exe','qpdf') -FriendlyName 'qpdf' }
    catch {
      if ($Mobile) { throw "qpdf nao encontrado - o modo -Mobile precisa dele pra linearizar (fast web view)." }
      Write-Warning "qpdf not found - skipping lossless polish."; $SkipQpdf = $true
    }
  }
  # Relatorio pos-processo e' bonus: sem Poppler, segue sem ele.
  try { $pdfimages = Resolve-Tool -Candidates @('pdfimages.exe','pdfimages') -FriendlyName 'pdfimages' } catch { }
}

<#
  Inventario de imagens do PDF + estimativa de RAM de decodificacao.
  Esse numero e' o que trava o celular, NAO o tamanho do arquivo: o viewer
  mobile descomprime a imagem inteira em memoria (largura x altura x canais).
  Ex.: 9600x5400 CMYK = 52 Mpx x 4 canais = ~207 MB de RAM em 1 pagina.
#>
function Get-PdfImageStats {
  param([string]$File)
  if (-not $pdfimages) { return $null }
  $lines = & $pdfimages -list $File 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $lines) { return $null }
  $px = [double]0; $ram = [double]0; $cmyk = $false; $maxW = 0; $n = 0
  foreach ($l in $lines) {
    $c = @(($l -split '\s+') | Where-Object { $_ -ne '' })
    if ($c.Count -lt 7) { continue }
    if ($c[2] -notmatch '^(image|smask)$') { continue }
    $w = 0; $h = 0; $comp = 0
    if (-not [int]::TryParse($c[3], [ref]$w))    { continue }
    if (-not [int]::TryParse($c[4], [ref]$h))    { continue }
    if (-not [int]::TryParse($c[6], [ref]$comp)) { continue }
    $n++
    $px  += [double]$w * [double]$h
    $ram += [double]$w * [double]$h * [double]$comp
    if ($c[5] -eq 'cmyk') { $cmyk = $true }
    if ($w -gt $maxW) { $maxW = $w }
  }
  if ($n -eq 0) { return $null }
  return [pscustomobject]@{
    Count      = $n
    MegaPixels = [math]::Round($px / 1MB, 1)
    RamMB      = [math]::Round($ram / 1MB, 0)
    HasCmyk    = $cmyk
    MaxWidth   = $maxW
  }
}

<#
  Veredito heuristico, nao medicao. Caso confirmado em campo (Construir Ai,
  set/2026): lona com ~383 MB de RAM estimada travava o celular; a versao
  sRGB 150 dpi (~92 MB) resolveu. Os cortes abaixo saem dai - ajuste se
  aparecer contra-exemplo.
#>
function Get-MobileVerdict {
  param($Stats)
  if (-not $Stats)          { return @{ Text = 'sem imagem rasterizada'; Color = 'DarkGray' } }
  if ($Stats.RamMB -ge 250) { return @{ Text = 'TRAVA no celular';       Color = 'Red' } }
  if ($Stats.RamMB -ge 100) { return @{ Text = 'pode engasgar';          Color = 'Yellow' } }
  return @{ Text = 'ok no celular'; Color = 'Green' }
}

function Report-One {
  param([string]$In)
  $stats = Get-PdfImageStats -File $In
  $v = Get-MobileVerdict -Stats $stats
  $sizeMB = "{0:N2} MB" -f ((Get-Item -LiteralPath $In).Length / 1MB)
  Write-Host ("    [{0}] ({1})" -f (Split-Path $In -Leaf), $sizeMB) -ForegroundColor White
  if ($stats) {
    $cmykTxt = if ($stats.HasCmyk) { 'CMYK 4 canais (converter p/ sRGB)' } else { 'sRGB/gray' }
    Write-Host ("        {0} img | {1} Mpx | maior lado {2} px | {3}" -f `
      $stats.Count, $stats.MegaPixels, $stats.MaxWidth, $cmykTxt) -ForegroundColor DarkGray
    Write-Host ("        RAM pra decodificar ~{0} MB  ->  " -f $stats.RamMB) -ForegroundColor DarkGray -NoNewline
  } else {
    Write-Host "        " -NoNewline
  }
  Write-Host $v.Text -ForegroundColor $v.Color
}

function Compress-One {
  param([string]$In, [string]$Out)

  $tmp = if ($SkipQpdf) { $Out } else { [System.IO.Path]::ChangeExtension($Out, '.gs.pdf') }

  $gsArgs = @(
    '-sDEVICE=pdfwrite','-dNOPAUSE','-dBATCH','-dQUIET','-dSAFER',
    '-dCompatibilityLevel=1.6'
  )
  if ($Mobile) {
    # O que destrava o celular: CMYK->sRGB (4 canais -> 3) + reamostragem.
    # Threshold 1.0 garante que qualquer imagem acima do alvo seja reduzida
    # (o padrao do GS e' 1.5, entao pedir 200 dpi num PDF de 286 dpi nao faria nada).
    $gsArgs += @(
      '-sColorConversionStrategy=sRGB','-dProcessColorModel=/DeviceRGB','-dConvertCMYKImagesToRGB=true',
      "-dColorImageResolution=$Dpi","-dGrayImageResolution=$Dpi","-dMonoImageResolution=$Dpi",
      '-dDownsampleColorImages=true','-dDownsampleGrayImages=true','-dDownsampleMonoImages=true',
      '-dColorImageDownsampleType=/Bicubic','-dGrayImageDownsampleType=/Bicubic','-dMonoImageDownsampleType=/Subsample',
      '-dColorImageDownsampleThreshold=1.0','-dGrayImageDownsampleThreshold=1.0','-dMonoImageDownsampleThreshold=1.0',
      '-dAutoFilterColorImages=false','-dAutoFilterGrayImages=false',
      '-dEncodeColorImages=true','-dEncodeGrayImages=true',
      '-dColorImageFilter=/DCTEncode','-dGrayImageFilter=/DCTEncode',
      "-dJPEGQ=$JpegQuality",
      '-dCompressFonts=true','-dSubsetFonts=true'
    )
  } elseif ($Preset) {
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

  $fileName = Split-Path $In -Leaf
  $before = (Get-Item $In).Length
  $sizeMB = "{0:N2} MB" -f ($before / 1MB)
  Write-Host "    [$fileName] ($sizeMB)" -ForegroundColor White -NoNewline

  Write-Host " GS..." -ForegroundColor DarkGray -NoNewline
  & $gs @gsArgs
  if ($LASTEXITCODE -ne 0) { Write-Host " ERRO" -ForegroundColor Red; throw "Ghostscript failed on $In" }

  if (-not $SkipQpdf) {
    Write-Host " qpdf..." -ForegroundColor DarkGray -NoNewline
    $qpdfArgs = @('--compress-streams=y','--recompress-flate','--object-streams=generate')
    if ($Mobile) { $qpdfArgs += '--linearize' }
    & $qpdf @qpdfArgs $tmp $Out
    if ($LASTEXITCODE -ne 0) { Write-Host " ERRO" -ForegroundColor Red; throw "qpdf failed on $tmp" }
    Remove-Item $tmp -Force
  }

  $after = (Get-Item $Out).Length
  $pct   = if ($before -gt 0) { [math]::Round(100 - ($after / $before * 100), 1) } else { 0 }
  $afterMB = "{0:N2} MB" -f ($after / 1MB)
  Write-Host " -> $afterMB (-${pct}%)" -ForegroundColor Green

  if ($Mobile) {
    $st = Get-PdfImageStats -File $Out
    if ($st) {
      $v = Get-MobileVerdict -Stats $st
      Write-Host ("        {0} Mpx | RAM ~{1} MB  ->  " -f $st.MegaPixels, $st.RamMB) -ForegroundColor DarkGray -NoNewline
      Write-Host $v.Text -ForegroundColor $v.Color
    }
  }
}

# -ReportOnly: so' diagnostica, nao grava. Aceita arquivo ou pasta.
if ($ReportOnly) {
  $targets = if (Test-Path -LiteralPath $Path -PathType Container) {
    @(Get-ChildItem -LiteralPath $Path -Filter *.pdf -File -Recurse:$Recurse)
  } else {
    @(Get-Item -LiteralPath $Path)
  }
  if ($targets.Count -eq 0) { Write-Host "    Nenhum PDF encontrado." -ForegroundColor DarkGray; return }
  Write-Host "    Diagnostico mobile - $($targets.Count) PDF(s)" -ForegroundColor Cyan
  Write-Host "    O que trava o celular e' a RAM de decodificacao, nao o tamanho em MB." -ForegroundColor DarkGray
  Write-Host ""
  foreach ($t in $targets) { Report-One -In $t.FullName }
  Write-Host ""
  Write-Host "    Alvo: abaixo de 100 MB de RAM estimada por pagina." -ForegroundColor DarkGray
  Write-Host "    Corrigir com: compress-pdf.ps1 -Input <pasta> -Recurse -Mobile" -ForegroundColor DarkGray
  return
}

if ($Recurse) {
  if (-not (Test-Path $Path -PathType Container)) { throw "-Recurse requires a folder path." }
  $files = @(Get-ChildItem -LiteralPath $Path -Filter *.pdf -Recurse -File | Where-Object { $_.Name -notmatch ' -\.pdf$' -and $_.Name -notmatch ' - MOBILE\.pdf$' })
  if ($files.Count -eq 0) { Write-Host "    Nenhum PDF encontrado para comprimir." -ForegroundColor DarkGray; return }
  Write-Host "    $($files.Count) PDF(s) encontrado(s)" -ForegroundColor Cyan
  Write-Host ""
  $totalBefore = 0; $totalAfter = 0; $i = 0
  foreach ($f in $files) {
    $i++
    Write-Host "    [$i/$($files.Count)]" -ForegroundColor DarkCyan -NoNewline
    $out = [System.IO.Path]::Combine($f.DirectoryName, [System.IO.Path]::GetFileNameWithoutExtension($f.Name) + $script:Suffix)
    $totalBefore += $f.Length
    Compress-One -In $f.FullName -Out $out
    $totalAfter += (Get-Item $out).Length
  }
  Write-Host ""
  $totalPct = if ($totalBefore -gt 0) { [math]::Round(100 - ($totalAfter / $totalBefore * 100), 1) } else { 0 }
  Write-Host ("    Total: {0:N2} MB -> {1:N2} MB (-{2}%)" -f ($totalBefore/1MB), ($totalAfter/1MB), $totalPct) -ForegroundColor Green
} else {
  if (-not (Test-Path $Path -PathType Leaf)) { throw "Input file not found: $Path" }
  $in = (Resolve-Path $Path).Path
  if (-not $Output) {
    $dir = Split-Path $in -Parent
    $name = [System.IO.Path]::GetFileNameWithoutExtension($in)
    $Output = Join-Path $dir ($name + $script:Suffix)
  }
  Compress-One -In $in -Out $Output
}
