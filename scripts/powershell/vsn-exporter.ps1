# Visant Exporter - Workspace Mirror
# Fonte canonica in-repo: public/vsn-exporter/vsn-exporter.ps1
# (antes apontava para Z:\VISANT\Copilot®\VSN Exporter — superseded)

$canonical = Join-Path $PSScriptRoot "..\..\public\vsn-exporter\vsn-exporter.ps1"
if (-not (Test-Path -LiteralPath $canonical)) {
    Write-Host "[X] Nao encontrei a fonte canonica: $canonical" -ForegroundColor Red
    exit 1
}
& $canonical @args
