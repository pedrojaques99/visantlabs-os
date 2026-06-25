# VSN Exporter - Log System
# Logs to %TEMP%\vsn-exporter\vsn-YYYY-MM-DD.log
# Usage: Write-Log "message" / Write-Log "message" -Level ERROR

$script:LogDir  = Join-Path $env:TEMP "vsn-exporter"
$script:LogFile = $null

function Initialize-Log {
    if (-not (Test-Path $script:LogDir)) { New-Item $script:LogDir -ItemType Directory -Force | Out-Null }
    $script:LogFile = Join-Path $script:LogDir ("vsn-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

    $header = @"
=====================================
VSN Exporter - $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Path: $Path
User: $env:USERNAME
=====================================
"@
    Add-Content -Path $script:LogFile -Value $header -Encoding UTF8
}

function Write-Log {
    param(
        [Parameter(Position = 0)][string]$Message,
        [ValidateSet('INFO', 'WARN', 'ERROR', 'DEBUG')][string]$Level = 'INFO'
    )
    if (-not $script:LogFile) { return }
    $ts = Get-Date -Format "HH:mm:ss.fff"
    $line = "[$ts] [$Level] $Message"
    Add-Content -Path $script:LogFile -Value $line -Encoding UTF8
}

function Write-LogCmd {
    param(
        [string]$Tool,
        [string]$Args,
        [string]$Result = "",
        [string]$Error = ""
    )
    if (-not $script:LogFile) { return }
    $ts = Get-Date -Format "HH:mm:ss.fff"
    $line = "[$ts] [CMD] $Tool $Args"
    if ($Result) { $line += " -> $Result" }
    if ($Error)  { $line += " !! $Error" }
    Add-Content -Path $script:LogFile -Value $line -Encoding UTF8
}

function Get-LogPath { return $script:LogFile }

function Show-Resumo {
    $c = $script:Counters
    $total = ($c.Values | Measure-Object -Sum).Sum
    if ($total -eq 0) { return }

    Write-Host ""
    Write-Host "    ============ RESUMO ============" -ForegroundColor Cyan
    foreach ($k in $c.Keys | Sort-Object) {
        if ($c[$k] -gt 0) {
            Write-Host "    $($k.PadRight(14)) $($c[$k])" -ForegroundColor White
        }
    }
    Write-Host "    ================================" -ForegroundColor Cyan

    if ($script:LogFile -and (Test-Path $script:LogFile)) {
        Write-Host "    Log: $script:LogFile" -ForegroundColor DarkGray
    }
}
