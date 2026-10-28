# VSN Exporter - Modo por arquivo (nao interativo)
# Roteador fino: recebe arquivos soltos + um id de acao, devolve UMA linha de JSON.
# Nao reescreve as funcoes de lib/: as que so trabalham em pasta rodam numa pasta
# temporaria (stage) com copia dos arquivos, e as saidas voltam pra perto do original.
# As que perguntam (Read-Host) sao substituidas pelo mesmo comando que elas rodariam.

$script:ImageExts = @('tif', 'tiff', 'png', 'jpg', 'jpeg', 'webp', 'bmp')
$script:VectorExts = @('ai', 'eps')

# Ordem = ordem do -ListActions. multi = junta varios arquivos numa saida so.
$script:ActionCatalog = [ordered]@{
    'to-png'       = @{ exts = $script:ImageExts + $script:VectorExts; multi = $false }
    'to-pdf'       = @{ exts = $script:ImageExts; multi = $false }
    'to-jpg'       = @{ exts = $script:ImageExts; multi = $false }
    'to-webp'      = @{ exts = $script:ImageExts; multi = $false }
    'to-ico'       = @{ exts = $script:ImageExts; multi = $false }
    'pdf-to-png'   = @{ exts = @('pdf'); multi = $false }
    'pdf-compress' = @{ exts = @('pdf'); multi = $false }
    'pdf-mobile'   = @{ exts = @('pdf'); multi = $false }
    'pdf-ocr'      = @{ exts = @('pdf'); multi = $false }
    'pdf-split'    = @{ exts = @('pdf'); multi = $false }
    'to-svg'       = @{ exts = $script:VectorExts; multi = $false }
    'to-figma'     = @{ exts = $script:VectorExts + @('pdf'); multi = $false }
    'merge-pdf'    = @{ exts = @('pdf') + $script:ImageExts; multi = $true }
}

# --- JSON (uma linha, ASCII puro: \uXXXX segura acento e (R) em qualquer codepage) ---

function ConvertTo-AsciiJson {
    param($Object)
    $j = ConvertTo-Json -InputObject $Object -Compress -Depth 5
    return [regex]::Replace($j, '[^\x00-\x7F]', { param($m) '\u{0:x4}' -f [int][char]$m.Value })
}

function Write-ActionList {
    $list = foreach ($id in $script:ActionCatalog.Keys) {
        [ordered]@{ id = $id; exts = [object[]]$script:ActionCatalog[$id].exts; multi = $script:ActionCatalog[$id].multi }
    }
    [Console]::Out.WriteLine((ConvertTo-AsciiJson ([object[]]@($list))))
}

# --- HELPERS ---

# Nunca sobrescreve: "nome.ext", "nome (1).ext", "nome (2).ext"...
function Get-UniquePath {
    param([string]$Dir, [string]$Base, [string]$Ext)
    $p = Join-Path $Dir "$Base$Ext"
    $i = 1
    while (Test-Path -LiteralPath $p) { $p = Join-Path $Dir "$Base ($i)$Ext"; $i++ }
    return $p
}

function Get-DestDir {
    param([string]$Source)
    $d = if ($script:ActOut) { $script:ActOut } else { [System.IO.Path]::GetDirectoryName($Source) }
    if (-not (Test-Path -LiteralPath $d)) { New-Item $d -ItemType Directory -Force | Out-Null }
    return $d
}

# Move a saida do stage pra pasta final (nome unico) e registra.
function Publish-Output {
    param([string]$From, [string]$Dir, [string]$Base, [string]$Ext)
    $dest = Get-UniquePath -Dir $Dir -Base $Base -Ext $Ext
    Move-Item -LiteralPath $From -Destination $dest
    $script:ActOutputs.Add($dest)
    return $dest
}

# Pasta inteira (split, Figma): move e registra cada arquivo dentro.
function Publish-Folder {
    param([string]$From, [string]$Dir, [string]$Name)
    $dest = Get-UniquePath -Dir $Dir -Base $Name -Ext ''
    Move-Item -LiteralPath $From -Destination $dest
    Get-ChildItem -LiteralPath $dest -File -Recurse | Sort-Object FullName | ForEach-Object { $script:ActOutputs.Add($_.FullName) }
}

function New-Stage {
    $d = Join-Path $env:TEMP ("vsn-exporter\stage-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
    New-Item $d -ItemType Directory -Force | Out-Null
    $script:ActStages.Add($d)
    return $d
}

function Require-Tool {
    param([string]$Exe, [string]$Nome, [string]$Instalar)
    if (-not $Exe) { throw "$Nome não encontrado. Instale com: $Instalar" }
    return $Exe
}

function Get-Magick { Require-Tool (Get-MagickPath) 'ImageMagick (magick)' 'winget install ImageMagick.ImageMagick' }

# Roda um exe e falha com mensagem curta se o exit code nao for 0.
function Invoke-Tool {
    param([string]$Exe, [string[]]$ToolArgs, [string]$Erro)
    $out = & $Exe @ToolArgs 2>&1
    Write-LogCmd -Tool (Split-Path $Exe -Leaf) -Args ($ToolArgs -join ' ') -Result "exit $LASTEXITCODE"
    if ($LASTEXITCODE -ne 0) {
        Write-Log ($out | Out-String) -Level ERROR
        throw $Erro
    }
}

# AI e EPS viram PDF no stage pras funcoes de PDF (AI ja e PDF por dentro; EPS passa no GS).
function Copy-VectorAsPdf {
    param([string]$Source, [string]$Stage)
    $item = Get-Item -LiteralPath $Source
    $dest = Join-Path $Stage ($item.BaseName + '.pdf')
    if ($item.Extension -ieq '.eps') {
        $gs = Require-Tool (Get-GSPath) 'Ghostscript' 'winget install ArtifexSoftware.GhostScript'
        Invoke-Tool $gs @('-dNOPAUSE', '-dBATCH', '-dQUIET', '-dSAFER', '-dEPSCrop', '-sDEVICE=pdfwrite', "-sOutputFile=$dest", $item.FullName) "Ghostscript falhou ao abrir o EPS: $($item.Name)"
    } else {
        Copy-Item -LiteralPath $Source -Destination $dest
    }
    return $dest
}

# Roda uma funcao de lib/ que le $Path numa pasta stage. O $Path local sombreia
# o do script (escopo dinamico do PowerShell), entao a funcao enxerga o stage.
function Invoke-InStage {
    param([string]$Stage, [scriptblock]$Fn)
    $Path = $Stage
    # Initialize-ParaFigma abre o Explorer no fim: aqui apontaria pro stage, que vai ser apagado.
    function Start-Process { }
    & $Fn
}

# Scripts externos (compress-pdf.ps1) acham gs/qpdf so pelo PATH: empresta o que o tools.ps1 achou.
function Add-ToolDirsToPath {
    foreach ($exe in @((Get-GSPath), (Get-QPDFPath))) {
        if ($exe) {
            $dir = Split-Path $exe -Parent
            if (($env:PATH -split ';') -notcontains $dir) { $env:PATH = "$dir;$env:PATH" }
        }
    }
}

# --- ACOES POR ARQUIVO ---

function Invoke-ActionImage {
    param([string]$Id, [System.IO.FileInfo]$File)
    $magick = Get-Magick
    $dir = Get-DestDir $File.FullName
    $first = $File.FullName + '[0]'   # TIFF multipagina: so a 1a pagina
    $tmp = Join-Path $script:ActStage ([guid]::NewGuid().ToString('N'))

    switch ($Id) {
        'to-png' {
            # Lossless, resolucao maxima, mantem alpha.
            Invoke-Tool $magick @($first, '-define', 'png:compression-level=9', "$tmp.png") "magick falhou em $($File.Name)"
            Publish-Output "$tmp.png" $dir $File.BaseName '.png' | Out-Null
        }
        'to-pdf' {
            # Lossless: pixels 1:1, 300 dpi so define o tamanho da pagina.
            Invoke-Tool $magick @($first, '-background', 'white', '-alpha', 'remove', '-alpha', 'off', '-units', 'PixelsPerInch', '-density', '300', '-compress', 'Zip', "$tmp.pdf") "magick falhou em $($File.Name)"
            Publish-Output "$tmp.pdf" $dir $File.BaseName '.pdf' | Out-Null
        }
        'to-jpg' {
            # Mesma logica do Convert-PNGParaJPG (fundo branco + qualidade $JPGQuality), via magick pra aceitar TIFF/WebP.
            Invoke-Tool $magick @($first, '-background', 'white', '-alpha', 'remove', '-alpha', 'off', '-quality', "$JPGQuality", "$tmp.jpg") "magick falhou em $($File.Name)"
            Publish-Output "$tmp.jpg" $dir $File.BaseName '.jpg' | Out-Null
        }
        'to-webp' {
            # Mesmo comando do Convert-ToWebP (qualidade 80).
            Invoke-Tool $magick @($first, '-quality', '80', "$tmp.webp") "magick falhou em $($File.Name)"
            Publish-Output "$tmp.webp" $dir $File.BaseName '.webp' | Out-Null
        }
        'to-ico' {
            # Convert-ToICO usa System.Drawing, que nao le WebP nem TIFF CMYK: passa por um PNG antes.
            Invoke-Tool $magick @($first, "$tmp.png") "magick falhou em $($File.Name)"
            Convert-ToICO -Source "$tmp.png" -Output "$tmp.ico"
            if (-not (Test-Path -LiteralPath "$tmp.ico")) { throw "Falha ao gerar ICO de $($File.Name)" }
            Publish-Output "$tmp.ico" $dir $File.BaseName '.ico' | Out-Null
        }
    }
}

# PDF (ou AI/EPS convertido) -> PNG 300 dpi pelo Convert-PDFParaPNG.
function Invoke-ActionRaster {
    param([System.IO.FileInfo]$File)
    if (-not (Get-GSPath) -and -not (Get-InkscapePath)) { throw "Ghostscript ou Inkscape não encontrado. Instale com: winget install ArtifexSoftware.GhostScript" }
    $stage = New-Stage
    $pdf = if ($File.Extension -ieq '.pdf') { $d = Join-Path $stage $File.Name; Copy-Item -LiteralPath $File.FullName -Destination $d; $d } else { Copy-VectorAsPdf $File.FullName $stage }
    Invoke-InStage $stage { Convert-PDFParaPNG }
    $pngs = @(Get-ChildItem -LiteralPath (Join-Path $stage 'PNG') -Filter '*.png' -File -ErrorAction SilentlyContinue)
    if ($pngs.Count -eq 0) { throw "Nenhuma imagem gerada de $($File.Name)" }
    $dir = Get-DestDir $File.FullName
    $natRe = [regex]'\d+'
    foreach ($png in ($pngs | Sort-Object { $natRe.Replace($_.Name, { $args[0].Value.PadLeft(20, '0') }) })) {
        # Pagina unica vira "<nome>.png"; varias mantem "_page-N".
        $base = if ($pngs.Count -eq 1) { $File.BaseName } else { $png.BaseName }
        Publish-Output $png.FullName $dir $base '.png' | Out-Null
    }
}

function Invoke-ActionCompress {
    param([System.IO.FileInfo]$File, [switch]$Mobile)
    $ext = Join-Path $script:ScriptsDir 'compress-pdf.ps1'
    if (-not (Test-Path -LiteralPath $ext)) { throw "Script não encontrado: compress-pdf.ps1" }
    Require-Tool (Get-GSPath) 'Ghostscript' 'winget install ArtifexSoftware.GhostScript' | Out-Null
    if ($Mobile) { Require-Tool (Get-QPDFPath) 'qpdf' 'winget install qpdf.qpdf' | Out-Null }
    Add-ToolDirsToPath
    $tmp = Join-Path $script:ActStage ([guid]::NewGuid().ToString('N') + '.pdf')
    # Mesmos defaults do menu: comum = 300 dpi; celular = 150 dpi / JPEG 85 / linearizado.
    if ($Mobile) { & $ext -Input $File.FullName -Output $tmp -Mobile }
    else         { & $ext -Input $File.FullName -Output $tmp }
    if (-not (Test-Path -LiteralPath $tmp)) { throw "Falha ao comprimir $($File.Name)" }
    $suffix = if ($Mobile) { ' - MOBILE' } else { ' -' }
    Publish-Output $tmp (Get-DestDir $File.FullName) ($File.BaseName + $suffix) '.pdf' | Out-Null
}

function Invoke-ActionOcr {
    param([System.IO.FileInfo]$File)
    # Invoke-OCRBatch pergunta o idioma e pausa: aqui roda o mesmo ocrmypdf com o default dele (por+eng).
    $ocr = Require-Tool (Get-OcrMyPdfPath) 'ocrmypdf' 'pip install ocrmypdf (e winget install UB-Mannheim.TesseractOCR)'
    $tmp = Join-Path $script:ActStage ([guid]::NewGuid().ToString('N') + '.pdf')
    Invoke-Tool $ocr @('--language', 'por+eng', '--optimize', '1', '--skip-text', '--quiet', $File.FullName, $tmp) "ocrmypdf falhou em $($File.Name) (Tesseract com idioma por instalado?)"
    Publish-Output $tmp (Get-DestDir $File.FullName) ($File.BaseName + ' - OCR') '.pdf' | Out-Null
}

function Invoke-ActionSplit {
    param([System.IO.FileInfo]$File)
    Require-Tool (Get-QPDFPath) 'qpdf' 'winget install qpdf.qpdf' | Out-Null
    $stage = New-Stage
    Copy-Item -LiteralPath $File.FullName -Destination (Join-Path $stage $File.Name)
    Invoke-InStage $stage { Split-PDFs }
    $sliceDir = Join-Path $stage "$($File.BaseName) separated"
    if (-not (Test-Path -LiteralPath $sliceDir) -or -not (Get-ChildItem -LiteralPath $sliceDir -File)) { throw "qpdf não gerou páginas de $($File.Name)" }
    Publish-Folder $sliceDir (Get-DestDir $File.FullName) "$($File.BaseName) separated"
}

function Invoke-ActionSvg {
    param([System.IO.FileInfo]$File)
    Require-Tool (Get-InkscapePath) 'Inkscape' 'winget install Inkscape.Inkscape' | Out-Null
    $stage = New-Stage
    Copy-Item -LiteralPath $File.FullName -Destination (Join-Path $stage $File.Name)
    Invoke-InStage $stage { Convert-ParaSVG }
    $svg = Join-Path $stage "SVG_Export\$($File.BaseName).svg"
    if (-not (Test-Path -LiteralPath $svg)) { throw "Inkscape não gerou SVG de $($File.Name)" }
    Publish-Output $svg (Get-DestDir $File.FullName) $File.BaseName '.svg' | Out-Null
}

function Invoke-ActionFigma {
    param([System.IO.FileInfo]$File)
    if (-not (Get-GSPath) -and -not (Get-InkscapePath)) { throw "Ghostscript ou Inkscape não encontrado. Instale com: winget install Inkscape.Inkscape" }
    $stage = New-Stage
    if ($File.Extension -ieq '.pdf') { Copy-Item -LiteralPath $File.FullName -Destination (Join-Path $stage $File.Name) }
    else { Copy-VectorAsPdf $File.FullName $stage | Out-Null }
    Invoke-InStage $stage { Initialize-ParaFigma }
    $figmaDir = Join-Path $stage ("Figma_Import_" + $File.BaseName)
    if (-not (Test-Path -LiteralPath $figmaDir) -or -not (Get-ChildItem -LiteralPath $figmaDir -File)) { throw "Nada gerado para o Figma a partir de $($File.Name)" }
    Publish-Folder $figmaDir (Get-DestDir $File.FullName) ("Figma_Import_" + $File.BaseName)
}

# Varios arquivos -> um PDF, na ordem recebida. Imagens viram PDF lossless antes. Nome = 1o arquivo.
function Invoke-ActionMerge {
    param([System.IO.FileInfo[]]$Items)
    if ($Items.Count -lt 2) { throw "Selecione pelo menos 2 arquivos para unificar." }
    Require-Tool (Get-QPDFPath) 'qpdf' 'winget install qpdf.qpdf' | Out-Null
    $stage = New-Stage
    # Prefixo 001_, 002_... faz a ordem natural do Merge-PDFs ser a ordem da selecao.
    $n = 0
    foreach ($f in $Items) {
        $n++
        $dest = Join-Path $stage (('{0:D3}_' -f $n) + $f.BaseName + '.pdf')
        if ($f.Extension -ieq '.pdf') { Copy-Item -LiteralPath $f.FullName -Destination $dest }
        else {
            $magick = Get-Magick
            Invoke-Tool $magick @(($f.FullName + '[0]'), '-background', 'white', '-alpha', 'remove', '-alpha', 'off', '-units', 'PixelsPerInch', '-density', '300', '-compress', 'Zip', $dest) "magick falhou em $($f.Name)"
        }
    }
    Invoke-InStage $stage { Merge-PDFs }
    $merged = Join-Path $stage ((Split-Path $stage -Leaf) + '-merged.pdf')
    if (-not (Test-Path -LiteralPath $merged)) { throw "qpdf não conseguiu unificar os PDFs" }
    Publish-Output $merged (Get-DestDir $Items[0].FullName) ($Items[0].BaseName + ' - unificado') '.pdf' | Out-Null
}

# --- ENTRADA ---

function Invoke-FileAction {
    param([string]$Id, [string[]]$Paths, [string]$OutDir, [switch]$AsJson)

    $script:ActOutputs = New-Object System.Collections.Generic.List[string]
    $script:ActOut = $OutDir
    $script:ActStages = New-Object System.Collections.Generic.List[string]
    $script:ActStage = $null
    $erro = $null

    try {
        if (-not $Id) { throw "Informe -Action (veja -ListActions)." }
        if (-not $script:ActionCatalog.Contains($Id)) { throw "Ação desconhecida: $Id" }
        $spec = $script:ActionCatalog[$Id]
        if (-not $Paths -or $Paths.Count -eq 0) { throw "Nenhum arquivo informado." }

        $items = foreach ($p in $Paths) {
            if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { throw "Arquivo não encontrado: $(Split-Path $p -Leaf)" }
            $fi = Get-Item -LiteralPath $p
            $e = $fi.Extension.TrimStart('.').ToLower()
            if ($spec.exts -notcontains $e) { throw "Extensão .$e não suportada por $Id ($($fi.Name))" }
            $fi
        }
        $items = @($items)
        if ($OutDir -and -not (Test-Path -LiteralPath $OutDir)) { New-Item $OutDir -ItemType Directory -Force | Out-Null }

        $script:ActStage = New-Stage
        Write-Log "File action: $Id | $($items.Count) arquivo(s) | Out=$OutDir"

        if ($Id -eq 'merge-pdf') { Invoke-ActionMerge $items }
        else {
            foreach ($f in $items) {
                $isVector = $script:VectorExts -contains $f.Extension.TrimStart('.').ToLower()
                switch ($Id) {
                    { $_ -in 'to-pdf', 'to-jpg', 'to-webp', 'to-ico' } { Invoke-ActionImage $Id $f }
                    'to-png'       { if ($isVector) { Invoke-ActionRaster $f } else { Invoke-ActionImage $Id $f } }
                    'pdf-to-png'   { Invoke-ActionRaster $f }
                    'pdf-compress' { Invoke-ActionCompress $f }
                    'pdf-mobile'   { Invoke-ActionCompress $f -Mobile }
                    'pdf-ocr'      { Invoke-ActionOcr $f }
                    'pdf-split'    { Invoke-ActionSplit $f }
                    'to-svg'       { Invoke-ActionSvg $f }
                    'to-figma'     { Invoke-ActionFigma $f }
                }
            }
        }
        if ($script:ActOutputs.Count -eq 0) { throw "Nenhum arquivo gerado." }
    }
    catch {
        $erro = $_.Exception.Message
        Write-Log "FILE ACTION ERROR [$Id]: $erro" -Level ERROR
    }
    finally {
        # Limpa so os stages desta execucao (outra instancia pode estar rodando em paralelo).
        foreach ($d in $script:ActStages) { Remove-Item -LiteralPath $d -Recurse -Force -ErrorAction SilentlyContinue }
    }

    $ok = -not $erro
    if ($AsJson) {
        $res = [ordered]@{ ok = $ok; action = $Id; outputs = [object[]]@($script:ActOutputs); error = $erro }
        [Console]::Out.WriteLine((ConvertTo-AsciiJson $res))
    } else {
        foreach ($o in $script:ActOutputs) { Write-Host "    [OK] $o" -ForegroundColor Green }
        if ($erro) { Write-Host "    [X] $erro" -ForegroundColor Red }
    }
    $script:ActOk = $ok
}
