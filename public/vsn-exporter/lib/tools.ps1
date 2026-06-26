function Find-Tool {
    param(
        [Parameter(Mandatory)][string]$CacheKey,
        [string[]]$Names = @(),
        [string[]]$GlobPaths = @()
    )
    if ($script:ToolCache.ContainsKey($CacheKey)) { return $script:ToolCache[$CacheKey] }

    $resolved = $null
    if ($Names.Count -gt 0) {
        $cmd = Get-Command $Names -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($cmd) { $resolved = $cmd.Source }
    }
    if (-not $resolved) {
        foreach ($p in $GlobPaths) {
            $found = Get-ChildItem -Path $p -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) { $resolved = $found.FullName; break }
        }
    }

    $script:ToolCache[$CacheKey] = $resolved
    return $resolved
}

function Get-GSPath {
    Find-Tool -CacheKey 'gs' -Names @('gswin64c', 'gswin32c', 'gs') -GlobPaths @(
        "C:\Program Files\gs\gs*\bin\gswin64c.exe",
        "C:\Program Files (x86)\gs\gs*\bin\gswin32c.exe",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\ArtifexSoftware.Ghostscript*\**\gswin64c.exe"
    )
}

function Get-QPDFPath {
    Find-Tool -CacheKey 'qpdf' -Names @('qpdf') -GlobPaths @(
        "C:\Program Files\qpdf*\bin\qpdf.exe",
        "C:\Program Files (x86)\qpdf*\bin\qpdf.exe",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\qpdf.qpdf*\**\qpdf.exe"
    )
}

function Get-InkscapePath {
    Find-Tool -CacheKey 'inkscape' -Names @('inkscape') -GlobPaths @(
        "C:\Program Files\Inkscape\bin\inkscape.exe",
        "C:\Program Files\Inkscape\inkscape.exe",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Inkscape.Inkscape*\**\inkscape.exe"
    )
}

function Get-MagickPath {
    Find-Tool -CacheKey 'magick' -Names @('magick') -GlobPaths @(
        "C:\Program Files\ImageMagick*\magick.exe",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\ImageMagick*\**\magick.exe"
    )
}

function Get-SvgoPath {
    Find-Tool -CacheKey 'svgo' -Names @('svgo')
}

function Get-PdfImagesPath {
    Find-Tool -CacheKey 'pdfimages' -Names @('pdfimages') -GlobPaths @(
        "C:\Program Files\poppler*\Library\bin\pdfimages.exe",
        "C:\Program Files\poppler*\bin\pdfimages.exe",
        "C:\Program Files (x86)\poppler*\bin\pdfimages.exe",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\oschwartz10612.Poppler*\**\pdfimages.exe",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\*oppler*\**\pdfimages.exe"
    )
}
