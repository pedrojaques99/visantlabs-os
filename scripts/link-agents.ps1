
# Link Agents Script (v2)
# This script centralizes all agent-specific folders to point to the .agent "mother" folder.

$ProjectRoot = "z:\Cursor\visantlabs-os"
$MotherFolder = Join-Path $ProjectRoot ".agent"
$AgentFolders = @(".qwen", ".gemini", ".cursor", ".claude", ".augment", ".adal", ".github")
$SubFoldersToLink = @("skills", "workflows", "memory")

$MasterRuleFiles = @(
    ".cursorrules",
    ".clauderules",
    ".windsurfrules",
    ".agent_rules"
)

$AgentPromptFiles = @(
    ".gemini/prompt.md",
    ".qwen/rules.md",
    ".claude/instructions.md",
    ".cursor/instructions.md"
)

if (!(Test-Path $MotherFolder)) {
    Write-Error "Mother folder $MotherFolder does not exist."
    exit 1
}

# 1. Create subfolder links
foreach ($AgentFolder in $AgentFolders) {
    $AgentPath = Join-Path $ProjectRoot $AgentFolder
    if (!(Test-Path $AgentPath)) {
        New-Item -ItemType Directory -Path $AgentPath -Force
    }

    foreach ($SubFolder in $SubFoldersToLink) {
        $Source = Join-Path $MotherFolder $SubFolder
        $Target = Join-Path $AgentPath $SubFolder
        if (Test-Path $Source) {
            if (Test-Path $Target) {
                $Item = Get-Item $Target
                if ($Item.Attributes -match "ReparsePoint") { continue }
                Rename-Item -Path $Target -NewName "$SubFolder.bak" -Force -ErrorAction SilentlyContinue
            }
            New-Item -ItemType Junction -Path $Target -Target $Source -Force
        }
    }
}

# 2. Master Instructions
$RulesContent = @"
# MASTER AGENT SYSTEM INSTRUCTIONS
@.agent is your manual. Read it first.

## CORE DIRECTIVES
1. ALL memory is stored in `.agent/memory/`. 
   - ALWAYS read `.agent/memory/MEMORY.md` to understand project state.
2. ALL custom capabilities are in `.agent/skills/`.
3. ALL automation patterns are in `.agent/workflows/`.
4. ALL user preferences are in `.agent/adm/`, `.agent/designer/`, etc.

## REDIRECTION
Regardless of which folder you were initialized from (.cursor, .claude, etc.), you MUST consider `.agent/` as the MOTHERBOARD and source of truth.
"@

# Write to root rule files
foreach ($File in $MasterRuleFiles) {
    Set-Content -Path (Join-Path $ProjectRoot $File) -Value $RulesContent
}

# Write to agent-specific prompt files
foreach ($File in $AgentPromptFiles) {
    $FilePath = Join-Path $ProjectRoot $File
    $DirPath = Split-Path $FilePath
    if (!(Test-Path $DirPath)) { New-Item -ItemType Directory -Path $DirPath -Force }
    Set-Content -Path $FilePath -Value $RulesContent
}

Write-Host "Centralized all agent configurations to .agent/"
