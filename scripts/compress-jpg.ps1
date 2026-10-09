<#
.SYNOPSIS
  Comprime JPG/JPEG sem perder qualidade (lossless real) usando jpegoptim/jpegtran.

.DESCRIPTION
  Modo 'lossless' (padrao): re-otimiza a tabela de Huffman e reescreve o JPEG em
  progressivo. Os coeficientes DCT nao sao tocados, entao a imagem decodificada e
  BIT A BIT IDENTICA a original - zero perda, zero geracao. Ganho tipico 5-20%
  (arte final exportada por Illustrator/Photoshop costuma render mais).

  Modo 'visual': re-encoda com qualidade alta (padrao 92, 4:4:4 sem subsampling).
  NAO e lossless - use so quando o ganho do modo lossless nao for suficiente.

  Arquivo so e mantido se ficar MENOR que o original. Originais nunca sao
  destruidos, exceto com -InPlace (que ainda assim so grava se encolher).

.PARAMETER Path
  Arquivo .jpg/.jpeg ou pasta (com -Recurse).

.PARAMETER Output
  Pasta de saida. Padrao: "JPG_Comprimido" ao lado da entrada. Ignorado com -InPlace.

.PARAMETER Mode
  lossless (padrao) | visual.

.PARAMETER Quality
  Qualidade 1-100 usada no modo 'visual'. Padrao 92.

.PARAMETER Recurse
  Trata -Path como pasta e processa todo *.jpg/*.jpeg dentro dela.

.PARAMETER InPlace
  Sobrescreve os originais (so quando o resultado e menor). Sem isso, grava em -Output.

.PARAMETER KeepMetadata
  Preserva EXIF/ICC/XMP. Por padrao os metadados sao removidos (--strip-all),
  o que continua sendo lossless em pixel e ajuda no tamanho.
  ATENCAO: em arte final CMYK com perfil ICC embutido, use -KeepMetadata.

.PARAMETER ReportOnly
  So diagnostica: mostra o ganho possivel por arquivo, sem gravar nada.

.PARAMETER AutoInstall
  Instala o jpegoptim via winget sem perguntar, se ele nao estiver no PATH.

.EXAMPLE
  ./compress-jpg.ps1 -Path .\entrega -Recurse

.EXAMPLE
  ./compress-jpg.ps1 -Path .\entrega -Recurse -ReportOnly

.EXAMPLE
  ./compress-jpg.ps1 -Path .\foto.jpg -Mode visual -Quality 88
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [Alias('Input')]
  [string]$Path,

  [string]$Output,

  [ValidateSet('lossless', 'visual')]
  [string]$Mode = 'lossless',

  [ValidateRange(1, 100)]
  [int]$Quality = 92,

  [switch]$Recurse,

  [switch]$InPlace,

  [switch]$KeepMetadata,

  [switch]$ReportOnly,

  [switch]$AutoInstall
)

$ErrorActionPreference = 'Stop'
$OutDirName = 'JPG_Comprimido'

# --- RESOLUCAO DE FERRAMENTAS ---

function Resolve-Tool {
  param([string[]]$Names = @(), [string[]]$GlobPaths = @())
  foreach ($n in $Names) {
    $cmd = Get-Command $n -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
  }
  foreach ($g in $GlobPaths) {
    $found = Get-ChildItem -Path $g -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { return $found.FullName }
  }
  return $null
}

function Get-JpegOptim {
  Resolve-Tool -Names @('jpegoptim') -GlobPaths @(
    "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\TimoKokkonen.Jpegoptim*\**\jpegoptim.exe",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Links\jpegoptim.exe",
    "C:\Program Files\jpegoptim*\jpegoptim.exe"
  )
}

function Get-JpegTran {
  Resolve-Tool -Names @('jpegtran') -GlobPaths @(
    "C:\Program Files\mozjpeg\bin\jpegtran.exe",
    "C:\Program Files*\mozjpeg*\**\jpegtran.exe",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\*mozjpeg*\**\jpegtran.exe",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\*jpeg*\**\jpegtran.exe"
  )
}

function Install-JpegOptim {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    Write-Host "    [X] winget nao disponivel. Instale manualmente: https://github.com/tjko/jpegoptim" -ForegroundColor Red
    return $null
  }
  Write-Host "    [i] Instalando jpegoptim via winget..." -ForegroundColor Cyan
  & winget install --id TimoKokkonen.Jpegoptim -e --silent --accept-package-agreements --accept-source-agreements | Out-Host
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
              [System.Environment]::GetEnvironmentVariable('Path', 'User')
  return (Get-JpegOptim)
}

$jpegoptim = Get-JpegOptim
$jpegtran  = if ($jpegoptim) { $null } else { Get-JpegTran }
$magick    = Resolve-Tool -Names @('magick') -GlobPaths @("C:\Program Files\ImageMagick*\magick.exe")

if (-not $jpegoptim -and -not $jpegtran) {
  Write-Host "    [!] jpegoptim nao encontrado - ele e quem faz a compressao SEM PERDA." -ForegroundColor Yellow
  $doInstall = $AutoInstall
  if (-not $doInstall) {
    $doInstall = (Read-Host "    Instalar agora via winget? (S/n)") -notmatch '^[nN]'
  }
  if ($doInstall) { $jpegoptim = Install-JpegOptim }
}

if (-not $jpegoptim -and -not $jpegtran) {
  if ($Mode -eq 'lossless') {
    Write-Host "    [X] Sem jpegoptim/jpegtran nao da pra comprimir sem perda." -ForegroundColor Red
    Write-Host "        winget install TimoKokkonen.Jpegoptim" -ForegroundColor DarkGray
    Write-Host "        Ou rode com -Mode visual (usa ImageMagick, mas re-encoda)." -ForegroundColor DarkGray
    return
  }
  if (-not $magick) {
    Write-Host "    [X] Modo visual precisa do ImageMagick ('magick') no PATH." -ForegroundColor Red
    return
  }
}

$engine = if ($Mode -eq 'visual' -and -not $jpegoptim) { 'magick' }
          elseif ($jpegoptim) { 'jpegoptim' }
          else { 'jpegtran' }

# --- COMPRESSAO ---

function Compress-OneJpg {
  param([System.IO.FileInfo]$File, [string]$DestDir)

  $before = $File.Length
  # jpegoptim so escreve por --dest=<pasta>, mantendo o nome; por isso um dir temp por arquivo.
  $tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("vsnjpg_" + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null
  $tmp = Join-Path $tmpDir $File.Name

  try {
    switch ($engine) {
      'jpegoptim' {
        # Sem --force: jpegoptim descarta o resultado quando nao encolhe.
        $toolArgs = @('--quiet', '--all-progressive', "--dest=$tmpDir")
        if ($KeepMetadata) { $toolArgs += '--strip-none' } else { $toolArgs += '--strip-all' }
        if ($Mode -eq 'visual') { $toolArgs += "--max=$Quality" }
        $toolArgs += $File.FullName
        & $jpegoptim @toolArgs 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "jpegoptim retornou $LASTEXITCODE" }
      }
      'jpegtran' {
        $toolArgs = @('-optimize', '-progressive')
        $toolArgs += if ($KeepMetadata) { @('-copy', 'all') } else { @('-copy', 'none') }
        $toolArgs += @('-outfile', $tmp, $File.FullName)
        & $jpegtran @toolArgs
        if ($LASTEXITCODE -ne 0) { throw "jpegtran retornou $LASTEXITCODE" }
      }
      'magick' {
        $toolArgs = @($File.FullName, '-quality', "$Quality", '-sampling-factor', '4:4:4', '-interlace', 'JPEG')
        if (-not $KeepMetadata) { $toolArgs += '-strip' }
        $toolArgs += $tmp
        & $magick @toolArgs
        if ($LASTEXITCODE -ne 0) { throw "magick retornou $LASTEXITCODE" }
      }
    }

    # Sem arquivo de saida = jpegoptim pulou porque nao havia ganho.
    $after = if (Test-Path -LiteralPath $tmp) { (Get-Item -LiteralPath $tmp).Length } else { $before }
    if ($after -le 0) { throw "saida vazia" }

    $gain = $before - $after
    $pct  = if ($before -gt 0) { [math]::Round($gain / $before * 100, 1) } else { 0 }

    if ($ReportOnly) {
      if ($gain -gt 0) {
        Write-Host (" {0,8} -> {1,8}  (-{2}%)" -f (Format-Size $before), (Format-Size $after), $pct) -ForegroundColor Green
      } else {
        Write-Host (" {0,8}  ja otimizado" -f (Format-Size $before)) -ForegroundColor DarkGray
      }
      return [pscustomobject]@{ Before = $before; After = [math]::Min($before, $after); Written = $false }
    }

    if ($gain -le 0) {
      # Nao encolheu: preserva o original.
      if (-not $InPlace) { Copy-Item -LiteralPath $File.FullName -Destination (Join-Path $DestDir $File.Name) -Force }
      Write-Host (" {0,8}  ja otimizado (mantido)" -f (Format-Size $before)) -ForegroundColor DarkGray
      return [pscustomobject]@{ Before = $before; After = $before; Written = $false }
    }

    $dest = if ($InPlace) { $File.FullName } else { Join-Path $DestDir $File.Name }
    Move-Item -LiteralPath $tmp -Destination $dest -Force
    Write-Host (" {0,8} -> {1,8}  (-{2}%)" -f (Format-Size $before), (Format-Size $after), $pct) -ForegroundColor Green
    return [pscustomobject]@{ Before = $before; After = $after; Written = $true }

  } catch {
    Write-Host "  ERRO: $($_.Exception.Message)" -ForegroundColor Red
    if (-not $ReportOnly -and -not $InPlace) {
      Copy-Item -LiteralPath $File.FullName -Destination (Join-Path $DestDir $File.Name) -Force -ErrorAction SilentlyContinue
    }
    return [pscustomobject]@{ Before = $before; After = $before; Written = $false }
  } finally {
    if (Test-Path -LiteralPath $tmpDir) { Remove-Item -LiteralPath $tmpDir -Recurse -Force -ErrorAction SilentlyContinue }
  }
}

function Format-Size {
  param([long]$Bytes)
  if ($Bytes -ge 1MB) { return "{0:N2} MB" -f ($Bytes / 1MB) }
  return "{0:N0} KB" -f ($Bytes / 1KB)
}

# --- COLETA ---

$files = @()
if (Test-Path -LiteralPath $Path -PathType Container) {
  $gci = @{ LiteralPath = $Path; File = $true }
  if ($Recurse) { $gci.Recurse = $true }
  $files = @(Get-ChildItem @gci | Where-Object {
      $_.Extension -match '^\.jpe?g$' -and $_.DirectoryName -notmatch [regex]::Escape($OutDirName)
    })
  $baseDir = (Resolve-Path -LiteralPath $Path).Path
} elseif (Test-Path -LiteralPath $Path -PathType Leaf) {
  $f = Get-Item -LiteralPath $Path
  if ($f.Extension -notmatch '^\.jpe?g$') { throw "Nao e um JPG: $Path" }
  $files = @($f)
  $baseDir = $f.DirectoryName
} else {
  throw "Caminho nao encontrado: $Path"
}

if ($files.Count -eq 0) {
  Write-Host "    Nenhum JPG encontrado." -ForegroundColor DarkGray
  return
}

$destDir = if ($Output) { $Output } else { Join-Path $baseDir $OutDirName }
if (-not $ReportOnly -and -not $InPlace -and -not (Test-Path -LiteralPath $destDir)) {
  New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

$modeLabel = if ($Mode -eq 'lossless') { 'LOSSLESS (pixel identico)' } else { "VISUAL (Q$Quality, re-encoda)" }
Write-Host ""
Write-Host "    $($files.Count) JPG(s) | motor: $engine | modo: $modeLabel" -ForegroundColor Cyan
if ($ReportOnly)    { Write-Host "    [i] Diagnostico apenas - nada sera gravado." -ForegroundColor DarkYellow }
elseif ($InPlace)   { Write-Host "    [!] IN-PLACE: originais serao sobrescritos (so se encolherem)." -ForegroundColor DarkYellow }
else                { Write-Host "    Saida: $destDir" -ForegroundColor DarkGray }
if ($Mode -eq 'lossless' -and -not $KeepMetadata) {
  Write-Host "    [i] Metadados removidos. Arte CMYK com ICC? use -KeepMetadata." -ForegroundColor DarkGray
}
Write-Host ""

$totalBefore = 0; $totalAfter = 0; $written = 0; $i = 0
foreach ($f in $files) {
  $i++
  Write-Host ("    [{0}/{1}] {2}" -f $i, $files.Count, $f.Name) -NoNewline -ForegroundColor White

  # Espelha a estrutura de subpastas quando recursivo.
  $thisDest = $destDir
  if (-not $InPlace -and -not $ReportOnly -and $Recurse) {
    $rel = $f.DirectoryName.Substring($baseDir.Length).TrimStart('\', '/')
    if ($rel) { $thisDest = Join-Path $destDir $rel }
    if (-not (Test-Path -LiteralPath $thisDest)) { New-Item -ItemType Directory -Path $thisDest -Force | Out-Null }
  }

  $r = Compress-OneJpg -File $f -DestDir $thisDest
  $totalBefore += $r.Before
  $totalAfter  += $r.After
  if ($r.Written) { $written++ }
}

$totalPct = if ($totalBefore -gt 0) { [math]::Round(100 - ($totalAfter / $totalBefore * 100), 1) } else { 0 }
Write-Host ""
Write-Host ("    Total: {0} -> {1} (-{2}%) | {3} arquivo(s) otimizado(s)" -f (Format-Size $totalBefore), (Format-Size $totalAfter), $totalPct, $written) -ForegroundColor Green
if ($ReportOnly) { Write-Host "    Rode sem -ReportOnly para gravar." -ForegroundColor DarkGray }
