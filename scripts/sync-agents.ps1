
# Sync Agents Script
# This script synchronizes the global .agents folder with the project's .agent folder.

$Source = "C:\Users\Usuario\.agents"
$Destination = "z:\Cursor\visantlabs-os\.agent"

if (!(Test-Path $Source)) {
    Write-Error "Source path $Source does not exist."
    exit 1
}

if (!(Test-Path $Destination)) {
    Write-Host "Destination path $Destination does not exist. Creating..."
    New-Item -ItemType Directory -Force -Path $Destination
}

Write-Host "Syncing from $Source to $Destination..."

# Using robocopy for synchronization
# /E     : Copy subdirectories, including empty ones.
# /Z     : Copy files in restartable mode.
# /ZB    : Use restartable mode; if access denied, use backup mode.
# /R:5   : Number of retries on failed copies: 5.
# /W:5   : Wait time between retries: 5 seconds.
# /TBD   : Wait for share names To Be Defined (retry error 67).
# /NP    : No Progress - don't display percentage copied.
# /V     : Produce verbose output, showing skipped files.
# /MT:32 : Multi-threaded copying with 32 threads.
# /XF    : Exclude Files (MEMORY.md excluded to preserve project memory).

robocopy $Source $Destination /E /Z /ZB /R:5 /W:5 /TBD /NP /V /MT:32 /XF MEMORY.md

Write-Host "Sync complete (MEMORY.md excluded)."

