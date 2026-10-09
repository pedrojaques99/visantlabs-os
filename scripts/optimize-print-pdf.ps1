<#
.SYNOPSIS
  Otimiza PDF de arte final de grande formato SEM destruir a resolucao de impressao.

.DESCRIPTION
  Arte de grande formato (lona, banner, outdoor, fachada) quase sempre e desenhada
  em ESCALA REDUZIDA: uma lona de 464x280cm vira uma pagina de 48,4x30,0cm no PDF
  (escala 1:10). Isso quebra qualquer compressor generico, porque "150 dpi" na
  pagina significa 15 dpi na lona impressa - lixo.

  Este script raciocina em DPI REAL (no tamanho impresso final):

      ppi_de_pagina = TargetDpi * escala

  A escala e detectada sozinha, comparando o tamanho da pagina (pdfinfo) com a
  medida declarada no nome do arquivo ou no titulo do PDF (ex: "4,64x2,80m",
  "464.0x280cm"). Da pra forcar com -Scale.

  O que ele preserva de proposito:
    - CMYK e canais spot   (ColorConversionStrategy=LeaveColorUnchanged)
    - JPEGs que ja estao na resolucao certa (PassThroughJPEGImages): zero perda
      de geracao por recompressao
    - TrimBox / BleedBox   (conferido no fim, com aviso se mexer)

  O alvo real dele e o defeito classico do Illustrator: uma imagem embutida em
  FlateDecode (ZIP lossless) em vez de JPEG. Uma unica foto assim faz um PDF de
  5MB virar 350MB. O -ReportOnly acha esses casos sem tocar em nada.

.PARAMETER Path
  PDF de origem, ou pasta quando usado com -Recurse.

.PARAMETER OutputDir
  Pasta de saida. Default: "_Otimizado" ao lado da entrada. O original nunca e
  sobrescrito.

.PARAMETER TargetDpi
  DPI no TAMANHO IMPRESSO FINAL (nao na pagina). Default 120.
  Referencia pratica para grande formato:
    150+  fachada/painel visto de perto, leitura de detalhe
    120   lona interna de feira, estande, backdrop  <- default
     72   lona/banner visto a 1,5m ou mais
     40   outdoor, empena, fachada de rua

.PARAMETER JpegQuality
  Qualidade JPEG 1-100 das imagens re-encodadas. Default 95.
  Abaixo de 90 comeca a aparecer artefato em area de cor chapada.

.PARAMETER Scale
  Forca a escala do documento (ex: 10 para 1:10). 0 = detectar sozinho.

.PARAMETER Recurse
  Trata -Path como pasta e processa todo *.pdf dentro (pula _Otimizado).

.PARAMETER ReportOnly
  So diagnostica: escala, dpi real e quais imagens estao sem compressao.
  Nao escreve nada.

.EXAMPLE
  ./optimize-print-pdf.ps1 -Path ".\Lonas" -Recurse -ReportOnly
  Diagnostico da pasta inteira: quem esta pesado e por que.

.EXAMPLE
  ./optimize-print-pdf.ps1 -Path ".\LONA - Central - 4,64x2,80m.pdf"
  Otimiza a 120 dpi reais, detectando a escala 1:10 sozinho.

.EXAMPLE
  ./optimize-print-pdf.ps1 -Path ".\outdoor.pdf" -TargetDpi 40 -Scale 20
  Outdoor desenhado em 1:20, 40 dpi reais.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [Alias('Input')]
  [string]$Path,

  [string]$OutputDir,

  [ValidateRange(10, 1200)]
  [int]$TargetDpi = 120,

  [ValidateRange(1, 100)]
  [int]$JpegQuality = 95,

  [ValidateRange(0, 200)]
  [double]$Scale = 0,

  [switch]$Recurse,

  [switch]$ReportOnly
)

$ErrorActionPreference = 'Stop'

# Escalas de prancheta que existem na vida real. Servem pra "arredondar" a escala
# medida: 9.586 vira 10, e nao um 9.586 esquisito que nao e escala nenhuma.
$script:CommonScales = @(1, 2, 2.5, 4, 5, 10, 20, 25, 50, 100)

# --- FERRAMENTAS ---

function Resolve-Tool {
  param([string[]]$Candidates, [string]$FriendlyName, [switch]$Optional)
  foreach ($c in $Candidates) {
    $cmd = Get-Command $c -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
  }
  if ($Optional) { return $null }
  throw "$FriendlyName nao encontrado no PATH. Tentei: $($Candidates -join ', ')"
}

$script:Gs        = Resolve-Tool -Candidates @('gswin64c.exe','gswin32c.exe','gs') -FriendlyName 'Ghostscript'
$script:PdfInfo   = Resolve-Tool -Candidates @('pdfinfo.exe','pdfinfo')     -FriendlyName 'pdfinfo (poppler)'   -Optional
$script:PdfImages = Resolve-Tool -Candidates @('pdfimages.exe','pdfimages') -FriendlyName 'pdfimages (poppler)' -Optional

if (-not $script:PdfInfo) {
  Write-Warning "poppler (pdfinfo) ausente - deteccao de escala e conferencia de caixas desligadas."
  Write-Warning "Instale com: winget install oschwartz10612.Poppler   ou   choco install poppler"
}

# --- LEITURA DO PDF ---

function Get-PageSizeCm {
  param([string]$File)
  if (-not $script:PdfInfo) { return $null }
  $out = & $script:PdfInfo $File 2>$null
  $line = $out | Where-Object { $_ -match '^Page size:' } | Select-Object -First 1
  if (-not $line) { return $null }
  if ($line -notmatch '([\d.]+)\s*x\s*([\d.]+)\s*pts') { return $null }
  # 1 pt = 1/72 pol = 2.54/72 cm
  [PSCustomObject]@{
    W = [double]$Matches[1] * 2.54 / 72
    H = [double]$Matches[2] * 2.54 / 72
  }
}

function Get-Boxes {
  param([string]$File)
  if (-not $script:PdfInfo) { return $null }
  $out = & $script:PdfInfo -box $File 2>$null
  $boxes = [ordered]@{}
  foreach ($b in @('MediaBox','CropBox','BleedBox','TrimBox','ArtBox')) {
    $line = $out | Where-Object { $_ -match ('^' + $b + ':') } | Select-Object -First 1
    if ($line) { $boxes[$b] = (($line -replace ('^' + $b + ':\s*'), '') -replace '\s+', ' ').Trim() }
  }
  return $boxes
}

# Procura "464x280cm", "4,64 x 2,80 m", "1500x3000mm" no nome do arquivo e no
# titulo do PDF. Devolve a maior medida achada, em cm.
function Get-DeclaredSizeCm {
  param([string]$File)

  $sources = @([System.IO.Path]::GetFileNameWithoutExtension($File))
  if ($script:PdfInfo) {
    $t = (& $script:PdfInfo $File 2>$null) | Where-Object { $_ -match '^Title:' } | Select-Object -First 1
    if ($t) { $sources += ($t -replace '^Title:\s*', '') }
  }

  $best = $null
  $rx = '(\d+(?:[.,]\d+)?)\s*[xX×*]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)\b'
  foreach ($s in $sources) {
    foreach ($m in [regex]::Matches($s, $rx)) {
      $a = [double]($m.Groups[1].Value -replace ',', '.')
      $b = [double]($m.Groups[2].Value -replace ',', '.')
      switch ($m.Groups[3].Value.ToLower()) {
        'mm' { $a = $a / 10;  $b = $b / 10 }
        'm'  { $a = $a * 100; $b = $b * 100 }
      }
      if (-not $best -or ($a * $b) -gt ($best.W * $best.H)) {
        $best = [PSCustomObject]@{ W = $a; H = $b }
      }
    }
  }
  return $best
}

function Resolve-DocScale {
  param([string]$File, $PageCm)

  if ($Scale -gt 0) { return [PSCustomObject]@{ Value = $Scale; How = 'forcada por -Scale' } }
  if (-not $PageCm) { return [PSCustomObject]@{ Value = 1.0; How = 'sem poppler, assumindo 1:1' } }

  $decl = Get-DeclaredSizeCm -File $File
  if (-not $decl) { return [PSCustomObject]@{ Value = 1.0; How = 'nenhuma medida no nome/titulo, assumindo 1:1' } }

  # Compara na mesma orientacao: a arte pode estar deitada em relacao ao nome.
  $pw = [Math]::Max($PageCm.W, $PageCm.H); $ph = [Math]::Min($PageCm.W, $PageCm.H)
  $dw = [Math]::Max($decl.W,   $decl.H);   $dh = [Math]::Min($decl.W,   $decl.H)
  if ($pw -le 0 -or $ph -le 0) { return [PSCustomObject]@{ Value = 1.0; How = 'pagina invalida' } }

  # Media das duas razoes: mais estavel que so a largura quando ha sangria.
  $raw = ((($dw / $pw) + ($dh / $ph)) / 2)

  $snap = $script:CommonScales | Sort-Object { [Math]::Abs($_ - $raw) } | Select-Object -First 1
  if ($snap -gt 0 -and ([Math]::Abs($snap - $raw) / $snap) -le 0.12) {
    return [PSCustomObject]@{
      Value = [double]$snap
      How   = ('medido {0:N2}x -> 1:{1} (arte {2:N0}x{3:N0}cm em pagina {4:N1}x{5:N1}cm)' -f $raw, $snap, $dw, $dh, $pw, $ph)
    }
  }
  return [PSCustomObject]@{ Value = [double][Math]::Round($raw, 2); How = ('medido {0:N2}x, fora das escalas comuns' -f $raw) }
}

# --- DIAGNOSTICO DE IMAGENS ---

function ConvertFrom-SizeToken {
  param([string]$Token)
  if ($Token -match '^([\d.]+)([BKMG])$') {
    $n = [double]$Matches[1]
    switch ($Matches[2]) {
      'B' { return $n }
      'K' { return $n * 1KB }
      'M' { return $n * 1MB }
      'G' { return $n * 1GB }
    }
  }
  return 0
}

function Get-ImageReport {
  param([string]$File)
  if (-not $script:PdfImages) { return $null }

  $rows = @()
  foreach ($line in (& $script:PdfImages -list $File 2>$null)) {
    $f = ($line.Trim() -split '\s+')
    # page num type w h color comp bpc enc interp object ID x-ppi y-ppi size ratio
    if ($f.Count -lt 16) { continue }
    if ($f[0] -notmatch '^\d+$') { continue }
    $rows += [PSCustomObject]@{
      Type   = $f[2]
      W      = [int]$f[3]
      H      = [int]$f[4]
      Color  = $f[5]
      Enc    = $f[8]
      Object = $f[10]
      Ppi    = [int]$f[12]
      Bytes  = ConvertFrom-SizeToken $f[14]
    }
  }
  return $rows
}

# -dJPEGQ e' IGNORADO pelo pdfwrite do Ghostscript (testado em 10.05.0: qualidade
# 20 vs 90 gera arquivo byte-a-byte igual). Quem controla e' o QFactor do Distiller
# via setdistillerparams. QFactor MENOR = qualidade MELHOR.
function Get-DistillerArgs {
  param([ValidateRange(1,100)][int]$Quality)
  $qf = 0.05 + ((100 - $Quality) / 100.0) * 2.45
  # InvariantCulture obrigatorio: em pt-BR o "." viraria "," e quebraria o PostScript.
  $qfs = [string]::Format([System.Globalization.CultureInfo]::InvariantCulture, '{0:0.###}', $qf)
  $dict = "<< /QFactor $qfs /Blend 1 /ColorTransform 1 /HSamples [1 1 1 1] /VSamples [1 1 1 1] >>"
  return @('-c', "<< /ColorImageDict $dict /GrayImageDict $dict >> setdistillerparams", '-f')
}

# --- OTIMIZACAO ---

function Get-OutputPath {
  param([string]$File)
  $dir = if ($OutputDir) { $OutputDir } else { Join-Path (Split-Path $File -Parent) '_Otimizado' }
  $stem = [System.IO.Path]::GetFileNameWithoutExtension($File)
  return (Join-Path $dir ('{0} [OTIMIZADO {1}dpi].pdf' -f $stem, $TargetDpi))
}

function Optimize-One {
  param([string]$InFile, [string]$OutFile, [int]$PagePpi)

  # NAO usar $args aqui: e variavel automatica do PowerShell dentro de funcao.
  $gsArgs = @(
    '-q', '-dNOPAUSE', '-dBATCH', '-dSAFER',
    '-sDEVICE=pdfwrite',
    '-dCompatibilityLevel=1.6',
    # Nao encosta em CMYK / spot. Converter perfil aqui seria mudar a cor impressa.
    '-dColorConversionStrategy=/LeaveColorUnchanged',
    '-dDetectDuplicateImages=true',
    # JPEG que ja esta na resolucao certa passa intacto: sem perda de geracao.
    '-dPassThroughJPEGImages=true',
    '-dDownsampleColorImages=true', '-dColorImageDownsampleType=/Bicubic',
    "-dColorImageResolution=$PagePpi", '-dColorImageDownsampleThreshold=1.0',
    '-dDownsampleGrayImages=true', '-dGrayImageDownsampleType=/Bicubic',
    "-dGrayImageResolution=$PagePpi", '-dGrayImageDownsampleThreshold=1.0',
    # O coracao da coisa: forca DCT (JPEG) no lugar do Flate/ZIP que o Illustrator
    # as vezes grava, que e o que estoura o arquivo.
    '-dAutoFilterColorImages=false', '-dColorImageFilter=/DCTEncode',
    '-dAutoFilterGrayImages=false',  '-dGrayImageFilter=/DCTEncode',
    '-dEmbedAllFonts=true', '-dSubsetFonts=true',
    "-sOutputFile=$OutFile"
  )
  # -c ... setdistillerparams tem que vir antes do -f <input>.
  $gsArgs += (Get-DistillerArgs -Quality $JpegQuality)
  $gsArgs += $InFile

  & $script:Gs @gsArgs 2>&1 |
    Where-Object { $_ -match 'Error|error|Fail|Unrecoverable' } |
    ForEach-Object { Write-Warning $_ }

  if (-not (Test-Path -LiteralPath $OutFile)) { throw "Ghostscript nao gerou saida para: $InFile" }
}

# --- POR ARQUIVO ---

function Invoke-File {
  param([string]$File)

  Write-Host ''
  Write-Host ('  ' + (Split-Path $File -Leaf)) -ForegroundColor Cyan

  $sizeIn = (Get-Item -LiteralPath $File).Length
  $pageCm = Get-PageSizeCm -File $File
  $scale  = Resolve-DocScale -File $File -PageCm $pageCm

  $pagePpi = [int][Math]::Round($TargetDpi * $scale.Value)
  if ($pagePpi -lt 1) { $pagePpi = 1 }

  if ($pageCm) {
    Write-Host ('    Pagina    : {0:N2} x {1:N2} cm' -f $pageCm.W, $pageCm.H) -ForegroundColor DarkGray
    Write-Host ('    Impresso  : {0:N1} x {1:N1} cm' -f ($pageCm.W * $scale.Value), ($pageCm.H * $scale.Value)) -ForegroundColor DarkGray
  }
  Write-Host ('    Escala    : 1:{0}  ({1})' -f $scale.Value, $scale.How) -ForegroundColor DarkGray
  Write-Host ('    Alvo      : {0} dpi reais = {1} ppi de pagina' -f $TargetDpi, $pagePpi) -ForegroundColor DarkGray

  # Diagnostico: quem esta sem compressao com custo relevante.
  $imgs = Get-ImageReport -File $File
  if ($imgs) {
    $raw = @($imgs | Where-Object { $_.Enc -notin @('jpeg','jpx') -and $_.Bytes -gt 5MB })
    if ($raw.Count -gt 0) {
      Write-Host '    [!] Imagem sem compressao JPEG (causa provavel do peso):' -ForegroundColor Yellow
      foreach ($r in ($raw | Sort-Object Bytes -Descending)) {
        $realDpi = if ($scale.Value -gt 0) { [int]($r.Ppi / $scale.Value) } else { $r.Ppi }
        Write-Host ('        obj {0,-5} {1}x{2} {3,-5} enc={4,-6} {5,7:N1} MB  ({6} dpi reais)' -f
          $r.Object, $r.W, $r.H, $r.Color, $r.Enc, ($r.Bytes / 1MB), $realDpi) -ForegroundColor Yellow
      }
    }
    $maxPpi = ($imgs | Where-Object { $_.Ppi -gt 0 } | Measure-Object -Property Ppi -Maximum).Maximum
    if ($maxPpi -and $scale.Value -gt 0) {
      Write-Host ('    Atual     : ate {0} dpi reais' -f [int]($maxPpi / $scale.Value)) -ForegroundColor DarkGray
    }
  }

  if ($ReportOnly) {
    Write-Host ('    Tamanho   : {0:N1} MB  [somente relatorio]' -f ($sizeIn / 1MB)) -ForegroundColor DarkGray
    return
  }

  $outFile = Get-OutputPath -File $File
  $outDir  = Split-Path $outFile -Parent
  if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

  Optimize-One -InFile $File -OutFile $outFile -PagePpi $pagePpi

  $sizeOut = (Get-Item -LiteralPath $outFile).Length
  $pct = if ($sizeIn -gt 0) { (1 - $sizeOut / $sizeIn) * 100 } else { 0 }

  # Conferencia: as caixas tem que continuar as mesmas. E o TrimBox que a grafica
  # corta - se mexeu, o operador precisa saber.
  $b1 = Get-Boxes -File $File
  $b2 = Get-Boxes -File $outFile
  if ($b1 -and $b2) {
    $diff = @()
    foreach ($k in $b1.Keys) { if ($b1[$k] -ne $b2[$k]) { $diff += ('{0} : {1} -> {2}' -f $k, $b1[$k], $b2[$k]) } }
    if ($diff.Count -gt 0) {
      Write-Host '    [!] Caixa alterada (arredondamento do Ghostscript):' -ForegroundColor Yellow
      $diff | ForEach-Object { Write-Host ('        ' + $_) -ForegroundColor Yellow }
    } else {
      Write-Host '    Caixas    : identicas (Media/Crop/Bleed/Trim/Art)' -ForegroundColor DarkGray
    }
  }

  # $pct negativo = arquivo CRESCEU. Dizer "-40% menor" mentia sobre o resultado.
  $verbo = if ($pct -ge 0) { 'menor' } else { 'MAIOR' }
  $cor   = if ($pct -ge 0) { 'Green' } else { 'Yellow' }
  Write-Host ('    {0:N1} MB -> {1:N1} MB  ({2:N1}% {3})' -f ($sizeIn / 1MB), ($sizeOut / 1MB), [Math]::Abs($pct), $verbo) -ForegroundColor $cor
  Write-Host ('    -> ' + $outFile) -ForegroundColor DarkGray
}

# --- MAIN ---

if (-not (Test-Path -LiteralPath $Path)) { throw "Caminho nao encontrado: $Path" }

$isFolder = Test-Path -LiteralPath $Path -PathType Container

$targets = @()
if ($isFolder) {
  $gci = @{ Path = $Path; Filter = '*.pdf'; File = $true }
  if ($Recurse) { $gci['Recurse'] = $true }
  $targets = @(Get-ChildItem @gci -ErrorAction SilentlyContinue |
               Where-Object { $_.DirectoryName -notmatch '[\\/]_Otimizado([\\/]|$)' })
} else {
  $targets = @(Get-Item -LiteralPath $Path)
}

if ($targets.Count -eq 0) { Write-Warning "Nenhum PDF encontrado em: $Path"; return }

Write-Host ''
Write-Host '  OTIMIZAR ARTE FINAL - GRANDE FORMATO' -ForegroundColor Magenta
Write-Host ('  {0} PDF(s) | alvo {1} dpi reais | JPEG {2}%{3}' -f
  $targets.Count, $TargetDpi, $JpegQuality, $(if ($ReportOnly) { ' | SOMENTE RELATORIO' } else { '' })) -ForegroundColor DarkGray

$totalIn = 0; $totalOut = 0; $failed = 0
foreach ($t in $targets) {
  try {
    Invoke-File -File $t.FullName
    $totalIn += $t.Length
    if (-not $ReportOnly) {
      $o = Get-OutputPath -File $t.FullName
      if (Test-Path -LiteralPath $o) { $totalOut += (Get-Item -LiteralPath $o).Length }
    }
  } catch {
    $failed++
    Write-Host ('    [X] ' + $_.Exception.Message) -ForegroundColor Red
  }
}

Write-Host ''
if (-not $ReportOnly -and $totalIn -gt 0) {
  $pctTot = (1 - $totalOut / $totalIn) * 100
  $verboTot = if ($pctTot -ge 0) { 'menor' } else { 'MAIOR' }
  $corTot   = if ($pctTot -ge 0) { 'Green' } else { 'Yellow' }
  Write-Host ('  TOTAL: {0:N1} MB -> {1:N1} MB  ({2:N1}% {3})' -f
    ($totalIn / 1MB), ($totalOut / 1MB), [Math]::Abs($pctTot), $verboTot) -ForegroundColor $corTot
}
if ($failed -gt 0) { Write-Host ('  ' + $failed + ' arquivo(s) falharam.') -ForegroundColor Red }
Write-Host ''
