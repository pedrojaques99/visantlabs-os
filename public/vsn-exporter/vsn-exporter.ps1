param(
    [string]$Path = ".",
    [switch]$DryRun,
    [switch]$Merge,
    [switch]$Convert,
    [switch]$Split,
    [switch]$Rasterize,
    [switch]$ToFigma,
    [switch]$ToJPG,
    [int]$JPGQuality = 90
)

# --- SYSTEM SETUP ---
$OutputEncoding = [System.Text.Encoding]::UTF8
[console]::InputEncoding = [System.Text.Encoding]::UTF8
[console]::OutputEncoding = [System.Text.Encoding]::UTF8

$script:Path = $Path
$script:Counters = @{ Avatar = 0; Transparente = 0; Vetor = 0; Extensao = 0; PNG = 0; Separado = 0; JPG = 0; Webp = 0; OCR = 0; PDFImg = 0 }
$script:ToolCache = @{}
$script:OrganizedDirs = @('Avatar', 'Transparentes', 'Vetor', 'PNG', 'JPG_Export', 'WebP_Export', 'SVG_Export', 'OCR_Output')

# Repo root resolves from public/vsn-exporter/ -> ../../ . Falls back to script dir if standalone.
$script:RepoRoot = try { (Resolve-Path (Join-Path $PSScriptRoot "..\..") -ErrorAction Stop).Path } catch { $PSScriptRoot }
$script:ScriptsDir = Join-Path $script:RepoRoot "scripts"

# --- MODULES ---
# Dot-source via escaped path to handle special chars (® in Copilot®)
$script:LibDir = Join-Path $PSScriptRoot "lib"
foreach ($mod in @('log','tools','organize','pdf','image','delivery')) {
    $modPath = Join-Path $script:LibDir "$mod.ps1"
    if (Test-Path -LiteralPath $modPath) {
        $escaped = $modPath -replace "'", "''"
        Invoke-Expression ". '$escaped'"
    }
}

Initialize-Log
Write-Log "Session started | DryRun=$DryRun Merge=$Merge Convert=$Convert Split=$Split Rasterize=$Rasterize ToFigma=$ToFigma ToJPG=$ToJPG"

# --- GLITCH LOADER ENGINE ---
$script:GlitchSync = $null
$script:GlitchRS = $null
$script:GlitchPS = $null

function Start-Glitch {
    param($Text = "SYSTEM_SYNC")
    $script:GlitchSync = [hashtable]::Synchronized(@{ Running = $true; Text = $Text.ToUpper() })
    $script:GlitchRS = [runspacefactory]::CreateRunspace()
    $script:GlitchRS.Open()
    $script:GlitchRS.SessionStateProxy.SetVariable("GlitchSync", $script:GlitchSync)
    $script:GlitchPS = [powershell]::Create().AddScript({
            $chars = @("*", ".", "/", "-", "+", "x")
            while ($GlitchSync.Running) {
                $g = ""; for ($i = 0; $i -lt 2; $i++) { $g += $chars[(Get-Random -Max $chars.Length)] }
                Write-Host "`r  $($GlitchSync.Text) $g " -NoNewline -ForegroundColor Gray
                Start-Sleep -Milliseconds 150
            }
            Write-Host ("`r" + " " * 80 + "`r") -NoNewline
        })
    $script:GlitchPS.Runspace = $script:GlitchRS
    $script:GlitchHandle = $script:GlitchPS.BeginInvoke()
}

function Stop-Glitch {
    if ($script:GlitchSync) {
        $script:GlitchSync.Running = $false
        Start-Sleep -Milliseconds 100
        if ($script:GlitchPS) { try { $script:GlitchPS.EndInvoke($script:GlitchHandle) } catch {} $script:GlitchPS.Dispose() }
        if ($script:GlitchRS) { $script:GlitchRS.Close(); $script:GlitchRS.Dispose() }
    }
}

function Invoke-Glitch {
    param($Text, [scriptblock]$Action)
    Start-Glitch $Text
    try { & $Action } finally { Stop-Glitch }
}

function Write-LogAction {
    param([string]$Action, [string]$From, [string]$To)
    $prefix = if ($DryRun) { "DRY-RUN" } else { "OK" }
    $leaf = $From | Split-Path -Leaf
    Write-Host "    [$prefix] ${Action} - $leaf -> $To" -ForegroundColor $(if ($DryRun) { "DarkYellow" } else { "DarkGray" })
}

function Show-Header {
    try { Clear-Host } catch {}
    Write-Host ""
    Write-Host '      _    __ _________ ___    _   __ ______' -ForegroundColor Cyan
    Write-Host '     | |  / //  _/ ___//   |  / | / //_  __/' -ForegroundColor Cyan
    Write-Host '     | | / / / / \__ \/ /| | /  |/ /  / /   ' -ForegroundColor Cyan
    Write-Host '     | |/ /_/ / ___/ / ___ |/ /|  /  / /    ' -ForegroundColor Cyan
    Write-Host '     |___//___//____/_/  |_/_/ |_/  /_/     ' -ForegroundColor Cyan
    Write-Host ''
    Write-Host '      labs // copilot // creative brazil' -ForegroundColor Gray
    Write-Host '      -------------------------------------------' -ForegroundColor DarkGray
    $resolvedPath = try { (Resolve-Path $Path -ErrorAction Stop).Path } catch { $Path }
    Write-Host "      PATH: $resolvedPath" -ForegroundColor DarkGray
    Write-Host "      Q-JPG: $JPGQuality%" -ForegroundColor DarkGray
    if ($DryRun) { Write-Host '      [!] MODO SIMULACAO ATIVO' -ForegroundColor DarkYellow }
    Write-Host ""
}

# --- EXECUCAO AUTOMATICA (SWITCHES) ---

if ($Merge) {
    Show-Header
    Invoke-Glitch "Merging" { Merge-PDFs }
    exit
}

if ($Convert) {
    Show-Header
    Invoke-Glitch "Vetorizing" { Convert-ParaSVG }
    exit
}

if ($Split) {
    Show-Header
    Invoke-Glitch "Splitting" { Split-PDFs }
    exit
}

if ($Rasterize) {
    Show-Header
    Invoke-Glitch "Rasterizing" { Convert-PDFParaPNG }
    exit
}


if ($ToFigma) {
    Show-Header
    Invoke-Glitch "Figma_Prep" { Initialize-ParaFigma }
    Show-Resumo
    Read-Host "`n    [Enter para continuar]" | Out-Null
    exit
}

if ($ToJPG) {
    Show-Header
    Invoke-Glitch "JPG_Convert" { Convert-PNGParaJPG }
    Show-Resumo
    exit
}

# --- MENU DE EXECUCAO ---

function Get-MenuItems {
    @(
        @{ Label = "1. Avatares/Icons/Square";   Group = "ORGANIZACAO"; Action = { Invoke-Glitch "Organizing" { Group-Avatar } } },
        @{ Label = "2. Extrair Transparentes";   Group = "ORGANIZACAO"; Action = { Invoke-Glitch "Extracting" { Export-Transparentes } } },
        @{ Label = "3. Separar por Extensao";    Group = "ORGANIZACAO"; Action = {
            $r = Read-Host "    Recursivo? Processa subpastas (s/N)"
            $rec = $r -match '^[sSyY]'
            Invoke-Glitch "Sorting" { Group-PorExtensao -Recurse:$rec }
        } },
        @{ Label = "4. Agrupar Pasta /Vetor";    Group = "ORGANIZACAO"; Action = { Invoke-Glitch "Grouping" { Group-Vetor } } },
        @{ Label = "5. Extrair PNGs para Raiz";  Group = "ORGANIZACAO"; Action = { Invoke-Glitch "Cleaning" { Export-PNGsParaRaiz } } },
        @{ Label = "6. ORGANIZAR TUDO";          Group = "ORGANIZACAO"; Action = {
            Invoke-Glitch "Full_Sync" { Group-Avatar; Export-Transparentes; Group-Vetor -Recurse; Export-PNGsParaRaiz }
        } },

        @{ Label = "7. Unificar PDFs (Merge)";   Group = "PDF & VETOR"; Action = { Invoke-Glitch "Merging" { Merge-PDFs } } },
        @{ Label = "8. Decompor Paginas PDF";    Group = "PDF & VETOR"; Action = { Invoke-Glitch "Splitting" { Split-PDFs } } },
        @{ Label = "9. PDF para PNG (300dpi)";   Group = "PDF & VETOR"; Action = { Invoke-Glitch "Rasterizing" { Convert-PDFParaPNG } } },
        @{ Label = "10. AI/EPS para SVG";        Group = "PDF & VETOR"; Action = { Invoke-Glitch "Vetorizing" { Convert-ParaSVG } } },
        @{ Label = "11. PDF p/ Figma (Raster+SVG)"; Group = "PDF & VETOR"; Action = { Invoke-Glitch "Figma_Prep" { Initialize-ParaFigma } } },
        @{ Label = "12. PNGs para PDF unico";    Group = "PDF & VETOR"; Action = { Invoke-Glitch "Binding" { Merge-PNGsToPDF } } },
        @{ Label = "13. Reorganizar Paginas PDF";        Group = "PDF & VETOR"; NoPause = $true; Action = { Reorganize-PDFPages } },
        @{ Label = "14. Substituir Pagina PDF";          Group = "PDF & VETOR"; NoPause = $true; Action = { Replace-PDFPage } },
        @{ Label = "15. Extrair Paginas (Range Picker)"; Group = "PDF & VETOR"; NoPause = $true; Action = { Extract-PageRange } },
        @{ Label = "16. OCR Batch (PDF Pesquisavel + JSON custo LLM)"; Group = "PDF & VETOR"; NoPause = $true; Action = { Invoke-OCRBatch } },
        @{ Label = "17. Relatorio de Metadados (JSON)"; Group = "PDF & VETOR"; NoPause = $true; Action = { Show-PDFMetadata } },
        @{ Label = "18. Comprimir PDFs (GS+qpdf)"; Group = "PDF & VETOR"; Action = {
            $ext = Join-Path $script:ScriptsDir "compress-pdf.ps1"
            if (-not (Test-Path $ext)) { Write-Host "    [X] Script nao encontrado: $ext" -ForegroundColor Red; return }
            $target = if (Test-Path $Path -PathType Container) { $Path } else { Split-Path $Path -Parent }
            Write-Host ""
            & $ext -Input $target -Recurse
        } },
        @{ Label = "18. Comprimir PDFs AGRESSIVO (JPEG re-encode)"; Group = "PDF & VETOR"; Action = {
            $ext = Join-Path $script:ScriptsDir "compress-pdf.ps1"
            if (-not (Test-Path $ext)) { Write-Host "    [X] Script nao encontrado: $ext" -ForegroundColor Red; return }
            $target = if (Test-Path $Path -PathType Container) { $Path } else { Split-Path $Path -Parent }
            $dpiIn = Read-Host "    DPI alvo (Enter = 150)"
            $dpi = if ($dpiIn -match '^\d+$') { [int]$dpiIn } else { 150 }
            $qIn  = Read-Host "    JPEG Quality 1-100 (Enter = 70)"
            $q    = if ($qIn -match '^\d+$' -and [int]$qIn -ge 1 -and [int]$qIn -le 100) { [int]$qIn } else { 70 }
            Write-Host ""
            Write-Host "    Config: DPI=$dpi  JPEG=$q%" -ForegroundColor DarkGray
            Write-Host ""
            & $ext -Input $target -Recurse -Aggressive -Dpi $dpi -JpegQuality $q
        } },

        @{ Label = "19. Arte Final CMYK (PDF/X-1a)"; Group = "PDF & VETOR"; NoPause = $true; Action = {
            $pyScript = Join-Path $script:ScriptsDir "arte_final.py"
            if (-not (Test-Path $pyScript)) { Write-Host "    [X] Script nao encontrado: $pyScript" -ForegroundColor Red; return }
            $py = Get-Command python -ErrorAction SilentlyContinue
            if (-not $py) { Write-Host "    [X] Python nao encontrado no PATH" -ForegroundColor Red; return }
            $gs = Get-Command gswin64c -ErrorAction SilentlyContinue
            if (-not $gs) { $gs = Get-Command gswin32c -ErrorAction SilentlyContinue }
            if (-not $gs) { Write-Host "    [X] Ghostscript nao encontrado no PATH (gswin64c)" -ForegroundColor Red; return }
            $entrada = $Path
            if (-not (Test-Path $entrada -PathType Container)) { $entrada = Split-Path $entrada -Parent }
            $pdfs = Get-ChildItem -Path $entrada -Filter "*.pdf" -File -ErrorAction SilentlyContinue
            if ($pdfs.Count -eq 0) { Write-Host "    [!] Nenhum PDF encontrado em $entrada" -ForegroundColor Yellow; return }
            Write-Host "    PDFs encontrados: $($pdfs.Count)" -ForegroundColor Cyan
            Write-Host "    Entrada: $entrada" -ForegroundColor Gray
            $saidaDefault = Join-Path $entrada "arte_final"
            $saidaIn = Read-Host "    Pasta de saida (Enter = $saidaDefault)"
            $saida = if ($saidaIn) { $saidaIn } else { $saidaDefault }
            Write-Host ""
            Invoke-Glitch "CMYK_Convert" {
                & python $pyScript $entrada $saida 2>&1 | Out-Host
            }
            if (Test-Path $saida) {
                $count = (Get-ChildItem $saida -Filter "*.pdf" -File -ErrorAction SilentlyContinue).Count
                Write-Host "    [OK] $count PDF(s) CMYK em: $saida" -ForegroundColor Green
            }
            Read-Host "    [Enter para continuar]" | Out-Null
        } },

        @{ Label = "20. Extrair Imagens de PDFs"; Group = "PDF & VETOR"; NoPause = $true; Action = { Extract-PDFImages } },

        @{ Label = "21. Converter PNG p/ JPG (Q$JPGQuality)"; Group = "IMAGEM & JPG"; Action = { Invoke-Glitch "JPG_Convert" { Convert-PNGParaJPG } } },
        @{ Label = "22. Converter p/ WebP (Social/Web)"; Group = "IMAGEM & JPG"; Action = { Invoke-Glitch "WebP_Convert" { Convert-ToWebP } } },
        @{ Label = "23. Limpar Metadados/Exif"; Group = "IMAGEM & JPG"; Action = { Invoke-Glitch "Optimizing" { Optimize-ImagesMetadata } } },
        @{ Label = "24. Alterar Qualidade JPG"; Group = "IMAGEM & JPG"; NoPause = $true; Action = {
            $q = Read-Host "    Nova Qualidade (1-100)"
            if ($q -match '^\d+$' -and [int]$q -ge 1 -and [int]$q -le 100) {
                $script:JPGQuality = [int]$q
                Write-Host "    [OK] Qualidade definida para $script:JPGQuality%" -ForegroundColor Green
            } else {
                Write-Host "    [!] Valor invalido. Mantenha entre 1 e 100." -ForegroundColor Yellow
            }
            Start-Sleep -Milliseconds 800
        } },

        @{ Label = "25. Gerar INDEX (README)"; Group = "ENTREGA"; Action = { Export-Inde } },
        @{ Label = "26. Empacotar Entrega (.ZIP)"; Group = "ENTREGA"; Action = { Export-Package } },

        @{ Label = "27. Gerar ICO (visant.ico)"; Group = "SISTEMA"; Action = { Convert-ToICO } },

        @{ Label = "28. Abrir Log";              Group = "SISTEMA"; NoPause = $true; Action = {
            $lp = Get-LogPath
            if ($lp -and (Test-Path $lp)) {
                Write-Host "    Log: $lp" -ForegroundColor Cyan
                Start-Process notepad.exe $lp
            } else {
                Write-Host "    [!] Nenhum log encontrado." -ForegroundColor Yellow
            }
            Start-Sleep -Milliseconds 600
        } },
        @{ Label = "29. Alterar Caminho";        Group = "SISTEMA"; NoPause = $true; Action = {
            $newPath = Read-Host "    Digite o novo caminho"
            if (Test-Path $newPath -PathType Container) {
                $script:Path = $newPath
                Write-Host "    [OK] Caminho alterado para: $newPath" -ForegroundColor Green
            } elseif (Test-Path $newPath) {
                Write-Host "    [!] Caminho existe mas nao e uma pasta." -ForegroundColor Yellow
            } else {
                Write-Host "    [X] Caminho nao encontrado." -ForegroundColor Red
            }
            Start-Sleep -Seconds 1
        } },
        @{ Label = "30. Sair";                   Group = "SISTEMA"; NoPause = $true; Action = { exit } }
    )
}

# --- TUI ENGINE: TWO-LEVEL MENU ---

$selectedIndex = 0

function Invoke-MenuItem {
    param($item)
    [Console]::CursorVisible = $true
    Write-Log "Menu action: $($item.Label)"
    try {
        & $item.Action
    }
    catch {
        $crashFile = Join-Path $env:TEMP "vsn-exporter-crash.log"
        $crashInfo = @"
=====================================
VSN Exporter ERROR - $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Action: $($item.Label)
Path: $Path
=====================================
ERROR: $($_.Exception.Message)
TYPE:  $($_.Exception.GetType().FullName)
LINE:  $($_.InvocationInfo.ScriptLineNumber)
FILE:  $($_.InvocationInfo.ScriptName)
CMD:   $($_.InvocationInfo.Line.Trim())
-------------------------------------
STACK:
$($_.ScriptStackTrace)
=====================================
"@
        $crashInfo | Out-File $crashFile -Encoding UTF8
        Write-Log "ACTION CRASH [$($item.Label)]: $($_.Exception.Message)" -Level ERROR

        Write-Host ""
        Write-Host "    ============ ERRO ============" -ForegroundColor Red
        Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "    Linha: $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host "    Detalhes salvos em:" -ForegroundColor Yellow
        Write-Host "    $crashFile" -ForegroundColor Cyan
        Write-Host "    ==============================" -ForegroundColor Red
    }
    if (-not $item.NoPause) { Show-Resumo; Read-Host "`n    [Enter para continuar]" | Out-Null }
    [Console]::CursorVisible = $false
}

function Get-GroupNames {
    param($items)
    $groups = [ordered]@{}
    foreach ($item in $items) {
        if (-not $groups.Contains($item.Group)) {
            $groups[$item.Group] = (New-Object System.Collections.Generic.List[hashtable])
        }
        $groups[$item.Group].Add($item)
    }
    return $groups
}

function Show-GroupMenu {
    param($groups, [ref]$groupIndex)
    $names = @($groups.Keys)

    while ($true) {
        Show-Header
        Write-Host "    MENU PRINCIPAL" -ForegroundColor Magenta
        Write-Host "    -------------------------------------------" -ForegroundColor DarkGray
        Write-Host ""

        for ($i = 0; $i -lt $names.Count; $i++) {
            $count = $groups[$names[$i]].Count
            if ($i -eq $groupIndex.Value) {
                Write-Host "    > $($names[$i])  ($count)" -ForegroundColor Cyan
            } else {
                Write-Host "      $($names[$i])  ($count)" -ForegroundColor White
            }
        }

        Write-Host ""
        Write-Host "    -------------------------------------------" -ForegroundColor DarkGray
        Write-Host "    Up/Down: Navegar  |  Enter: Abrir  |  Esc: Sair" -ForegroundColor DarkGray

        $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

        switch ($key.VirtualKeyCode) {
            38 { $groupIndex.Value = ($groupIndex.Value - 1 + $names.Count) % $names.Count }
            40 { $groupIndex.Value = ($groupIndex.Value + 1) % $names.Count }
            36 { $groupIndex.Value = 0 }
            35 { $groupIndex.Value = $names.Count - 1 }
            27 { [Console]::CursorVisible = $true; exit }
            13 { return "open" }
        }
    }
}

function Show-ItemMenu {
    param($groupName, $groupItems)
    $sel = 0

    while ($true) {
        Show-Header
        Write-Host "    $groupName" -ForegroundColor Magenta
        Write-Host "    -------------------------------------------" -ForegroundColor DarkGray
        Write-Host ""

        for ($i = 0; $i -lt $groupItems.Count; $i++) {
            $label = ($groupItems[$i].Label -replace '^\d+\.\s*', '')
            if ($i -eq $sel) {
                Write-Host "    > $($i + 1). $label" -ForegroundColor Cyan
            } else {
                Write-Host "      $($i + 1). $label" -ForegroundColor White
            }
        }

        Write-Host ""
        Write-Host "    -------------------------------------------" -ForegroundColor DarkGray
        Write-Host "    Up/Down: Navegar  |  Enter: Executar  |  Esc: Voltar" -ForegroundColor DarkGray

        $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

        switch ($key.VirtualKeyCode) {
            38 { $sel = ($sel - 1 + $groupItems.Count) % $groupItems.Count }
            40 { $sel = ($sel + 1) % $groupItems.Count }
            33 { $sel = [Math]::Max(0, $sel - 5) }
            34 { $sel = [Math]::Min($groupItems.Count - 1, $sel + 5) }
            36 { $sel = 0 }
            35 { $sel = $groupItems.Count - 1 }
            27 { return }
            13 {
                Invoke-MenuItem $groupItems[$sel]
                return "reopen"
            }
        }

        if ($key.Character -match '[1-9]') {
            $idx = [int][string]$key.Character - 1
            if ($idx -lt $groupItems.Count) {
                Invoke-MenuItem $groupItems[$idx]
                return "reopen"
            }
        }
    }
}

$script:CrashLog = Join-Path $env:TEMP "vsn-exporter-crash.log"

try {
    [Console]::CursorVisible = $false
    $allItems = Get-MenuItems
    $groups = Get-GroupNames $allItems
    $groupIdx = 0

    while ($true) {
        $result = Show-GroupMenu -groups $groups -groupIndex ([ref]$groupIdx)

        if ($result -eq "open") {
            $gName = @($groups.Keys)[$groupIdx]
            $gItems = $groups[$gName]

            while ($true) {
                $subResult = Show-ItemMenu -groupName $gName -groupItems $gItems
                if ($subResult -eq "reopen") {
                    $allItems = Get-MenuItems
                    $groups = Get-GroupNames $allItems
                    $gItems = $groups[$gName]
                    continue
                }
                break
            }
        }
    }
}
catch {
    [Console]::CursorVisible = $true
    $crashInfo = @"
=====================================
VSN Exporter CRASH - $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Path: $Path
=====================================
ERROR: $($_.Exception.Message)
TYPE:  $($_.Exception.GetType().FullName)
LINE:  $($_.InvocationInfo.ScriptLineNumber)
FILE:  $($_.InvocationInfo.ScriptName)
CMD:   $($_.InvocationInfo.Line.Trim())
-------------------------------------
STACK:
$($_.ScriptStackTrace)
=====================================
"@
    $crashInfo | Out-File $script:CrashLog -Encoding UTF8
    Write-Log "CRASH: $($_.Exception.Message)" -Level ERROR

    Write-Host ""
    Write-Host "    ============ CRASH ============" -ForegroundColor Red
    Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "    Linha: $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor DarkGray
    Write-Host "    Arquivo: $($_.InvocationInfo.ScriptName)" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "    Log salvo em:" -ForegroundColor Yellow
    Write-Host "    $script:CrashLog" -ForegroundColor Cyan
    Write-Host "    ===============================" -ForegroundColor Red
    Write-Host ""
    Read-Host "    [Enter para fechar]"
}
finally {
    [Console]::CursorVisible = $true
}
