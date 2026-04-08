param(
    [string]$Path = ".",
    [switch]$DryRun
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

    # Busca PDFs recursivamente
    $pdfs = Get-ChildItem -Path $Path -Filter "*.pdf" -Recurse

    if ($pdfs.Count -lt 2) {
        Write-Host "    [!] Menos de 2 PDFs encontrados. Nada a juntar." -ForegroundColor Yellow
        return
    }

    # Ordenacao natural: extrai numeros do inicio do nome para sort correto
    $sorted = $pdfs | Sort-Object {
        $name = $_.BaseName
        # Extrai prefixo numerico se existir (ex: "01_intro" -> 1, "10_cap" -> 10)
        if ($name -match '^\d+') { [int]$Matches[0] } else { [int]::MaxValue }
    }, { $_.BaseName }

    Write-Host "    Ordem de merge:" -ForegroundColor Gray
    $i = 1
    foreach ($pdf in $sorted) {
        Write-Host "    $i. $($pdf.Name)" -ForegroundColor DarkGray
        $i++
    }

    $parentName = (Get-Item (Resolve-Path $Path)).Name
    $output = Join-Path $Path "$parentName-merged.pdf"

    if ($DryRun) {
        Write-Host "    [DRY-RUN] Geraria: $output" -ForegroundColor DarkYellow
        return
    }

    # Verifica se qpdf esta disponivel
    $qpdf = Get-Command qpdf -ErrorAction SilentlyContinue
    if (-not $qpdf) {
        Write-Host "    [!] qpdf nao encontrado. Instale com: winget install qpdf" -ForegroundColor Red
        Write-Host "    Ou: choco install qpdf" -ForegroundColor Red
        return
    }

    $inputFiles = ($sorted | ForEach-Object { "`"$($_.FullName)`"" }) -join " "
    $cmd = "qpdf --empty --pages $inputFiles -- `"$output`""
    Invoke-Expression $cmd

    if (Test-Path $output) {
        $size = [math]::Round((Get-Item $output).Length / 1MB, 1)
        Write-Host "    [OK] Gerado: $output (${size}MB)" -ForegroundColor Green
    } else {
        Write-Host "    [!] Erro ao gerar PDF." -ForegroundColor Red
    }
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

# --- MENU DE EXECUÇÃO ---

Show-Header
Write-Host "    [1] " -NoNewline; Write-Host "Organizar Avatares/Icons/Square" -ForegroundColor White
Write-Host "    [2] " -NoNewline; Write-Host "Extrair Transparentes" -ForegroundColor White
Write-Host "    [3] " -NoNewline; Write-Host "Separar por Extensão (PDF/AI/SVG)" -ForegroundColor White
Write-Host "    [4] " -NoNewline; Write-Host "Extrair PNGs para a Raiz" -ForegroundColor White
Write-Host "    [5] " -NoNewline; Write-Host "Organizar TUDO (Completo)" -ForegroundColor Cyan
Write-Host "    [6] " -NoNewline; Write-Host "Juntar PDFs em um unico arquivo" -ForegroundColor Magenta
Write-Host "    [7] " -NoNewline; Write-Host "Sair" -ForegroundColor Gray
Write-Host ""
Write-Host "    --------------------------------------------" -ForegroundColor Gray

$escolha = Read-Host "Escolha uma opção"

if ($escolha -eq "7") { exit }

switch ($escolha) {
    "1" { Organizar-Avatar }
    "2" { Organizar-Transparentes }
    "3" { Organizar-Por-Extensao }
    "4" { Extrair-PNGs-Para-Raiz }
    "5" { Organizar-Avatar; Organizar-Transparentes; Organizar-Vetor; Extrair-PNGs-Para-Raiz }
    "6" { Juntar-PDFs }
    default { Write-Host "`n    [!] Opção inválida." -ForegroundColor Red; Start-Sleep -Seconds 1 }
}

if ($escolha -match "^[1-6]$") {
    Show-Resumo
    pause
}
