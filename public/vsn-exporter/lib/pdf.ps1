function Merge-PDFs {
    Write-Host "Juntando PDFs (ordem inteligente por nome)..." -ForegroundColor Magenta

    $pdfs = Get-ChildItem -Path $Path -Filter "*.pdf" -File
    if ($pdfs.Count -lt 2) {
        Write-Host "    [i] Poucos PDFs na raiz. Buscando recursivamente..." -ForegroundColor DarkGray
        $pdfs = Get-ChildItem -Path $Path -Filter "*.pdf" -Recurse
    }

    if ($pdfs.Count -lt 2) {
        Write-Host "    [!] Menos de 2 PDFs encontrados. Nada a juntar." -ForegroundColor Yellow
        return
    }

    $natRe  = [regex]'\d+'
    $sorted = $pdfs |
        ForEach-Object { $_ | Add-Member -NotePropertyName _SortKey -NotePropertyValue ($natRe.Replace($_.Name, { $args[0].Value.PadLeft(20, '0') })) -PassThru } |
        Sort-Object _SortKey

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

    $qpdf = Get-QPDFPath
    if (-not $qpdf) {
        Write-Host ""
        Write-Host "    [!] qpdf nao encontrado. Instale com: winget install qpdf" -ForegroundColor Red
        Write-Host "    O merge requer esta ferramenta validada." -ForegroundColor Red
        return
    }

    Write-Host "`n    Mesclando..." -ForegroundColor Magenta -NoNewline

    $inputPaths = $sorted | ForEach-Object { $_.FullName }
    try {
        & $qpdf --empty --pages @inputPaths -- $output
        Write-Host " Pronto!" -ForegroundColor Green
    }
    catch {
        Write-Host " Erro!" -ForegroundColor Red
        Write-Host "    $($_.Exception.Message)" -ForegroundColor DarkRed
    }

    if (Test-Path $output) {
        $size = [math]::Round((Get-Item $output).Length / 1MB, 1)
        Write-Host "    [OK] Gerado: $output (${size}MB)" -ForegroundColor Green
    }
    else {
        Write-Host "    [!] Falha ao gerar arquivo final." -ForegroundColor Red
    }
}

function Merge-PNGsToPDF {
    Write-Host "Juntando PNGs em um unico PDF (ordem natural)..." -ForegroundColor Magenta

    $pngs = Get-ChildItem -Path $Path -Filter "*.png" -File
    if ($pngs.Count -lt 1) {
        Write-Host "    [i] Nenhum PNG na raiz. Buscando recursivamente..." -ForegroundColor DarkGray
        $pngs = Get-ChildItem -Path $Path -Filter "*.png" -File -Recurse
    }

    if ($pngs.Count -lt 1) {
        Write-Host "    [!] Nenhum PNG encontrado." -ForegroundColor Yellow
        return
    }

    $natRe  = [regex]'\d+'
    $sorted = $pngs |
        ForEach-Object { $_ | Add-Member -NotePropertyName _SortKey -NotePropertyValue ($natRe.Replace($_.Name, { $args[0].Value.PadLeft(20, '0') })) -PassThru } |
        Sort-Object _SortKey

    Write-Host "    Sequencia ($($sorted.Count) arquivos):" -ForegroundColor Gray
    $i = 1
    foreach ($png in $sorted) {
        Write-Host "    $($i.ToString().PadLeft(3)) | $($png.Name)" -ForegroundColor DarkGray
        $i++
    }

    $parentName = (Get-Item (Resolve-Path $Path)).Name
    $output = Join-Path $Path "$parentName-pngs.pdf"

    if ($DryRun) {
        Write-Host ""
        Write-Host "    [DRY-RUN] Arquivo seria gerado em: $output" -ForegroundColor DarkYellow
        return
    }

    $magick = Get-MagickPath
    if (-not $magick) {
        Write-Host ""
        Write-Host "    [!] ImageMagick nao encontrado. Instale com: winget install ImageMagick.ImageMagick" -ForegroundColor Red
        return
    }

    Write-Host "`n    Montando PDF..." -ForegroundColor Magenta -NoNewline

    $inputPaths = $sorted | ForEach-Object { $_.FullName }
    try {
        & $magick @inputPaths $output
        Write-Host " Pronto!" -ForegroundColor Green
    }
    catch {
        Write-Host " Erro!" -ForegroundColor Red
        Write-Host "    $($_.Exception.Message)" -ForegroundColor DarkRed
        return
    }

    if (Test-Path $output) {
        $size = [math]::Round((Get-Item $output).Length / 1MB, 2)
        Write-Host "    [OK] Gerado: $output (${size}MB)" -ForegroundColor Green
    }
    else {
        Write-Host "    [!] Falha ao gerar arquivo final." -ForegroundColor Red
    }
}

function Convert-ParaSVG {
    Write-Host "Convertendo Vetores (AI/EPS) para SVG (Figma Ready)..." -ForegroundColor Yellow

    $files = Get-ChildItem -Path $Path -Include "*.ai", "*.eps" -File -Recurse
    if ($files.Count -eq 0) {
        Write-Host "    [!] Nenhum arquivo .ai ou .eps encontrado." -ForegroundColor DarkYellow
        return
    }

    $inkscape = Get-InkscapePath
    if (-not $inkscape) {
        Write-Host "    [!] Inkscape nao encontrado. Ele eh necessario para conversao de alta fidelidade." -ForegroundColor Red
        return
    }
    $svgo = Get-SvgoPath

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

        try {
            & $inkscape --export-plain-svg --export-text-to-path --export-type=svg "--export-filename=$outPath" $file.FullName | Out-Null

            if ($svgo) {
                & $svgo $outPath --multipass --quiet 2>$null | Out-Null
            }

            Write-Host "OK (Cleaned)" -ForegroundColor Green
            $script:Counters.Vetor++
        }
        catch {
            Write-Host "Erro" -ForegroundColor Red
        }
    }

    Write-Host "    [OK] Exportado para: $svgDir" -ForegroundColor Green
}

function Split-PDFs {
    Write-Host "Separando PDFs em fatias (paginas individuais)..." -ForegroundColor Magenta

    $pdfs = Get-ChildItem -Path $Path -Filter "*.pdf" -File
    if ($pdfs.Count -eq 0) {
        Write-Host "    [!] Nenhum PDF encontrado na raiz." -ForegroundColor Yellow
        return
    }

    $qpdf = Get-QPDFPath
    if (-not $qpdf) {
        Write-Host "    [!] qpdf nao encontrado. Instale com: winget install qpdf" -ForegroundColor Red
        return
    }

    foreach ($pdf in $pdfs) {
        $sliceDirName = "$($pdf.BaseName) separated"
        $sliceDirPath = Join-Path $pdf.DirectoryName $sliceDirName

        Write-Host "    [->] Processando: $($pdf.Name)" -ForegroundColor White

        if ($DryRun) {
            Write-Host "    [DRY-RUN] Criaria pasta: $sliceDirName" -ForegroundColor DarkYellow
            continue
        }

        if (-not (Test-Path $sliceDirPath)) {
            New-Item $sliceDirPath -ItemType Directory -Force | Out-Null
        }

        $outputTemplate = Join-Path $sliceDirPath "$($pdf.BaseName).pdf"
        try {
            & $qpdf --split-pages $pdf.FullName $outputTemplate 2>$null | Out-Null
            $sliceCount = (Get-ChildItem -Path $sliceDirPath -Filter "*.pdf").Count
            Write-Host "    [OK] Gerado $sliceCount fatias em: $sliceDirName" -ForegroundColor Green
            $script:Counters.Separado++
        }
        catch {
            Write-Host "    [!] Erro ao processar $($pdf.Name)" -ForegroundColor Red
        }
    }
}

function Convert-PDFParaPNG {
    Write-Host "Rasterizando PDFs para PNG (High Res 300 DPI)..." -ForegroundColor Yellow

    $pdfs = Get-ChildItem -Path $Path -Filter "*.pdf" -File
    if ($pdfs.Count -eq 0) {
        Write-Host "    [!] Nenhum PDF encontrado na raiz." -ForegroundColor Yellow
        return
    }

    $gs       = Get-GSPath
    $qpdf     = Get-QPDFPath
    $inkscape = Get-InkscapePath

    if (-not $inkscape -and -not $gs) {
        Write-Host "    [!] Nenhum conversor encontrado (Inkscape ou Ghostscript). Instale um deles." -ForegroundColor Red
        return
    }

    $rootPngPath = Join-Path $Path "PNG"
    if (-not $DryRun -and -not (Test-Path $rootPngPath)) { New-Item $rootPngPath -ItemType Directory -Force | Out-Null }

    $startCount = (Get-ChildItem -Path $rootPngPath -Filter "*.png" -ErrorAction SilentlyContinue).Count

    foreach ($pdf in $pdfs) {
        Write-Host "    [->] Processando: $($pdf.Name)..." -ForegroundColor White

        if ($gs) {
            $outPattern = Join-Path $rootPngPath ($pdf.BaseName + "_page-%d.png")
            try {
                & $gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r300 "-sOutputFile=$outPattern" $pdf.FullName 2>$null | Out-Null
            }
            catch {
                Write-Host "    [!] Erro na conversão via Ghostscript." -ForegroundColor Red
            }
        }
        elseif ($inkscape -and $qpdf) {
            $tempDir = Join-Path $rootPngPath "temp_pdf_slices"
            if (-not (Test-Path $tempDir)) { New-Item $tempDir -ItemType Directory -Force | Out-Null }
            $sliceTemplate = Join-Path $tempDir "$($pdf.BaseName).pdf"
            try {
                & $qpdf --split-pages $pdf.FullName $sliceTemplate 2>$null | Out-Null
                foreach ($slice in (Get-ChildItem -Path $tempDir -Filter "*.pdf")) {
                    $outPng = Join-Path $rootPngPath ($slice.BaseName + ".png")
                    & $inkscape --export-type=png --export-dpi=300 --pdf-poppler "--export-filename=$outPng" $slice.FullName 2>$null | Out-Null
                }
            }
            catch {
                Write-Host "    [!] Erro no processamento via Inkscape." -ForegroundColor Red
            }
            finally {
                if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
            }
        }
        elseif ($inkscape) {
            $outPng = Join-Path $rootPngPath ($pdf.BaseName + ".png")
            try {
                & $inkscape --export-type=png --export-dpi=300 --pdf-poppler "--export-filename=$outPng" $pdf.FullName 2>$null | Out-Null
            } catch { }
        }
    }

    $finalCount = (Get-ChildItem -Path $rootPngPath -Filter "*.png" -ErrorAction SilentlyContinue).Count
    $generated  = $finalCount - $startCount
    if ($generated -gt 0) {
        Write-Host "`n    [OK] $generated imagens geradas em: $rootPngPath" -ForegroundColor Green
        $script:Counters.PNG += $generated
    }
    else {
        Write-Host "    [!] Nenhuma imagem gerada." -ForegroundColor Red
    }
}

function Initialize-ParaFigma {
    Write-Host "Preparando PDF para Figma (Raster + Vetor)..." -ForegroundColor Magenta

    $gs     = Get-GSPath
    $qpdf   = Get-QPDFPath
    $inkExe = Get-InkscapePath
    $svgo   = Get-SvgoPath

    if (-not $gs -and -not $inkExe) {
        Write-Host "    [!] Nenhum engine encontrado (Ghostscript ou Inkscape)." -ForegroundColor Red
        Write-Host "    Instale com: winget install Ghostscript  OU  winget install Inkscape" -ForegroundColor DarkGray
        return
    }

    $pdfs = Get-ChildItem -Path $Path -Filter "*.pdf" -File
    if ($pdfs.Count -eq 0) {
        Write-Host "    [!] Nenhum PDF encontrado na raiz." -ForegroundColor Red
        return
    }

    Write-Host "    Engines: " -NoNewline -ForegroundColor DarkGray
    if ($gs) { Write-Host "Ghostscript " -NoNewline -ForegroundColor Green }
    if ($inkExe) { Write-Host "Inkscape " -NoNewline -ForegroundColor Green }
    if ($qpdf) { Write-Host "qpdf " -NoNewline -ForegroundColor Green }
    Write-Host ""

    $totalPages = 0
    $lastFigmaDir = $null
    $sessionDirs = New-Object System.Collections.Generic.List[string]
    $sessionRaster = 0
    $sessionVector = 0

    foreach ($pdf in $pdfs) {
        $figmaDir = Join-Path $Path ("Figma_Import_" + $pdf.BaseName)
        if (-not $DryRun -and -not (Test-Path $figmaDir)) { New-Item $figmaDir -ItemType Directory -Force | Out-Null }
        $lastFigmaDir = $figmaDir
        $sessionDirs.Add($figmaDir)

        Write-Host ""
        Write-Host "    [->] $($pdf.Name)" -ForegroundColor White

        $pageCount = 1
        if ($qpdf) {
            try {
                $n = & $qpdf --show-npages $pdf.FullName 2>$null
                if ($n -match '^\d+$') { $pageCount = [int]$n }
            }
            catch { $pageCount = 1 }
        }

        Write-Host "          $pageCount pagina(s)" -ForegroundColor DarkGray

        if ($DryRun) {
            for ($pg = 1; $pg -le $pageCount; $pg++) {
                $pageName = if ($pageCount -eq 1) { $pdf.BaseName } else { "{0} - Page {1:D2}" -f $pdf.BaseName, $pg }
                Write-Host "          [DRY-RUN] Page $pg -> $pageName.png + $pageName.svg" -ForegroundColor DarkYellow
                $totalPages++
            }
            continue
        }

        if ($gs) {
            $outPattern = Join-Path $figmaDir ($pdf.BaseName + "__page-%d.png")
            Write-Host "          Raster(GS) batch... " -NoNewline -ForegroundColor DarkGray
            try {
                & $gs -dNOPAUSE -dBATCH -dQUIET -sDEVICE=png16m -r300 "-sOutputFile=$outPattern" $pdf.FullName 2>$null | Out-Null
            } catch { }
            for ($pg = 1; $pg -le $pageCount; $pg++) {
                $tempPng  = Join-Path $figmaDir ($pdf.BaseName + "__page-$pg.png")
                $finalPng = Join-Path $figmaDir ($(if ($pageCount -eq 1) { $pdf.BaseName } else { "{0} - Page {1:D2}" -f $pdf.BaseName, $pg }) + ".png")
                if (Test-Path $tempPng) {
                    if (Test-Path $finalPng) { Remove-Item $finalPng -Force -ErrorAction SilentlyContinue }
                    Move-Item $tempPng $finalPng -ErrorAction SilentlyContinue
                    $sessionRaster++
                    $script:Counters.PNG++
                }
            }
            Write-Host "OK ($sessionRaster PNGs)" -ForegroundColor Green
        }

        for ($pg = 1; $pg -le $pageCount; $pg++) {
            $pageName = if ($pageCount -eq 1) { $pdf.BaseName } else { "{0} - Page {1:D2}" -f $pdf.BaseName, $pg }
            $outPng = Join-Path $figmaDir "$pageName.png"
            $outSvg = Join-Path $figmaDir "$pageName.svg"

            if (-not $gs -and $inkExe) {
                Write-Host "          [$pg/$pageCount] Raster(Ink)... " -NoNewline -ForegroundColor DarkGray
                try {
                    & $inkExe --export-type=png --export-dpi=300 --pdf-poppler --pages=$pg "--export-filename=$outPng" $pdf.FullName 2>$null | Out-Null
                    if (Test-Path $outPng) { $sessionRaster++; $script:Counters.PNG++; Write-Host "OK" -ForegroundColor Green }
                    else { Write-Host "FALHA" -ForegroundColor Red }
                } catch { Write-Host "ERR" -ForegroundColor Red }
            }

            if ($inkExe) {
                Write-Host "          [$pg/$pageCount] Vetor... " -NoNewline -ForegroundColor DarkGray
                try {
                    & $inkExe --export-plain-svg --export-text-to-path --pdf-poppler --pages=$pg --export-type=svg "--export-filename=$outSvg" $pdf.FullName 2>$null | Out-Null
                    if ((Test-Path $outSvg) -and ((Get-Item $outSvg).Length -gt 100)) {
                        $sessionVector++
                        $script:Counters.Vetor++
                        if ($svgo) { & $svgo $outSvg --multipass --quiet 2>$null | Out-Null }
                        Write-Host "OK" -ForegroundColor Green
                    } else {
                        if (Test-Path $outSvg) { Remove-Item $outSvg -Force -ErrorAction SilentlyContinue }
                        Write-Host "VAZIO" -ForegroundColor Red
                    }
                } catch {
                    Write-Host "ERR: $($_.Exception.Message)" -ForegroundColor Red
                }
            }
            $totalPages++
        }
    }

    $rasterCount = $sessionRaster
    $vectorCount = $sessionVector

    Write-Host ""
    Write-Host "    ============ FIGMA IMPORT ============" -ForegroundColor Cyan
    Write-Host "    Total:   $totalPages paginas processadas" -ForegroundColor White
    if ($rasterCount -gt 0) { Write-Host "    Raster:  $rasterCount PNGs (300 DPI)" -ForegroundColor White }
    if ($vectorCount -gt 0) { Write-Host "    Vetor:   $vectorCount SVGs (editaveis)" -ForegroundColor White }
    if ($rasterCount -eq 0 -and $vectorCount -eq 0) { Write-Host "    [!] Nenhum arquivo gerado. Verifique se Ghostscript/Inkscape estao funcionando." -ForegroundColor Red }
    Write-Host "    ----------------------------------------" -ForegroundColor Gray
    Write-Host "    VETOR  -> Arraste SVGs (paths editaveis)" -ForegroundColor Yellow
    Write-Host "    RASTER -> Ctrl+Shift+K (referencia pixel)" -ForegroundColor Yellow
    Write-Host "    ========================================" -ForegroundColor Cyan

    if (-not $DryRun -and $lastFigmaDir -and (Test-Path $lastFigmaDir)) {
        Start-Process explorer.exe $lastFigmaDir
    }
}

function Replace-PDFPage {
    Write-Log "Replace-PDFPage started | Path=$Path"
    $qpdf = Get-QPDFPath
    if (-not $qpdf) {
        Write-Log "qpdf not found" -Level ERROR
        Write-Host "    [!] qpdf nao encontrado. Instale com: winget install qpdf" -ForegroundColor Red
        return
    }

    $gs = Get-GSPath
    $magick = Get-MagickPath

    $pdfs = Get-ChildItem -Path $Path -Filter "*.pdf" -File
    if ($pdfs.Count -eq 0) {
        Write-Host "    [!] Nenhum PDF encontrado na raiz." -ForegroundColor Yellow
        return
    }

    # --- Selecionar PDF alvo ---
    $pdf = $null
    if ($pdfs.Count -eq 1) {
        $pdf = $pdfs[0]
        Write-Host "    PDF: $($pdf.Name)" -ForegroundColor White
    } else {
        Show-Header
        Write-Host "    SUBSTITUIR PAGINA — Selecionar PDF" -ForegroundColor Magenta
        Write-Host ""
        for ($i = 0; $i -lt $pdfs.Count; $i++) {
            Write-Host "    $($i+1). $($pdfs[$i].Name)" -ForegroundColor White
        }
        Write-Host ""
        $choice = Read-Host "    Numero do PDF"
        if ($choice -notmatch '^\d+$' -or [int]$choice -lt 1 -or [int]$choice -gt $pdfs.Count) {
            Write-Host "    [!] Selecao invalida." -ForegroundColor Red; return
        }
        $pdf = $pdfs[[int]$choice - 1]
    }
    Write-Log "Target PDF: $($pdf.FullName)"

    # --- Contar paginas ---
    $n = & $qpdf --show-npages $pdf.FullName 2>$null
    Write-Log "qpdf --show-npages: '$n'"
    if ($n -notmatch '^\d+$' -or [int]$n -lt 1) {
        Write-Host "    [!] Nao foi possivel ler paginas." -ForegroundColor Red; return
    }
    $pageCount = [int]$n

    Show-Header
    Write-Host "    SUBSTITUIR PAGINA  >>  $($pdf.Name)  ($pageCount paginas)" -ForegroundColor Magenta
    Write-Host ""

    # --- Qual pagina substituir ---
    $pageInput = Read-Host "    Numero da pagina a substituir (1-$pageCount)"
    if ($pageInput -notmatch '^\d+$' -or [int]$pageInput -lt 1 -or [int]$pageInput -gt $pageCount) {
        Write-Host "    [!] Pagina invalida." -ForegroundColor Red; return
    }
    $targetPage = [int]$pageInput
    Write-Log "Target page: $targetPage of $pageCount"

    # --- Listar arquivos candidatos (PDFs e imagens, excluindo o proprio) ---
    $candidates = Get-ChildItem -Path $Path -File | Where-Object {
        $_.FullName -ne $pdf.FullName -and
        $_.Extension -match '^\.(pdf|png|jpg|jpeg|tiff?|bmp)$'
    } | Sort-Object Name

    if ($candidates.Count -eq 0) {
        Write-Host "    [!] Nenhum arquivo PDF ou imagem encontrado na pasta para usar como substituto." -ForegroundColor Yellow
        return
    }

    Write-Host ""
    Write-Host "    Arquivos disponiveis:" -ForegroundColor Gray
    for ($i = 0; $i -lt $candidates.Count; $i++) {
        $sizeMB = [math]::Round($candidates[$i].Length / 1MB, 2)
        Write-Host "    $($i+1). $($candidates[$i].Name)  ($sizeMB MB)" -ForegroundColor White
    }
    Write-Host ""
    $replChoice = Read-Host "    Numero do arquivo substituto"
    if ($replChoice -notmatch '^\d+$' -or [int]$replChoice -lt 1 -or [int]$replChoice -gt $candidates.Count) {
        Write-Host "    [!] Selecao invalida." -ForegroundColor Red; return
    }
    $replacement = $candidates[[int]$replChoice - 1]
    Write-Log "Replacement file: $($replacement.FullName)"

    # --- Se for imagem, converter para PDF temporario ---
    $replPdf = $replacement.FullName
    $tempPdf = $null

    if ($replacement.Extension -notmatch '\.pdf$') {
        Write-Host "    Convertendo imagem para PDF..." -ForegroundColor DarkGray -NoNewline
        $tempPdf = Join-Path $env:TEMP "vsn-replace-page-temp.pdf"

        $converted = $false
        if ($magick) {
            Write-Log "Converting image via ImageMagick"
            try {
                & $magick $replacement.FullName -density 300 $tempPdf 2>$null | Out-Null
                if (Test-Path $tempPdf) { $converted = $true }
            } catch {}
        }
        if (-not $converted -and $gs) {
            Write-Log "Converting image via Ghostscript"
            try {
                & $gs -dNOPAUSE -dBATCH -dQUIET -sDEVICE=pdfwrite -r300 "-sOutputFile=$tempPdf" $replacement.FullName 2>$null | Out-Null
                if (Test-Path $tempPdf) { $converted = $true }
            } catch {}
        }
        if (-not $converted) {
            Write-Log "Image conversion failed" -Level ERROR
            Write-Host " Falha!" -ForegroundColor Red
            Write-Host "    [!] Nao foi possivel converter imagem para PDF. Instale ImageMagick." -ForegroundColor Red
            return
        }
        Write-Host " OK" -ForegroundColor Green
        $replPdf = $tempPdf
    }

    # --- Se PDF substituto tem multiplas paginas, perguntar qual ---
    $replPageSpec = "1"
    $replPages = & $qpdf --show-npages $replPdf 2>$null
    if ($replPages -match '^\d+$' -and [int]$replPages -gt 1) {
        $rpInput = Read-Host "    O substituto tem $replPages paginas. Qual usar? (Enter = 1)"
        if ($rpInput -match '^\d+$' -and [int]$rpInput -ge 1 -and [int]$rpInput -le [int]$replPages) {
            $replPageSpec = $rpInput
        }
    }

    # --- Montar comando qpdf ---
    # Logica: pegar paginas 1..(target-1) do original, pagina X do substituto, paginas (target+1)..fim do original
    # --- Sobrescrever ou criar novo ---
    Write-Host ""
    $overwrite = Read-Host "    Sobrescrever o original? (S/n)"
    $overwrite = $overwrite -notmatch '^[nN]'

    Write-Host "    Substituindo pagina $targetPage por $($replacement.Name)..." -ForegroundColor Cyan -NoNewline

    $outPath = if ($overwrite) {
        Join-Path $pdf.DirectoryName ("vsn-replace-temp-" + [guid]::NewGuid().ToString('N').Substring(0,8) + ".pdf")
    } else {
        Join-Path $pdf.DirectoryName "$($pdf.BaseName)-replaced-pg$targetPage.pdf"
    }
    if (Test-Path $outPath) { Remove-Item $outPath -Force }

    $qpdfArgs = @($pdf.FullName, '--pages')

    if ($targetPage -gt 1) {
        $qpdfArgs += '.'
        $qpdfArgs += "1-$($targetPage - 1)"
    }

    $qpdfArgs += $replPdf
    $qpdfArgs += $replPageSpec

    if ($targetPage -lt $pageCount) {
        $qpdfArgs += '.'
        $qpdfArgs += "$($targetPage + 1)-$pageCount"
    }

    $qpdfArgs += '--'
    $qpdfArgs += $outPath

    Write-Log "qpdf args: $($qpdfArgs -join ' ') | overwrite=$overwrite"
    Write-LogCmd -Tool $qpdf -Args ($qpdfArgs -join ' ')

    try {
        $qpdfErr = & $qpdf @qpdfArgs 2>&1
        if ($qpdfErr) { Write-Log "qpdf stderr: $qpdfErr" -Level WARN }

        if (Test-Path $outPath) {
            if ($overwrite) {
                Remove-Item $pdf.FullName -Force
                Move-Item $outPath $pdf.FullName -Force
                $sizeMB = [math]::Round((Get-Item $pdf.FullName).Length / 1MB, 2)
                Write-Host " OK!" -ForegroundColor Green
                Write-Host ""
                Write-Host "    Pagina $targetPage substituida por: $($replacement.Name)" -ForegroundColor Green
                Write-Host "    Atualizado: $($pdf.Name)  (${sizeMB}MB)" -ForegroundColor Green
                Write-Log "Success (overwrite): $($pdf.Name) ($sizeMB MB)"
                if (-not $DryRun) { Start-Process explorer.exe "/select,`"$($pdf.FullName)`"" }
            } else {
                $outName = Split-Path $outPath -Leaf
                $sizeMB = [math]::Round((Get-Item $outPath).Length / 1MB, 2)
                Write-Host " OK!" -ForegroundColor Green
                Write-Host ""
                Write-Host "    Pagina $targetPage substituida por: $($replacement.Name)" -ForegroundColor Green
                Write-Host "    Salvo: $outName  (${sizeMB}MB)" -ForegroundColor Green
                Write-Log "Success: $outName ($sizeMB MB)"
                if (-not $DryRun) { Start-Process explorer.exe "/select,`"$outPath`"" }
            }
        } else {
            Write-Host " Falha ao gerar." -ForegroundColor Red
            Write-Log "Output file not created" -Level ERROR
        }
    } catch {
        Write-Log "qpdf EXCEPTION: $($_.Exception.Message)" -Level ERROR
        Write-Host " Erro: $($_.Exception.Message)" -ForegroundColor Red
    }

    if ($tempPdf -and (Test-Path $tempPdf)) { Remove-Item $tempPdf -Force -ErrorAction SilentlyContinue }
    Write-Log "Replace-PDFPage finished"
    Read-Host "    [Enter para continuar]" | Out-Null
}

function Reorganize-PDFPages {
    Write-Log "Reorganize-PDFPages started | Path=$Path"
    $qpdf = Get-QPDFPath
    if (-not $qpdf) {
        Write-Log "qpdf not found" -Level ERROR
        Write-Host "    [!] qpdf nao encontrado. Instale com: winget install qpdf" -ForegroundColor Red
        return
    }
    Write-Log "qpdf found: $qpdf"

    $pdfs = Get-ChildItem -Path $Path -Filter "*.pdf" -File
    Write-Log "PDFs found: $($pdfs.Count)"
    if ($pdfs.Count -eq 0) {
        Write-Host "    [!] Nenhum PDF encontrado na raiz." -ForegroundColor Yellow
        return
    }

    $pdf = $null
    if ($pdfs.Count -eq 1) {
        $pdf = $pdfs[0]
    } else {
        Show-Header
        Write-Host "    SELECIONAR PDF" -ForegroundColor Magenta
        Write-Host ""
        for ($i = 0; $i -lt $pdfs.Count; $i++) {
            Write-Host "    $($i+1). $($pdfs[$i].Name)" -ForegroundColor White
        }
        Write-Host ""
        $choice = Read-Host "    Numero do arquivo"
        if ($choice -notmatch '^\d+$' -or [int]$choice -lt 1 -or [int]$choice -gt $pdfs.Count) {
            Write-Host "    [!] Selecao invalida." -ForegroundColor Red
            return
        }
        $pdf = $pdfs[[int]$choice - 1]
    }

    Write-Log "Selected PDF: $($pdf.FullName)"
    $n = & $qpdf --show-npages $pdf.FullName 2>$null
    Write-Log "qpdf --show-npages returned: '$n'"
    if ($n -notmatch '^\d+$') {
        Write-Log "Failed to read page count from: $($pdf.FullName)" -Level ERROR
        Write-Host "    [!] Nao foi possivel ler o numero de paginas." -ForegroundColor Red
        return
    }
    $pageCount = [int]$n
    Write-Log "Page count: $pageCount"
    if ($pageCount -lt 2) {
        Write-Host "    [!] PDF tem apenas 1 pagina. Nada a reorganizar." -ForegroundColor Yellow
        return
    }

    [System.Collections.Generic.List[int]]$pages = 1..$pageCount

    $selectedIdx = 0
    $windowSize  = 22
    $scrollTop   = 0
    $statusMsg   = ""

    while ($true) {
        Show-Header
        Write-Host "    REORGANIZAR PAGINAS  >>  $($pdf.Name)  ($($pages.Count) de $pageCount paginas)" -ForegroundColor Magenta
        Write-Host "    Ctrl+Up/Down: Mover   |   Del: Remover   |   Enter: Salvar   |   Esc: Cancelar" -ForegroundColor DarkGray
        Write-Host ""

        if ($selectedIdx -lt $scrollTop) { $scrollTop = $selectedIdx }
        if ($selectedIdx -ge $scrollTop + $windowSize) { $scrollTop = $selectedIdx - $windowSize + 1 }
        $visEnd = [Math]::Min($scrollTop + $windowSize - 1, $pages.Count - 1)

        if ($scrollTop -gt 0) {
            Write-Host "    ... ($scrollTop acima)" -ForegroundColor DarkGray
        }
        for ($i = $scrollTop; $i -le $visEnd; $i++) {
            $cursor = if ($i -eq $selectedIdx) { ">" } else { " " }
            $color  = if ($i -eq $selectedIdx) { "Cyan" } else { "White" }
            $pos    = ($i + 1).ToString().PadLeft(3)
            $orig   = $pages[$i].ToString().PadLeft(3)
            $moved  = if ($pages[$i] -ne ($i + 1)) { " *" } else { "  " }
            Write-Host ("    {0} [{1}] Pagina {2}{3}" -f $cursor, $pos, $orig, $moved) -ForegroundColor $color
        }
        if ($visEnd -lt $pages.Count - 1) {
            Write-Host "    ... ($($pages.Count - 1 - $visEnd) abaixo)" -ForegroundColor DarkGray
        }

        Write-Host ""
        if ($statusMsg) {
            Write-Host "    $statusMsg" -ForegroundColor Green
            $statusMsg = ""
        }
        Write-Host "    Ordem: $($pages -join ',')" -ForegroundColor DarkGray

        $key  = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        $ctrl = ($key.ControlKeyState -band 12) -ne 0

        switch ($key.VirtualKeyCode) {
            38 {
                if ($ctrl) {
                    if ($selectedIdx -gt 0) {
                        $tmp = $pages[$selectedIdx]; $pages[$selectedIdx] = $pages[$selectedIdx - 1]; $pages[$selectedIdx - 1] = $tmp
                        $selectedIdx--
                        $statusMsg = "Pagina movida para cima."
                    }
                } else {
                    $selectedIdx = [Math]::Max(0, $selectedIdx - 1)
                }
            }
            40 {
                if ($ctrl) {
                    if ($selectedIdx -lt $pages.Count - 1) {
                        $tmp = $pages[$selectedIdx]; $pages[$selectedIdx] = $pages[$selectedIdx + 1]; $pages[$selectedIdx + 1] = $tmp
                        $selectedIdx++
                        $statusMsg = "Pagina movida para baixo."
                    }
                } else {
                    $selectedIdx = [Math]::Min($pages.Count - 1, $selectedIdx + 1)
                }
            }
            46 {
                if ($pages.Count -gt 1) {
                    $removed = $pages[$selectedIdx]
                    $pages.RemoveAt($selectedIdx)
                    if ($selectedIdx -ge $pages.Count) { $selectedIdx = $pages.Count - 1 }
                    $statusMsg = "Pagina $removed removida."
                }
            }
            27 {
                Write-Host "`n    Cancelado." -ForegroundColor DarkYellow
                Start-Sleep -Milliseconds 600
                return
            }
            13 {
                $outName = "$($pdf.BaseName)-reorganized.pdf"
                $outPath = Join-Path $pdf.DirectoryName $outName
                if (Test-Path $outPath) { Remove-Item $outPath -Force }
                $pageSpec = $pages -join ','
                Write-Log "Saving reorganized PDF | pages=$pageSpec | output=$outPath"
                Write-LogCmd -Tool $qpdf -Args "$($pdf.FullName) --pages . $pageSpec -- $outPath"
                Write-Host "`n    Aplicando ordem [$pageSpec]..." -ForegroundColor Cyan -NoNewline
                try {
                    $qpdfErr = & $qpdf $pdf.FullName --pages . $pageSpec -- $outPath 2>&1
                    if ($qpdfErr) { Write-Log "qpdf stderr: $qpdfErr" -Level WARN }
                    if (Test-Path $outPath) {
                        $sizeMB = [math]::Round((Get-Item $outPath).Length / 1MB, 2)
                        Write-Host " OK!" -ForegroundColor Green
                        Write-Host "    Salvo: $outName  (${sizeMB}MB)" -ForegroundColor Green
                        if (-not $DryRun) { Start-Process explorer.exe "/select,`"$outPath`"" }
                    } else {
                        Write-Host " Falha ao gerar arquivo." -ForegroundColor Red
                    }
                } catch {
                    Write-Log "qpdf EXCEPTION: $($_.Exception.Message)" -Level ERROR
                    Write-Host " Erro: $($_.Exception.Message)" -ForegroundColor Red
                }
                Write-Log "Reorganize-PDFPages finished"
                Read-Host "    [Enter para continuar]" | Out-Null
                return
            }
        }
    }
}

function ConvertTo-QpdfPageSpec {
    param([string]$RangeInput, [int]$Total)
    $pages = [System.Collections.Generic.List[int]]::new()
    foreach ($part in ($RangeInput -split ',')) {
        $part = $part.Trim() -replace 'fim', "$Total" -replace 'end', "$Total" -replace 'last', "$Total"
        if ($part -match '^(\d+)-(\d+)$') {
            $a = [int]$Matches[1]; $b = [int]$Matches[2]
            if ($a -lt 1 -or $b -gt $Total -or $a -gt $b) { return $null }
            $a..$b | ForEach-Object { $pages.Add($_) }
        } elseif ($part -match '^\d+$') {
            $v = [int]$part
            if ($v -lt 1 -or $v -gt $Total) { return $null }
            $pages.Add($v)
        } else { return $null }
    }
    return ($pages | Select-Object -Unique) -join ','
}

function Extract-PageRange {
    $qpdf = Get-QPDFPath
    if (-not $qpdf) { Write-Host "    [!] qpdf nao encontrado." -ForegroundColor Red; return }

    $pdfs = Get-ChildItem -Path $Path -Filter "*.pdf" -File
    if ($pdfs.Count -eq 0) { Write-Host "    [!] Nenhum PDF encontrado." -ForegroundColor Yellow; return }

    $pdf = $null
    if ($pdfs.Count -eq 1) {
        $pdf = $pdfs[0]
    } else {
        Show-Header
        Write-Host "    SELECIONAR PDF" -ForegroundColor Magenta
        Write-Host ""
        for ($i = 0; $i -lt $pdfs.Count; $i++) { Write-Host "    $($i+1). $($pdfs[$i].Name)" -ForegroundColor White }
        Write-Host ""
        $choice = Read-Host "    Numero do arquivo"
        if ($choice -notmatch '^\d+$' -or [int]$choice -lt 1 -or [int]$choice -gt $pdfs.Count) {
            Write-Host "    [!] Invalido." -ForegroundColor Red; return
        }
        $pdf = $pdfs[[int]$choice - 1]
    }

    $n = & $qpdf --show-npages $pdf.FullName 2>$null
    if ($n -notmatch '^\d+$') { Write-Host "    [!] Nao foi possivel ler paginas." -ForegroundColor Red; return }
    $total = [int]$n

    Show-Header
    Write-Host "    EXTRAIR PAGINAS  >>  $($pdf.Name)  ($total paginas)" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "    Sintaxe aceita:" -ForegroundColor DarkGray
    Write-Host "      1-5          extrair paginas 1 a 5" -ForegroundColor DarkGray
    Write-Host "      1,3,7        paginas especificas" -ForegroundColor DarkGray
    Write-Host "      2-5,8,10-fim combinacoes livres" -ForegroundColor DarkGray
    Write-Host "      fim = ultima pagina ($total)" -ForegroundColor DarkGray
    Write-Host ""

    $input = Read-Host "    Range"
    $spec = ConvertTo-QpdfPageSpec -RangeInput $input -Total $total

    if (-not $spec) {
        Write-Host "    [!] Range invalido ou fora dos limites (1-$total)." -ForegroundColor Red
        Read-Host "    [Enter para continuar]" | Out-Null; return
    }

    $pageList = $spec -split ',' | ForEach-Object { [int]$_ }
    Write-Host ""
    Write-Host "    Paginas selecionadas ($($pageList.Count)): $spec" -ForegroundColor Cyan

    $suffix = $input -replace '[,\s]', '_' -replace '-', 'a'
    $outName = "$($pdf.BaseName)-pg${suffix}.pdf"
    $outPath = Join-Path $pdf.DirectoryName $outName

    if ($DryRun) {
        Write-Host "    [DRY-RUN] Criaria: $outName" -ForegroundColor DarkYellow
        Read-Host "    [Enter para continuar]" | Out-Null; return
    }

    Write-Host "    Extraindo..." -ForegroundColor Cyan -NoNewline
    try {
        & $qpdf $pdf.FullName --pages . $spec -- $outPath 2>$null | Out-Null
        if (Test-Path $outPath) {
            $sizeMB = [math]::Round((Get-Item $outPath).Length / 1MB, 2)
            Write-Host " OK!" -ForegroundColor Green
            Write-Host "    Salvo: $outName  (${sizeMB}MB)" -ForegroundColor Green
            Start-Process explorer.exe "/select,`"$outPath`""
        } else {
            Write-Host " Falha." -ForegroundColor Red
        }
    } catch {
        Write-Host " Erro: $($_.Exception.Message)" -ForegroundColor Red
    }
    Read-Host "    [Enter para continuar]" | Out-Null
}

function Invoke-OCRBatch {
    Show-Header
    Write-Host "    OCR BATCH  >>  PDF Pesquisavel + Relatorio de Custo LLM" -ForegroundColor Magenta
    Write-Host ""

    $ocr = Get-Command ocrmypdf -ErrorAction SilentlyContinue
    if (-not $ocr) {
        Write-Host "    [!] ocrmypdf nao encontrado." -ForegroundColor Red
        Write-Host "    Instale com: pip install ocrmypdf" -ForegroundColor Gray
        Write-Host "    Requer tambem: Tesseract OCR (winget install UB-Mannheim.TesseractOCR)" -ForegroundColor Gray
        Read-Host "    [Enter para continuar]" | Out-Null; return
    }

    $pdfs = Get-ChildItem -Path $Path -Filter "*.pdf" -File
    if ($pdfs.Count -eq 0) { Write-Host "    [!] Nenhum PDF encontrado." -ForegroundColor Yellow; Read-Host "    [Enter para continuar]" | Out-Null; return }

    $lang = Read-Host "    Idioma OCR (Enter = por+eng)"
    if (-not $lang) { $lang = "por+eng" }

    $ocrDir = Join-Path $Path "OCR_Output"
    if (-not $DryRun -and -not (Test-Path $ocrDir)) { New-Item $ocrDir -ItemType Directory -Force | Out-Null }

    $report = [System.Collections.Generic.List[hashtable]]::new()
    $grandTotalTokens = 0
    $grandTotalMs = 0

    Write-Host ""
    foreach ($pdf in $pdfs) {
        Write-Host "    [->] $($pdf.Name)..." -ForegroundColor White -NoNewline

        if ($DryRun) { Write-Host " [DRY-RUN]" -ForegroundColor DarkYellow; continue }

        $outPath = Join-Path $ocrDir $pdf.Name
        $sw = [System.Diagnostics.Stopwatch]::StartNew()

        try {
            & ocrmypdf --language $lang --optimize 1 --skip-text --quiet $pdf.FullName $outPath 2>$null | Out-Null
            $sw.Stop()

            $origKB  = [math]::Round($pdf.Length / 1KB, 1)
            $ocrKB   = if (Test-Path $outPath) { [math]::Round((Get-Item $outPath).Length / 1KB, 1) } else { 0 }

            $qpdf = Get-QPDFPath
            $pageCount = 1
            if ($qpdf) {
                $np = & $qpdf --show-npages $pdf.FullName 2>$null
                if ($np -match '^\d+$') { $pageCount = [int]$np }
            }

            $estimatedChars = $pageCount * 1800
            $pdftotext = Get-Command pdftotext -ErrorAction SilentlyContinue
            if ($pdftotext -and (Test-Path $outPath)) {
                $txtLines = & pdftotext $outPath - 2>$null
                if ($txtLines) {
                    $joined = ($txtLines -join "`n")
                    if ($joined.Length -gt 0) { $estimatedChars = $joined.Length }
                }
            }

            $estimatedTokens = [math]::Ceiling($estimatedChars / 4)
            $grandTotalTokens += $estimatedTokens
            $grandTotalMs     += $sw.ElapsedMilliseconds

            $entry = @{
                file            = $pdf.Name
                pages           = $pageCount
                original_kb     = $origKB
                ocr_kb          = $ocrKB
                processing_ms   = $sw.ElapsedMilliseconds
                estimated_chars = $estimatedChars
                estimated_tokens = $estimatedTokens
                llm_cost_usd    = @{
                    claude_haiku   = [math]::Round($estimatedTokens / 1000 * 0.00025, 6)
                    claude_sonnet  = [math]::Round($estimatedTokens / 1000 * 0.003,   6)
                    gpt4o          = [math]::Round($estimatedTokens / 1000 * 0.005,   6)
                }
            }
            $report.Add($entry)
            $script:Counters.OCR++

            Write-Host " OK  ($($sw.ElapsedMilliseconds)ms | ~$estimatedTokens tokens)" -ForegroundColor Green
        } catch {
            $sw.Stop()
            Write-Host " Erro: $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    if (-not $DryRun) {
        Write-Host ""
        Write-Host "    Extraindo texto para Markdown..." -ForegroundColor Magenta
        foreach ($pdf in $pdfs) {
            $sourcePdf = Join-Path $ocrDir $pdf.Name
            if (-not (Test-Path $sourcePdf)) { $sourcePdf = $pdf.FullName }
            $mdPath = Join-Path $ocrDir ($pdf.BaseName + ".md")
            try {
                $pyScript = @"
import sys
from pdfminer.high_level import extract_text
text = extract_text(sys.argv[1])
lines = text.splitlines()
cleaned = []
for line in lines:
    stripped = line.strip()
    if stripped:
        cleaned.append(stripped)
    elif cleaned and cleaned[-1] != '':
        cleaned.append('')
with open(sys.argv[2], 'w', encoding='utf-8') as f:
    f.write('\n'.join(cleaned))
"@
                $pyTmp = Join-Path $env:TEMP "vsn_pdf2md.py"
                [System.IO.File]::WriteAllText($pyTmp, $pyScript, [System.Text.UTF8Encoding]::new($false))
                & python $pyTmp $sourcePdf $mdPath 2>$null | Out-Null
                if (Test-Path $mdPath) {
                    $mdKB = [math]::Round((Get-Item $mdPath).Length / 1KB, 1)
                    Write-Host "    [->] $($pdf.BaseName).md  ($mdKB KB)" -ForegroundColor Green
                } else {
                    Write-Host "    [!] $($pdf.BaseName).md falhou" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "    [!] Erro em $($pdf.Name): $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }

    $jsonPath = Join-Path $Path "ocr-report.json"
    $jsonObj = @{
        timestamp       = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
        language        = $lang
        files           = $report
        totals          = @{
            files              = $report.Count
            total_tokens       = $grandTotalTokens
            total_processing_ms = $grandTotalMs
            llm_cost_usd       = @{
                claude_haiku  = [math]::Round($grandTotalTokens / 1000 * 0.00025, 6)
                claude_sonnet = [math]::Round($grandTotalTokens / 1000 * 0.003,   6)
                gpt4o         = [math]::Round($grandTotalTokens / 1000 * 0.005,   6)
            }
        }
    }

    if (-not $DryRun) {
        $jsonObj | ConvertTo-Json -Depth 6 | Out-File $jsonPath -Encoding utf8
    }

    Write-Host ""
    Write-Host "    ============ OCR REPORT ============" -ForegroundColor Cyan
    Write-Host "    Arquivos:       $($report.Count)" -ForegroundColor White
    Write-Host "    Tokens totais:  ~$grandTotalTokens" -ForegroundColor White
    Write-Host "    Custo estimado (input only):" -ForegroundColor DarkGray
    Write-Host ("    Claude Haiku:   `$" + [math]::Round($grandTotalTokens / 1000 * 0.00025, 6)) -ForegroundColor Green
    Write-Host ("    Claude Sonnet:  `$" + [math]::Round($grandTotalTokens / 1000 * 0.003,   5)) -ForegroundColor Yellow
    Write-Host ("    GPT-4o:         `$" + [math]::Round($grandTotalTokens / 1000 * 0.005,   5)) -ForegroundColor Red
    Write-Host "    ------------------------------------" -ForegroundColor Gray
    Write-Host "    JSON salvo: ocr-report.json" -ForegroundColor Cyan
    Write-Host "    PDFs em:    OCR_Output\" -ForegroundColor Cyan
    Write-Host "    MDs em:     OCR_Output\*.md" -ForegroundColor Cyan
    Write-Host "    ====================================" -ForegroundColor Cyan
    Read-Host "    [Enter para continuar]" | Out-Null
}

function Show-PDFMetadata {
    $qpdf = Get-QPDFPath
    if (-not $qpdf) { Write-Host "    [!] qpdf nao encontrado." -ForegroundColor Red; return }

    $pdfs = Get-ChildItem -Path $Path -Filter "*.pdf" -File
    if ($pdfs.Count -eq 0) { Write-Host "    [!] Nenhum PDF encontrado." -ForegroundColor Yellow; Read-Host "    [Enter para continuar]" | Out-Null; return }

    Show-Header
    Write-Host "    RELATORIO DE METADADOS" -ForegroundColor Magenta
    Write-Host ""

    $allMeta = [System.Collections.Generic.List[hashtable]]::new()

    $pdfinfo = Get-Command pdfinfo -ErrorAction SilentlyContinue

    foreach ($pdf in $pdfs) {
        Write-Host "    [->] $($pdf.Name)" -ForegroundColor White

        $meta = @{
            file        = $pdf.Name
            size_kb     = [math]::Round($pdf.Length / 1KB, 1)
            size_mb     = [math]::Round($pdf.Length / 1MB, 2)
            modified    = $pdf.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
            pages       = 0
            encrypted   = $false
            title       = ""
            author      = ""
            creator     = ""
            producer    = ""
            created     = ""
            images      = 0
            fonts       = 0
        }

        $jsonRaw = & $qpdf --json --json-output=2 $pdf.FullName 2>$null | Out-String
        $jsonVer = 2
        if (-not $jsonRaw -or $jsonRaw.Trim().Length -eq 0) {
            $jsonRaw = & $qpdf --json $pdf.FullName 2>$null | Out-String
            $jsonVer = 1
        }

        if ($jsonRaw) {
            try {
                $j = $jsonRaw | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($j) {
                    if ($jsonVer -eq 2 -and $j.qpdf) {
                        if ($j.qpdf.pages) { $meta.pages = @($j.qpdf.pages).Count }
                        if ($j.qpdf.encrypt) { $meta.encrypted = $true }
                        if ($j.qpdf.objects) {
                            foreach ($prop in $j.qpdf.objects.PSObject.Properties) {
                                $v = $prop.Value
                                if ($v.value -and $v.value.'/Type' -eq '/Font') { $meta.fonts++ }
                                if ($v.stream -and $v.stream.dict -and $v.stream.dict.'/Subtype' -eq '/Image') { $meta.images++ }
                            }
                        }
                    }
                    elseif ($j.qpdf -is [array] -and $j.qpdf.Count -gt 1) {
                        if ($j.qpdf[0].PSObject.Properties['encrypt']) { $meta.encrypted = $true }
                        $info = $j.qpdf[1]
                        if ($info) {
                            foreach ($prop in $info.PSObject.Properties) {
                                $v = $prop.Value
                                if ($v.value -and $v.value.'/Type' -eq '/Font') { $meta.fonts++ }
                                if ($v.stream -and $v.stream.filter -match 'DCT|JPEG|JPX') { $meta.images++ }
                            }
                        }
                    }
                }
            } catch {}
        }

        if ($meta.pages -eq 0) {
            $np = & $qpdf --show-npages $pdf.FullName 2>$null
            if ($np -match '^\d+$') { $meta.pages = [int]$np }
        }

        if ($pdfinfo) {
            $info = & pdfinfo $pdf.FullName 2>$null
            foreach ($line in $info) {
                if ($line -match '^Title:\s+(.+)')    { $meta.title    = $Matches[1].Trim() }
                if ($line -match '^Author:\s+(.+)')   { $meta.author   = $Matches[1].Trim() }
                if ($line -match '^Creator:\s+(.+)')  { $meta.creator  = $Matches[1].Trim() }
                if ($line -match '^Producer:\s+(.+)') { $meta.producer = $Matches[1].Trim() }
                if ($line -match '^CreationDate:\s+(.+)') { $meta.created = $Matches[1].Trim() }
                if ($line -match '^Encrypted:\s+yes') { $meta.encrypted = $true }
            }
        }

        Write-Host ("      Paginas:    {0}" -f $meta.pages)           -ForegroundColor Gray
        Write-Host ("      Tamanho:    {0} KB  ({1} MB)" -f $meta.size_kb, $meta.size_mb) -ForegroundColor Gray
        Write-Host ("      Criptogr:   {0}" -f $(if ($meta.encrypted) { "SIM" } else { "nao" })) -ForegroundColor $(if ($meta.encrypted) { "Yellow" } else { "DarkGray" })
        if ($meta.title)    { Write-Host ("      Titulo:     {0}" -f $meta.title)    -ForegroundColor DarkCyan }
        if ($meta.author)   { Write-Host ("      Autor:      {0}" -f $meta.author)   -ForegroundColor DarkCyan }
        if ($meta.creator)  { Write-Host ("      Criado em:  {0}" -f $meta.creator)  -ForegroundColor DarkGray }
        if ($meta.producer) { Write-Host ("      Producer:   {0}" -f $meta.producer) -ForegroundColor DarkGray }
        if ($meta.created)  { Write-Host ("      Data:       {0}" -f $meta.created)  -ForegroundColor DarkGray }
        if ($meta.fonts -gt 0)  { Write-Host ("      Fontes:     {0}" -f $meta.fonts)  -ForegroundColor DarkGray }
        Write-Host ""

        $allMeta.Add($meta)
    }

    $jsonPath = Join-Path $Path "metadata-report.json"
    if (-not $DryRun) {
        @{
            timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
            path      = $Path
            files     = $allMeta
        } | ConvertTo-Json -Depth 5 | Out-File $jsonPath -Encoding utf8
        Write-Host "    JSON salvo: metadata-report.json" -ForegroundColor Cyan
    }
    Read-Host "    [Enter para continuar]" | Out-Null
}

function Extract-PDFImages {
    Show-Header
    Write-Host "    EXTRAIR IMAGENS EMBUTIDAS DE PDFs" -ForegroundColor Magenta
    Write-Host "    Extrai cada imagem individual (fotos, logos, graficos) do PDF" -ForegroundColor DarkGray
    Write-Host ""

    $pdfs = Get-ChildItem -Path $Path -Filter "*.pdf" -File
    if ($pdfs.Count -eq 0) {
        Write-Host "    [!] Nenhum PDF encontrado na raiz." -ForegroundColor Yellow
        Read-Host "    [Enter para continuar]" | Out-Null; return
    }

    $hasFitz = $false
    try {
        $check = & python -c "import fitz; print('ok')" 2>$null
        if ($check -eq 'ok') { $hasFitz = $true }
    } catch {}

    if (-not $hasFitz) {
        Write-Host "    [!] PyMuPDF (fitz) nao encontrado." -ForegroundColor Yellow
        $resp = Read-Host "    Deseja instalar agora via pip? (S/n)"
        if ($resp -match '^[nN]') {
            Read-Host "    [Enter para continuar]" | Out-Null; return
        }
        Write-Host "    Instalando PyMuPDF..." -ForegroundColor Cyan
        & pip install PyMuPDF 2>&1 | Out-Host
        try {
            $check = & python -c "import fitz; print('ok')" 2>$null
            if ($check -eq 'ok') { $hasFitz = $true }
        } catch {}
        if (-not $hasFitz) {
            Write-Host "    [!] Falha ao instalar PyMuPDF." -ForegroundColor Red
            Read-Host "    [Enter para continuar]" | Out-Null; return
        }
    }

    Write-Host "    Engine: PyMuPDF (fitz) — extracao nativa de XObjects" -ForegroundColor Green
    Write-Host "    PDFs: $($pdfs.Count)" -ForegroundColor DarkGray
    Write-Host ""

    $imgDir = Join-Path $Path "PDF_Images"
    if (-not $DryRun -and -not (Test-Path $imgDir)) { New-Item $imgDir -ItemType Directory -Force | Out-Null }

    $totalExtracted = 0

    foreach ($pdf in $pdfs) {
        $pdfImgDir = Join-Path $imgDir $pdf.BaseName
        if (-not $DryRun -and -not (Test-Path $pdfImgDir)) { New-Item $pdfImgDir -ItemType Directory -Force | Out-Null }

        Write-Host "    [->] $($pdf.Name)" -ForegroundColor White

        if ($DryRun) {
            Write-Host "        [DRY-RUN] Extrairia imagens para PDF_Images\$($pdf.BaseName)\" -ForegroundColor DarkYellow
            continue
        }

        $pyScript = @"
import fitz, sys, os, glob
pdf_pattern = sys.argv[1]
out_dir = sys.argv[2]
matches = glob.glob(pdf_pattern)
if not matches:
    print('ERRO: PDF nao encontrado via glob: ' + pdf_pattern)
    print('TOTAL:0')
    sys.exit(0)
pdf_path = matches[0]
min_size = 5000
min_dim = 50
doc = fitz.open(pdf_path)
count = 0
seen = set()
for page_num in range(len(doc)):
    page = doc[page_num]
    images = page.get_images(full=True)
    for img_index, img in enumerate(images):
        xref = img[0]
        if xref in seen:
            continue
        seen.add(xref)
        base_image = doc.extract_image(xref)
        if not base_image:
            continue
        image_bytes = base_image['image']
        if len(image_bytes) < min_size:
            continue
        w = base_image.get('width', 0)
        h = base_image.get('height', 0)
        if w < min_dim or h < min_dim:
            continue
        ext = base_image['ext']
        name = 'page%02d_img%02d_%dx%d.%s' % (page_num+1, img_index+1, w, h, ext)
        out_path = os.path.join(out_dir, name)
        with open(out_path, 'wb') as f:
            f.write(image_bytes)
        count += 1
        print('  %s (%d KB)' % (name, len(image_bytes)//1024))
print('TOTAL:%d' % count)
"@
        $pyTmp = Join-Path $env:TEMP "vsn_pdfimg.py"
        [System.IO.File]::WriteAllText($pyTmp, $pyScript, [System.Text.UTF8Encoding]::new($false))

        try {
            $globName = ($pdf.Name -creplace '[^\x00-\x7F]', '?')
            $globPattern = Join-Path $pdf.DirectoryName $globName
            $output = & python $pyTmp $globPattern $pdfImgDir 2>&1
            $output | ForEach-Object {
                $line = $_.ToString()
                if ($line -match '^TOTAL:(\d+)$') {
                    $extracted = [int]$Matches[1]
                    $totalExtracted += $extracted
                    $script:Counters.PDFImg += $extracted
                } elseif ($line.Trim()) {
                    Write-Host "       $line" -ForegroundColor DarkGray
                }
            }
        } catch {
            Write-Host "        Erro: $($_.Exception.Message)" -ForegroundColor Red
        }

        $fileCount = (Get-ChildItem -Path $pdfImgDir -File -ErrorAction SilentlyContinue).Count
        if ($fileCount -gt 0) {
            $totalSize = (Get-ChildItem -Path $pdfImgDir -File | Measure-Object -Property Length -Sum).Sum
            $sizeMB = [math]::Round($totalSize / 1MB, 2)
            Write-Host "        $fileCount imagens ($sizeMB MB)" -ForegroundColor Green
        } else {
            Write-Host "        nenhuma imagem encontrada" -ForegroundColor Yellow
            Remove-Item $pdfImgDir -Force -Recurse -ErrorAction SilentlyContinue
        }
    }

    Write-Host ""
    Write-Host "    ============ EXTRACAO ============" -ForegroundColor Cyan
    Write-Host "    Total: $totalExtracted imagens extraidas" -ForegroundColor White
    Write-Host "    Pasta: PDF_Images\" -ForegroundColor White
    Write-Host "    =================================" -ForegroundColor Cyan
    if (-not $DryRun -and $totalExtracted -gt 0) { Start-Process explorer.exe $imgDir }
    Read-Host "    [Enter para continuar]" | Out-Null
}
