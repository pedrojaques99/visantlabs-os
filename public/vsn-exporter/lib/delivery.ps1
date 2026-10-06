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
