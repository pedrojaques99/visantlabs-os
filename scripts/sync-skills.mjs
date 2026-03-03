import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const SKILLS_DIR = path.join(ROOT, 'skills');

const AGENTS = [
    '.adal',
    '.agent',
    '.agents',
    '.augment',
    '.claude',
    '.cursor',
    '.gemini',
    '.github',
    '.qwen'
];

function isJunctionOrSymlink(fullPath) {
    try {
        const stat = fs.lstatSync(fullPath);
        return stat.isSymbolicLink() || (stat.isDirectory() && fs.readlinkSync(fullPath) !== null);
    } catch (e) {
        try {
            const stat = fs.lstatSync(fullPath);
            return stat.isSymbolicLink();
        } catch (e2) {
            return false;
        }
    }
}

function run() {
    if (!fs.existsSync(SKILLS_DIR)) {
        fs.mkdirSync(SKILLS_DIR, { recursive: true });
    }

    // Phase 1: Clean out all symlinks/junctions
    console.log('Cleaning existing symlinks/junctions...');
    const allDirsToSearch = [SKILLS_DIR, ...AGENTS.map(a => path.join(ROOT, a, 'skills'))];

    for (const dir of allDirsToSearch) {
        if (!fs.existsSync(dir)) continue;

        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (isJunctionOrSymlink(fullPath)) {
                try {
                    fs.unlinkSync(fullPath);
                } catch (e) {
                    try { fs.rmdirSync(fullPath); } catch (e2) { }
                }
            }
        }
    }

    // Phase 2: Collect ALL valid skills (real directories or real files) from everywhere into SKILLS_DIR
    console.log('Consolidating real files and directories to central skills...');
    for (const dir of allDirsToSearch) {
        if (!fs.existsSync(dir)) continue;
        if (dir === SKILLS_DIR) continue; // we already did SKILLS_DIR items manually below if needed

        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(dir, item.name);

            const targetSkillPath = path.join(SKILLS_DIR, item.name);
            if (fullPath === targetSkillPath) continue;

            if (!fs.existsSync(targetSkillPath)) {
                try {
                    fs.renameSync(fullPath, targetSkillPath);
                } catch (e) { }
            } else {
                try {
                    if (fs.lstatSync(fullPath).isDirectory()) {
                        fs.rmSync(fullPath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(fullPath);
                    }
                } catch (e) { }
            }
        }
    }

    // Phase 3: Ensure all skills in SKILLS_DIR are directories with SKILL.md
    console.log('Ensuring all skills have a directory with SKILL.md...');
    const centralItems = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
    for (const centralItem of centralItems) {
        const fullPath = path.join(SKILLS_DIR, centralItem.name);

        if (centralItem.name.startsWith('.')) continue;

        const stat = fs.lstatSync(fullPath);

        if (stat.isFile()) {
            let folderName = centralItem.name;
            if (folderName.toLowerCase().endsWith('.md')) folderName = folderName.slice(0, -3);

            const content = fs.readFileSync(fullPath, 'utf8');
            fs.unlinkSync(fullPath); // Delete the file before creating dir!

            const targetFolder = path.join(SKILLS_DIR, folderName);
            if (!fs.existsSync(targetFolder)) {
                fs.mkdirSync(targetFolder);
            }

            fs.writeFileSync(path.join(targetFolder, 'SKILL.md'), content);
        } else if (stat.isDirectory()) {
            const skillMdPath = path.join(fullPath, 'SKILL.md');
            if (!fs.existsSync(skillMdPath)) {
                if (fs.existsSync(path.join(fullPath, 'README.md'))) {
                    fs.renameSync(path.join(fullPath, 'README.md'), skillMdPath);
                } else {
                    fs.writeFileSync(skillMdPath, `---\ndescription: Auto-migrated skill ${centralItem.name}\n---\n`);
                }
            }
        }
    }

    // Phase 4: Create junctions/symlinks in all agent folders
    console.log('Recreating junctions in all agent folders...');
    const finalizedSkills = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
        .filter(i => fs.lstatSync(path.join(SKILLS_DIR, i.name)).isDirectory() && !i.name.startsWith('.'))
        .map(i => i.name);

    for (const agent of AGENTS) {
        const agentSkillsDir = path.join(ROOT, agent, 'skills');

        if (!fs.existsSync(path.join(ROOT, agent))) fs.mkdirSync(path.join(ROOT, agent), { recursive: true });
        if (!fs.existsSync(agentSkillsDir)) fs.mkdirSync(agentSkillsDir, { recursive: true });

        for (const skill of finalizedSkills) {
            const target = path.join(SKILLS_DIR, skill);
            const link = path.join(agentSkillsDir, skill);

            if (!fs.existsSync(link)) {
                try { fs.symlinkSync(target, link, 'junction'); } catch (e) { }
            }
        }
    }

    console.log('Done organizing skills!');
}

run();
