function Group-Avatar {
    Write-Host "Consolidando Avatares, Icons e Squares..." -ForegroundColor Cyan
    $rootAvatar = Join-Path $Path "Avatar"
    if (-not $DryRun -and -not (Test-Path $rootAvatar)) { New-Item $rootAvatar -ItemType Directory -Force | Out-Null }
    $rootAvatarFull = (Resolve-Path $rootAvatar -ErrorAction SilentlyContinue).Path
    if (-not $rootAvatarFull) { $rootAvatarFull = [System.IO.Path]::GetFullPath($rootAvatar) }

    $allFiles = Get-ChildItem -Path $Path -File -Recurse -ErrorAction SilentlyContinue
    $renameRe = '(?i)-1(?=\.[^.]+$)'
    $matchRe  = '(?i)\b(?:avatar|icon|ícone|square)\b'

    foreach ($f in $allFiles) {
        if ($f.Name -match $renameRe) {
            $newName = [regex]::Replace($f.Name, $renameRe, '-Avatar')
            Write-LogAction "RENAME" $f.FullName $newName
            if (-not $DryRun) { Rename-Item $f.FullName -NewName $newName -ErrorAction SilentlyContinue }
        }
    }

    foreach ($f in (Get-ChildItem -Path $Path -File -Recurse -ErrorAction SilentlyContinue)) {
        if ($f.Name -notmatch $matchRe) { continue }
        if ($f.FullName.StartsWith($rootAvatarFull, [System.StringComparison]::OrdinalIgnoreCase)) { continue }
        $ext = $f.Extension.Trim('.').ToUpper()
        $destDir = Join-Path $rootAvatar $ext
        if (-not $DryRun -and -not (Test-Path $destDir)) { New-Item $destDir -ItemType Directory -Force | Out-Null }
        Write-LogAction "MOVE" $f.FullName $destDir
        if (-not $DryRun) { Move-Item $f.FullName -Destination $destDir -Force -ErrorAction SilentlyContinue }
        $script:Counters.Avatar++
    }

    if (-not $DryRun) {
        Get-ChildItem -Path $Path -Directory -Recurse -Filter "Avatar" -ErrorAction SilentlyContinue | ForEach-Object {
            if ($_.FullName -ne $rootAvatarFull -and (Get-ChildItem $_.FullName -ErrorAction SilentlyContinue).Count -eq 0) {
                Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

function Export-Transparentes {
    Write-Host "Extraindo Transparentes..." -ForegroundColor Green
    $rootTrans = Join-Path $Path "Transparentes"
    if (-not $DryRun -and -not (Test-Path $rootTrans)) { New-Item $rootTrans -ItemType Directory -Force | Out-Null }
    $rootTransFull = (Resolve-Path $rootTrans -ErrorAction SilentlyContinue).Path
    if (-not $rootTransFull) { $rootTransFull = [System.IO.Path]::GetFullPath($rootTrans) }

    Get-ChildItem -Path $Path -File -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '(?i)\b(?:transparent|transparente)\b' } |
        ForEach-Object {
            if ($_.FullName.StartsWith($rootTransFull, [System.StringComparison]::OrdinalIgnoreCase)) { return }
            $ext = $_.Extension.Trim('.').ToUpper()
            $dest = Join-Path $rootTrans $ext
            if (-not $DryRun -and -not (Test-Path $dest)) { New-Item $dest -ItemType Directory -Force | Out-Null }
            Write-LogAction "MOVE" $_.FullName $dest
            if (-not $DryRun) { Move-Item $_.FullName -Destination $dest -Force -ErrorAction SilentlyContinue }
            $script:Counters.Transparente++
        }
}

function Group-Vetor {
    param([switch]$Recurse)
    $modeLabel = if ($Recurse) { " (recursivo)" } else { "" }
    Write-Host "Agrupando Vetores (PDF, AI, SVG, EPS)$modeLabel..." -ForegroundColor Yellow
    $ignoreNames = '(?i)\b(?:avatar|icon|ícone|square|transparent|transparente)\b'
    $excludeDirRe = '\\(?:' + ($script:OrganizedDirs -join '|') + ')(\\|$)'
    $rootVetor = Join-Path $Path "Vetor"

    $candidates = if ($Recurse) {
        Get-ChildItem -Path $Path -File -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch $excludeDirRe }
    } else {
        Get-ChildItem -Path $Path -File -ErrorAction SilentlyContinue
    }

    $candidates | Where-Object {
        $_.Extension -ne ".png" -and $_.Name -notmatch $ignoreNames
    } | ForEach-Object {
        $ext = $_.Extension.Trim('.').ToUpper()
        if (-not $ext) { return }
        $dest = Join-Path $rootVetor $ext
        if (-not $DryRun -and -not (Test-Path $dest)) { New-Item $dest -ItemType Directory -Force | Out-Null }
        Write-LogAction "MOVE" $_.FullName $dest
        if (-not $DryRun) { Move-Item $_.FullName -Destination $dest -Force -ErrorAction SilentlyContinue }
        $script:Counters.Vetor++
    }
}

function Group-PorExtensao {
    param([switch]$Recurse)
    $modeLabel = if ($Recurse) { " (recursivo)" } else { "" }
    Write-Host "Separando por tipo (Exceto PNG)$modeLabel..." -ForegroundColor Blue

    $folders = @($Path)
    if ($Recurse) {
        $folders += Get-ChildItem -Path $Path -Directory -Recurse |
            Where-Object { $_.Name -notmatch '^[A-Z0-9]{2,5}$' } |
            Select-Object -ExpandProperty FullName
    }

    foreach ($folder in $folders) {
        Get-ChildItem -Path $folder -File | Where-Object { $_.Extension -ne ".png" } | ForEach-Object {
            $ext = $_.Extension.Trim('.').ToUpper()
            if ($ext) {
                $dest = Join-Path $folder $ext
                if (-not $DryRun -and -not (Test-Path $dest)) { New-Item $dest -ItemType Directory -Force | Out-Null }
                Write-LogAction "MOVE" $_.FullName $dest
                if (-not $DryRun) { Move-Item $_.FullName -Destination $dest -Force -ErrorAction SilentlyContinue }
                $script:Counters.Extensao++
            }
        }
    }
}

function Export-PNGsParaRaiz {
    Write-Host "Extraindo PNGs para a raiz e limpando pastas..." -ForegroundColor Cyan

    $rootFull = (Resolve-Path $Path).Path
    $excludeRe = '\\(?:' + (($script:OrganizedDirs + @('Figma_Import_')) -join '|') + ')'

    Get-ChildItem -Path $Path -Filter "*.png" -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.DirectoryName -eq $rootFull) { return }
        if ($_.FullName -match $excludeRe)  { return }
        Write-LogAction "MOVE" $_.FullName $Path
        if (-not $DryRun) { Move-Item $_.FullName -Destination $Path -Force -ErrorAction SilentlyContinue }
        $script:Counters.PNG++
    }

    if (-not $DryRun) {
        Get-ChildItem -Path $Path -Directory -Recurse -Filter "PNG" -ErrorAction SilentlyContinue | ForEach-Object {
            if ((Get-ChildItem $_.FullName -File -ErrorAction SilentlyContinue).Count -eq 0) {
                Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
    }
}
