function Export-Inde {
    Write-Host "Gerando Índice de Entrega (INDEX)..." -ForegroundColor Cyan
    $outputFile = Join-Path $Path "INDEX.md"

    $date = Get-Date -Format "dd/MM/yyyy HH:mm"
    $folderName = (Get-Item $Path).Name

    $report = @"
# 📦 INDEX - $folderName
**Data:** $date
**Gerado por:** Visant CC®

---

## 📂 Resumo da Estrutura
"@

    $stats = Get-ChildItem -Path $Path -Directory | ForEach-Object {
        $dirFiles = Get-ChildItem $_.FullName -File -Recurse -ErrorAction SilentlyContinue
        $count = $dirFiles.Count
        if ($count -gt 0) {
            $exts = ($dirFiles | Select-Object -ExpandProperty Extension -Unique | Sort-Object) -join ', '
            "### $($_.Name)`n- **Arquivos:** $count`n- **Formatos:** $exts`n"
        }
    }

    $report += "`n" + ($stats -join "`n")
    $report += "`n`n---`n*Visant Labs // Creative Technology Brazil*"

    if (-not $DryRun) {
        $report | Out-File $outputFile -Encoding utf8
        Write-Host "    [OK] Índice criado: INDEX.md" -ForegroundColor Green
    } else {
        Write-Host "    [DRY-RUN] Criaria INDEX.md" -ForegroundColor DarkYellow
    }
}

function Export-Package {
    $date = Get-Date -Format "yyyy-MM-dd"
    $zipName = "Entrega_$date.zip"
    $zipPath = Join-Path (Split-Path $Path -Parent) $zipName

    Write-Host "Empacotando entrega em $zipName..." -ForegroundColor Magenta

    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

    if (-not $DryRun) {
        Compress-Archive -Path "$Path\*" -DestinationPath $zipPath -CompressionLevel Optimal
        Write-Host "    [OK] ZIP Gerado: $zipPath" -ForegroundColor Green
    } else {
        Write-Host "    [DRY-RUN] Criaria ZIP em $zipPath" -ForegroundColor DarkYellow
    }
}

function Show-Resumo {
    $total = ($script:Counters.Values | Measure-Object -Sum).Sum
    Write-Host ""
    Write-Host "    ============ RESUMO ============" -ForegroundColor Cyan
    if ($script:Counters.Avatar -gt 0)       { Write-Host "    Avatares/Icons:   $($script:Counters.Avatar)" -ForegroundColor White }
    if ($script:Counters.Transparente -gt 0) { Write-Host "    Transparentes:    $($script:Counters.Transparente)" -ForegroundColor White }
    if ($script:Counters.Vetor -gt 0)        { Write-Host "    Vetores:          $($script:Counters.Vetor)" -ForegroundColor White }
    if ($script:Counters.Extensao -gt 0)     { Write-Host "    Por extensao:     $($script:Counters.Extensao)" -ForegroundColor White }
    if ($script:Counters.Separado -gt 0)     { Write-Host "    PDFs decompostos: $($script:Counters.Separado)" -ForegroundColor White }
    if ($script:Counters.PNG -gt 0)          { Write-Host "    PNGs:             $($script:Counters.PNG)" -ForegroundColor White }
    if ($script:Counters.JPG -gt 0)          { Write-Host "    JPGs:             $($script:Counters.JPG)" -ForegroundColor White }
    if ($script:Counters.Webp -gt 0)         { Write-Host "    WebPs:            $($script:Counters.Webp)" -ForegroundColor White }
    if ($script:Counters.OCR -gt 0)          { Write-Host "    OCRs:             $($script:Counters.OCR)" -ForegroundColor White }
    if ($script:Counters.PDFImg -gt 0)       { Write-Host "    PDF Imagens:      $($script:Counters.PDFImg)" -ForegroundColor White }
    Write-Host "    --------------------------------" -ForegroundColor Gray
    Write-Host "    Total operacoes:  $total" -ForegroundColor Cyan
    if ($DryRun) { Write-Host "    (modo simulacao - nada foi alterado)" -ForegroundColor DarkYellow }
    Write-Host "    ================================" -ForegroundColor Cyan
}
