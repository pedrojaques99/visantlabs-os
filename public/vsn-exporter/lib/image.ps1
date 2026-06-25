function Convert-PNGParaJPG {
    param($InputPath = $Path)
    Write-Host "Convertendo PNGs para JPG (Qualidade $JPGQuality)..." -ForegroundColor Yellow

    $pngs = Get-ChildItem -Path $InputPath -Filter "*.png" -File
    if ($pngs.Count -eq 0) {
        Write-Host "    [i] Nenhum PNG na raiz. Buscando recursivamente..." -ForegroundColor DarkGray
        $pngs = Get-ChildItem -Path $InputPath -Filter "*.png" -File -Recurse
    }

    if ($pngs.Count -eq 0) {
        Write-Host "    [!] Nenhum PNG encontrado." -ForegroundColor DarkYellow
        return
    }

    $totalPngSize = ($pngs | Measure-Object -Property Length -Sum).Sum
    $estFactor = ($JPGQuality / 100) * ($JPGQuality / 100) * 0.5 + 0.05
    $estimatedJpgSize = $totalPngSize * $estFactor

    Write-Host "    [i] Tamanho Original: $([math]::Round($totalPngSize / 1MB, 2)) MB" -ForegroundColor DarkGray
    Write-Host "    [i] Estimativa Final: $([math]::Round($estimatedJpgSize / 1MB, 2)) MB ($([math]::Round($estFactor * 100, 1))%)" -ForegroundColor DarkGray
    Write-Host ""

    Add-Type -AssemblyName System.Drawing
    $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.FormatDescription -eq "JPEG" }
    $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int]$JPGQuality)

    $jpgDir = Join-Path $InputPath "JPG_Export"
    if (-not $DryRun -and -not (Test-Path $jpgDir)) { New-Item $jpgDir -ItemType Directory -Force | Out-Null }

    foreach ($png in $pngs) {
        $outPath = Join-Path $jpgDir ($png.BaseName + ".jpg")
        Write-Host "    [->] $($png.Name)... " -NoNewline -ForegroundColor White

        if ($DryRun) {
            Write-Host "Simulado" -ForegroundColor DarkYellow
            continue
        }

        $img = $null; $newImg = $null; $graphics = $null
        try {
            $img = [System.Drawing.Image]::FromFile($png.FullName)
            $newImg = New-Object System.Drawing.Bitmap($img.Width, $img.Height)
            $graphics = [System.Drawing.Graphics]::FromImage($newImg)
            $graphics.Clear([System.Drawing.Color]::White)
            $graphics.DrawImage($img, 0, 0, $img.Width, $img.Height)
            $newImg.Save($outPath, $jpegCodec, $encoderParams)

            $finalSize = (Get-Item $outPath).Length
            Write-Host "OK ($([math]::Round($finalSize / 1KB, 0)) KB)" -ForegroundColor Green
            $script:Counters.JPG++
        } catch {
            Write-Host "Erro: $($_.Exception.Message)" -ForegroundColor Red
        } finally {
            if ($graphics) { $graphics.Dispose() }
            if ($newImg)   { $newImg.Dispose() }
            if ($img)      { $img.Dispose() }
        }
    }
}

function Convert-ToWebP {
    param($InputPath = $Path, [int]$Quality = 80)
    Write-Host "Convertendo para WebP (Qualidade $Quality)..." -ForegroundColor Yellow

    $files = Get-ChildItem -Path $InputPath -Include "*.png", "*.jpg", "*.jpeg" -File -Recurse |
        Where-Object { $_.FullName -notmatch [regex]::Escape("WebP_Export") }
    if ($files.Count -eq 0) {
        Write-Host "    [!] Nenhum PNG ou JPG encontrado." -ForegroundColor DarkYellow
        return
    }

    $magick = Get-MagickPath
    $cwebp  = if (-not $magick) { (Get-Command cwebp -ErrorAction SilentlyContinue).Source } else { $null }
    $ffmpeg = if (-not $magick -and -not $cwebp) { (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source } else { $null }

    if (-not $magick -and -not $cwebp -and -not $ffmpeg) {
        Write-Host "    [!] WebP requer 'magick' (ImageMagick) ou 'cwebp' instalado." -ForegroundColor Red
        Write-Host "    Instale com: winget install ImageMagick.ImageMagick" -ForegroundColor Gray
        return
    }

    $webpDir = Join-Path $InputPath "WebP_Export"
    if (-not $DryRun -and -not (Test-Path $webpDir)) { New-Item $webpDir -ItemType Directory -Force | Out-Null }

    foreach ($file in $files) {
        $outPath = Join-Path $webpDir ($file.BaseName + ".webp")
        Write-Host "    [->] $($file.Name)... " -NoNewline -ForegroundColor White

        if ($DryRun) { Write-Host "Simulado" -ForegroundColor DarkYellow; continue }

        try {
            if ($magick)      { & $magick $file.FullName -quality $Quality $outPath }
            elseif ($cwebp)   { & $cwebp -q $Quality $file.FullName -o $outPath }
            else              { & $ffmpeg -i $file.FullName -q:v $Quality -update true $outPath -y -loglevel quiet }
            Write-Host "OK" -ForegroundColor Green
            $script:Counters.Webp++
        } catch {
            Write-Host "Erro" -ForegroundColor Red
        }
    }
}

function Optimize-ImagesMetadata {
    Write-Host "Limpando Metadados (Stripping EXIF/Privacy)..." -ForegroundColor Cyan
    $files = Get-ChildItem -Path $Path -Include "*.jpg", "*.jpeg", "*.png" -File -Recurse

    Add-Type -AssemblyName System.Drawing
    foreach ($file in $files) {
        Write-Host "    [Clean] $($file.Name)... " -NoNewline -ForegroundColor DarkGray
        if ($DryRun) { Write-Host "Simulado" -ForegroundColor DarkYellow; continue }

        $img = $null; $bmp = $null
        $tempOut = $file.FullName + ".tmp"
        try {
            $img = [System.Drawing.Image]::FromFile($file.FullName)
            $fmt = $img.RawFormat
            $bmp = New-Object System.Drawing.Bitmap($img)
            $bmp.Save($tempOut, $fmt)
        } catch {
            Write-Host "Erro" -ForegroundColor Red
            if (Test-Path $tempOut) { Remove-Item $tempOut -Force -ErrorAction SilentlyContinue }
            continue
        } finally {
            if ($bmp) { $bmp.Dispose() }
            if ($img) { $img.Dispose() }
        }

        try {
            Move-Item -LiteralPath $tempOut -Destination $file.FullName -Force
            Write-Host "OK" -ForegroundColor Green
        } catch {
            Write-Host "Erro ao salvar" -ForegroundColor Red
            if (Test-Path $tempOut) { Remove-Item $tempOut -Force -ErrorAction SilentlyContinue }
        }
    }
}

function Convert-ToICO {
    param(
        [string]$Source = "Z:\VISANT\Logo\PNG\visant_icon_bk.png",
        [string]$Output = "Z:\VISANT\Logo\visant.ico"
    )
    $sourcePng = $Source
    $icoOut    = $Output

    Write-Host "Gerando ICO a partir de: $sourcePng" -ForegroundColor Cyan

    if (-not (Test-Path $sourcePng)) {
        Write-Host "    [!] PNG nao encontrado: $sourcePng" -ForegroundColor Red
        Write-Host "    Use Convert-ToICO -Source <png> -Output <ico> para customizar." -ForegroundColor DarkGray
        return
    }

    try {
        Add-Type -AssemblyName System.Drawing

        $sizes = @(256, 64, 48, 32, 16)
        $bitmaps = foreach ($s in $sizes) {
            $bmp = New-Object System.Drawing.Bitmap($s, $s)
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $src = [System.Drawing.Image]::FromFile($sourcePng)
            $g.DrawImage($src, 0, 0, $s, $s)
            $src.Dispose(); $g.Dispose()
            $bmp
        }

        $ms = New-Object System.IO.MemoryStream
        $writer = New-Object System.IO.BinaryWriter($ms)

        $writer.Write([uint16]0)
        $writer.Write([uint16]1)
        $writer.Write([uint16]$bitmaps.Count)

        $pngStreams = foreach ($bmp in $bitmaps) {
            $ps = New-Object System.IO.MemoryStream
            $bmp.Save($ps, [System.Drawing.Imaging.ImageFormat]::Png)
            $ps
        }

        $offset = 6 + $bitmaps.Count * 16
        for ($i = 0; $i -lt $bitmaps.Count; $i++) {
            $s = $sizes[$i]
            $sz = if ($s -eq 256) { 0 } else { $s }
            $writer.Write([byte]$sz)
            $writer.Write([byte]$sz)
            $writer.Write([byte]0)
            $writer.Write([byte]0)
            $writer.Write([uint16]1)
            $writer.Write([uint16]32)
            $writer.Write([uint32]$pngStreams[$i].Length)
            $writer.Write([uint32]$offset)
            $offset += $pngStreams[$i].Length
        }

        foreach ($ps in $pngStreams) {
            $writer.Write($ps.ToArray())
            $ps.Dispose()
        }
        foreach ($bmp in $bitmaps) { $bmp.Dispose() }

        [System.IO.File]::WriteAllBytes($icoOut, $ms.ToArray())
        $ms.Dispose()

        Write-Host "    [OK] ICO gerado: $icoOut" -ForegroundColor Green
    } catch {
        Write-Host "    [!] Erro ao gerar ICO: $($_.Exception.Message)" -ForegroundColor Red
        return
    }

    Write-Host "    ICO salvo em: $icoOut" -ForegroundColor DarkGray
}
