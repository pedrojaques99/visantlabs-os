param(
    [string]$Path = ".",
    [switch]$DryRun,
    [switch]$Merge,
    [switch]$Convert
)

# --- CONFIGURAÇÃO ---

$script:Counters = @{ Avatar = 0; Transparente = 0; Vetor = 0; Extensao = 0; PNG = 0 }

function Log-Action {
    param([string]$Action, [string]$From, [string]$To)
    $prefix = if ($DryRun) { "DRY-RUN" } else { "OK" }
    $leaf = $From | Split-Path -Leaf
    Write-Host "    [$prefix] ${Action} - $leaf -> $To" -ForegroundColor $(if ($DryRun) { "DarkYellow" } else { "DarkGray" })
}

# --- FUNÇÕES DE ORGANIZAÇÃO ---

function Organizar-Avatar {
    Write-Host "Consolidando Avatares, Icons e Squares..." -ForegroundColor Cyan
    $rootAvatar = Join-Path $Path "Avatar"
    if (-not $DryRun -and -not (Test-Path $rootAvatar)) { New-Item $rootAvatar -ItemType Directory -Force | Out-Null }

    # 1. Primeiro renomeia -1 para Avatar para manter o padrão
    Get-ChildItem -Path $Path -Filter "*-1*" -Recurse | ForEach-Object {
        $newName = $_.Name -replace "-1", "Avatar"
        Log-Action "RENAME" $_.FullName $newName
        if (-not $DryRun) { Rename-Item $_.FullName -NewName $newName -ErrorAction SilentlyContinue }
        $script:Counters.Avatar++
    }

    # 2. Busca e move (recursivo)
    Get-ChildItem -Path $Path -File -Recurse | Where-Object {
        ($_.FullName -match "Avatar") -or ($_.Name -match "avatar|icon|ícone|square")
    } | ForEach-Object {
        if ($_.FullName -notmatch "^$([Regex]::Escape((Resolve-Path $rootAvatar -ErrorAction SilentlyContinue)))") {
            $ext = $_.Extension.Trim('.').ToUpper()
            $destPath = Join-Path $rootAvatar $ext
            if (-not $DryRun -and -not (Test-Path $destPath)) { New-Item $destPath -ItemType Directory -Force | Out-Null }
            Log-Action "MOVE" $_.FullName $destPath
            if (-not $DryRun) { Move-Item $_.FullName -Destination $destPath -Force -ErrorAction SilentlyContinue }
            $script:Counters.Avatar++
        }
    }

    # 3. Limpa pastas "Avatar" vazias que sobraram
    if (-not $DryRun) {
        Get-ChildItem -Path $Path -Directory -Recurse -Filter "Avatar" | ForEach-Object {
            if ($_.FullName -ne (Resolve-Path $rootAvatar).Path -and (Get-ChildItem $_.FullName).Count -eq 0) {
                Remove-Item $_.FullName -Force
            }
        }
    }
}

function Organizar-Transparentes {
    Write-Host "Extraindo Transparentes..." -ForegroundColor Green
    $rootTrans = Join-Path $Path "Transparentes"
    Get-ChildItem -Path $Path -File -Recurse | Where-Object { $_.Name -match "Transparent|Transparente" } | ForEach-Object {
        if ($_.FullName -notmatch "Transparentes") {
            $ext = $_.Extension.Trim('.').ToUpper()
            $dest = Join-Path $rootTrans $ext
            if (-not $DryRun -and -not (Test-Path $dest)) { New-Item $dest -ItemType Directory -Force | Out-Null }
            Log-Action "MOVE" $_.FullName $dest
            if (-not $DryRun) { Move-Item $_.FullName -Destination $dest -Force -ErrorAction SilentlyContinue }
            $script:Counters.Transparente++
        }
    }
}

function Organizar-Vetor {
    Write-Host "Agrupando Vetores (PDF, AI, SVG, EPS)..." -ForegroundColor Yellow
    $ignore = "Avatar|icon|ícone|square|Transparent|Transparente"

    Get-ChildItem -Path $Path -File | Where-Object { $_.Extension -ne ".png" -and $_.Name -notmatch $ignore } | ForEach-Object {
        $ext = $_.Extension.Trim('.').ToUpper()
        $dest = Join-Path $Path "Vetor\$ext"
        if (-not $DryRun -and -not (Test-Path $dest)) { New-Item $dest -ItemType Directory -Force | Out-Null }
        Log-Action "MOVE" $_.FullName $dest
        if (-not $DryRun) { Move-Item $_.FullName -Destination $dest -Force -ErrorAction SilentlyContinue }
        $script:Counters.Vetor++
    }
}

function Organizar-Por-Extensao {
    Write-Host "Separando por tipo (Exceto PNG)..." -ForegroundColor Blue
    Get-ChildItem -Path $Path -File | Where-Object { $_.Extension -ne ".png" } | ForEach-Object {
        $ext = $_.Extension.Trim('.').ToUpper()
        if ($ext) {
            $dest = Join-Path $Path $ext
            if (-not $DryRun -and -not (Test-Path $dest)) { New-Item $dest -ItemType Directory -Force | Out-Null }
            Log-Action "MOVE" $_.FullName $dest
            if (-not $DryRun) { Move-Item $_.FullName -Destination $dest -Force -ErrorAction SilentlyContinue }
            $script:Counters.Extensao++
        }
    }
}

function Extrair-PNGs-Para-Raiz {
    Write-Host "Extraindo PNGs para a raiz e limpando pastas..." -ForegroundColor Cyan

    Get-ChildItem -Path $Path -Filter "*.png" -Recurse | ForEach-Object {
        if ($_.DirectoryName -ne (Resolve-Path $Path).Path) {
            Log-Action "MOVE" $_.FullName $Path
            if (-not $DryRun) { Move-Item $_.FullName -Destination $Path -Force -ErrorAction SilentlyContinue }
            $script:Counters.PNG++
        }
    }

    if (-not $DryRun) {
        Get-ChildItem -Path $Path -Directory -Recurse -Filter "PNG" | ForEach-Object {
            if ((Get-ChildItem $_.FullName -File).Count -eq 0) {
                Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

function Juntar-PDFs {
    Write-Host "Juntando PDFs (ordem inteligente por nome)..." -ForegroundColor Magenta

    # Prioriza arquivos soltos na pasta atual, se nao encontrar, tenta recursivo
    $pdfs = Get-ChildItem -Path $Path -Filter "*.pdf" -File
    if ($pdfs.Count -lt 2) {
        Write-Host "    [i] Poucos PDFs na raiz. Buscando recursivamente..." -ForegroundColor DarkGray
        $pdfs = Get-ChildItem -Path $Path -Filter "*.pdf" -Recurse
    }

    if ($pdfs.Count -lt 2) {
        Write-Host "    [!] Menos de 2 PDFs encontrados. Nada a juntar." -ForegroundColor Yellow
        return
    }

    # Ordenacao Natural Inteligente (1, 2, 10 em vez de 1, 10, 2)
    # Funciona com qualquer numero no nome (Ex: Pagina_1, Pagina_10, Cap1_Part2)
    $sorted = $pdfs | Sort-Object { 
        [regex]::Replace($_.Name, '\d+', { $args[0].Value.PadLeft(20, '0') }) 
    }

    Write-Host "    Sequencia encontrada:" -ForegroundColor Gray
    $i = 1
    foreach ($pdf in $sorted) {
        Write-Host "    $($i.ToString().PadLeft(2)) | $($pdf.Name)" -ForegroundColor DarkGray
        $i++
    }

    $parentName = (Get-Item (Resolve-Path $Path)).Name
    $output = Join-Path $Path "$parentName-merged.pdf"

    if ($DryRun) {
        Write-Host ""
        Write-Host "    [DRY-RUN] O arquivo seria gerado em: $output" -ForegroundColor DarkYellow
        return
    }

    # Verifica se qpdf esta disponivel (ou busca em caminhos comuns)
    $qpdf = Get-Command qpdf -ErrorAction SilentlyContinue
    if (-not $qpdf) {
        $commonPaths = @(
            "C:\Program Files\qpdf*\bin\qpdf.exe",
            "C:\Program Files (x86)\qpdf*\bin\qpdf.exe",
            "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\qpdf.qpdf*\**\qpdf.exe"
        )
        foreach ($p in $commonPaths) {
            $found = Get-ChildItem -Path $p -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) { $qpdf = $found.FullName; break }
        }
    }

    if (-not $qpdf) {
        Write-Host ""
        Write-Host "    [!] qpdf nao encontrado. Instale com: winget install qpdf" -ForegroundColor Red
        Write-Host "    O merge requer esta ferramenta validada." -ForegroundColor Red
        return
    }

    Write-Host "`n    Mesclando..." -ForegroundColor Magenta -NoNewline
    
    $inputFiles = ($sorted | ForEach-Object { "`"$($_.FullName)`"" }) -join " "
    $cmd = "& `"$qpdf`" --empty --pages $inputFiles -- `"$output`""
    
    try {
        Invoke-Expression $cmd
        Write-Host " Pronto!" -ForegroundColor Green
    } catch {
        Write-Host " Erro!" -ForegroundColor Red
        Write-Host "    $($_.Exception.Message)" -ForegroundColor DarkRed
    }

    if (Test-Path $output) {
        $size = [math]::Round((Get-Item $output).Length / 1MB, 1)
        Write-Host "    [OK] Gerado: $output (${size}MB)" -ForegroundColor Green
    } else {
        Write-Host "    [!] Falha ao gerar arquivo final." -ForegroundColor Red
    }
}

function Converter-Para-SVG {
    Write-Host "Convertendo Vetores (AI/EPS) para SVG (Figma Ready)..." -ForegroundColor Yellow

    $files = Get-ChildItem -Path $Path -Include "*.ai", "*.eps" -File -Recurse
    if ($files.Count -eq 0) {
        Write-Host "    [!] Nenhum arquivo .ai ou .eps encontrado." -ForegroundColor DarkYellow
        return
    }

    # Busca Inkscape
    $inkscape = Get-Command inkscape -ErrorAction SilentlyContinue
    if (-not $inkscape) {
        $inkPaths = @(
            "C:\Program Files\Inkscape\bin\inkscape.exe",
            "C:\Program Files\Inkscape\inkscape.exe",
            "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Inkscape.Inkscape*\**\inkscape.exe"
        )
        foreach ($p in $inkPaths) {
            $found = Get-ChildItem -Path $p -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) { $inkscape = $found.FullName; break }
        }
    }

    if (-not $inkscape) {
        Write-Host "    [!] Inkscape nao encontrado. Ele eh necessario para conversao de alta fidelidade." -ForegroundColor Red
        return
    }

    $svgDir = Join-Path $Path "SVG_Export"
    if (-not $DryRun -and -not (Test-Path $svgDir)) { New-Item $svgDir -ItemType Directory -Force | Out-Null }

    Write-Host "    Processando $($files.Count) arquivos..." -ForegroundColor DarkGray
    foreach ($file in $files) {
        $outPath = Join-Path $svgDir ($file.BaseName + ".svg")
        Write-Host "    [->] $($file.Name)... " -NoNewline -ForegroundColor White
        
        if ($DryRun) {
            Write-Host "Simulado" -ForegroundColor DarkYellow
            continue
        }

        # Comando para Plain SVG + Converter Texto em Caminho (Fidelity)
        $cmd = "& `"$inkscape`" --export-plain-svg --export-text-to-path --export-type=svg --export-filename=`"$outPath`" `"$($file.FullName)`""
        try {
            Invoke-Expression $cmd | Out-Null
            
            # Otimizacao extra com SVGO se disponivel
            if (Get-Command svgo -ErrorAction SilentlyContinue) {
                svgo `"$outPath`" --multipass --quiet
            }

            Write-Host "OK (Cleaned)" -ForegroundColor Green
            $script:Counters.Vetor++
        } catch {
            Write-Host "Erro" -ForegroundColor Red
        }
    }

    Write-Host "    [OK] Exportado para: $svgDir" -ForegroundColor Green
}

function Show-Resumo {
    $total = ($script:Counters.Values | Measure-Object -Sum).Sum
    Write-Host ""
    Write-Host "    ============ RESUMO ============" -ForegroundColor Cyan
    if ($script:Counters.Avatar -gt 0)       { Write-Host "    Avatares/Icons:   $($script:Counters.Avatar)" -ForegroundColor White }
    if ($script:Counters.Transparente -gt 0) { Write-Host "    Transparentes:    $($script:Counters.Transparente)" -ForegroundColor White }
    if ($script:Counters.Vetor -gt 0)        { Write-Host "    Vetores:          $($script:Counters.Vetor)" -ForegroundColor White }
    if ($script:Counters.Extensao -gt 0)     { Write-Host "    Por extensão:     $($script:Counters.Extensao)" -ForegroundColor White }
    if ($script:Counters.PNG -gt 0)          { Write-Host "    PNGs extraídos:   $($script:Counters.PNG)" -ForegroundColor White }
    Write-Host "    --------------------------------" -ForegroundColor Gray
    Write-Host "    Total operações:  $total" -ForegroundColor Cyan
    if ($DryRun) { Write-Host "    (modo simulacao - nada foi movido)" -ForegroundColor DarkYellow }
    Write-Host "    ================================" -ForegroundColor Cyan
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
    Write-Host '      l a b s  //  e x p o r t e r' -ForegroundColor DarkCyan
    Write-Host '      ...................................' -ForegroundColor DarkGray
    Write-Host '      creative technology  //  brazil' -ForegroundColor DarkGray
    Write-Host ''
    if ($DryRun) { Write-Host '      [DRY-RUN] simulacao ativa' -ForegroundColor DarkYellow }
    if ($Path -ne ".") { Write-Host "      dir: $Path" -ForegroundColor DarkGray }
    Write-Host ""
}

# --- EXECUCAO AUTOMATICA (SWITCHES) ---

if ($Merge) {
    Show-Header
    Juntar-PDFs
    exit
}

if ($Convert) {
    Show-Header
    Converter-Para-SVG
    exit
}

# --- MENU DE EXECUCAO ---

Show-Header
Write-Host "    [1] " -NoNewline; Write-Host "Organizar Avatares/Icons/Square" -ForegroundColor White
Write-Host "    [2] " -NoNewline; Write-Host "Extrair Transparentes" -ForegroundColor White
Write-Host "    [3] " -NoNewline; Write-Host "Separar por Extensão (PDF/AI/SVG)" -ForegroundColor White
Write-Host "    [4] " -NoNewline; Write-Host "Extrair PNGs para a Raiz" -ForegroundColor White
Write-Host "    [5] " -NoNewline; Write-Host "Organizar TUDO (Completo)" -ForegroundColor Cyan
Write-Host "    [6] " -NoNewline; Write-Host "Juntar PDFs em um unico arquivo" -ForegroundColor Magenta
Write-Host "    [7] " -NoNewline; Write-Host "Converter AI/EPS para SVG (Figma Ready)" -ForegroundColor Yellow
Write-Host "    [8] " -NoNewline; Write-Host "Sair" -ForegroundColor Gray
Write-Host ""
Write-Host "    --------------------------------------------" -ForegroundColor Gray

$escolha = Read-Host "Escolha uma opção"

if ($escolha -eq "8") { exit }

switch ($escolha) {
    "1" { Organizar-Avatar }
    "2" { Organizar-Transparentes }
    "3" { Organizar-Por-Extensao }
    "4" { Extrair-PNGs-Para-Raiz }
    "5" { Organizar-Avatar; Organizar-Transparentes; Organizar-Vetor; Extrair-PNGs-Para-Raiz }
    "6" { Juntar-PDFs }
    "7" { Converter-Para-SVG }
    default { Write-Host "`n    [!] Opção inválida." -ForegroundColor Red; Start-Sleep -Seconds 1 }
}

if ($escolha -match "^[1-7]$") {
    Show-Resumo
    pause
}
