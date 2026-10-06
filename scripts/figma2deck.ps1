<#
.SYNOPSIS
  PDF do Figma -> deck leve que ABRE no iOS/Mac, com texto selecionavel.

.DESCRIPTION
  O export PDF do Figma nao embarca fonte: vira contorno Type 3 + soft masks +
  transparency groups. No PDFKit da Apple (Preview, Safari, Quick Look, iOS) a
  pagina abre BRANCA ou trava o app; em Acrobat/Chrome abre normal. Nao e' MB,
  e' estrutura. Este wrapper chama o script canonico da skill visant-demanda,
  que achata tudo e recoloca o texto como camada invisivel pesquisavel.

.PARAMETER Path
  PDF de entrada, ou pasta (com -Recurse) pra processar todos os *.pdf.

.PARAMETER Dpi
  DPI inicial. 110 num slide 1920x1080 = 1,5x da tela. Desce sozinho se estourar o teto.

.PARAMETER TetoMB
  Teto de tamanho. Default 10 (WhatsApp/e-mail).
#>
param(
  [Parameter(Mandatory = $true)][string]$Path,
  [int]$Dpi = 110,
  [double]$TetoMB = 10,
  [int]$Quality = 85,
  [switch]$Recurse
)

$ErrorActionPreference = 'Stop'

$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { throw 'Python nao encontrado no PATH' }

# Fonte unica: o .py mora na skill, nao duplicado aqui (cópia divergente
# de script foi problema real neste repo - ver PLAN-vsn-exporter-hardening.md).
$script = Join-Path $env:USERPROFILE '.claude\skills\visant-demanda\scripts\figma2deck.py'
if (-not (Test-Path -LiteralPath $script)) {
  throw "Script canonico nao encontrado: $script (skill visant-demanda)"
}

$alvos = if ($Recurse -or (Test-Path -LiteralPath $Path -PathType Container)) {
  Get-ChildItem -LiteralPath $Path -Filter *.pdf -File -Recurse:$Recurse |
    Where-Object { $_.Name -notmatch '\(iOS\)' }
} else {
  Get-Item -LiteralPath $Path
}

if (-not $alvos) { Write-Host '  [!] Nenhum PDF encontrado.' -ForegroundColor Yellow; return }

Write-Host ''
Write-Host ('  FIGMA -> DECK iOS   {0} arquivo(s) | {1} dpi | teto {2} MB' -f @($alvos).Count, $Dpi, $TetoMB) -ForegroundColor Cyan
Write-Host '  Saida em "<nome> (iOS).pdf". O original fica intacto.' -ForegroundColor DarkGray
Write-Host ''

$falhas = 0
foreach ($f in $alvos) {
  Write-Host ('  ' + $f.Name) -ForegroundColor White
  $out = Join-Path $f.DirectoryName ($f.BaseName + ' (iOS).pdf')
  & $py.Source $script $f.FullName $out --dpi $Dpi --teto-mb $TetoMB --quality $Quality
  if ($LASTEXITCODE -ne 0) { $falhas++; Write-Host '    [X] falhou' -ForegroundColor Red }
}
Write-Host ''
if ($falhas) { Write-Host ("  {0} arquivo(s) falharam." -f $falhas) -ForegroundColor Red }
