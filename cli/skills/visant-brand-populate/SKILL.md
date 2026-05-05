---
name: visant-brand-populate
description: "Populate a Visant Labs brand guideline from local project files (Figma text exports, strategy docs, creative concept MDs). Use when the user points to a folder with brand/branding materials and wants to create or update a brand guideline via the Visant MCP API. Triggers on: 'populate brand', 'create brand guideline from folder', 'brand populate', referencing local brand files + Visant MCP, or invoking /visant-brand-populate."
---

# Visant Brand Populate

Extract structured brand data from local files and push to Visant Labs API via MCP tools.

## Workflow

1. **Discover files** - Glob `<folder>/**/*.md` + `**/*.txt` + image files (png/jpg/svg for logos)
2. **Read all markdown/text files** - Extract structured sections
3. **Check existing** - Call `mcp__visant__brand-guidelines-list` to avoid duplicates
4. **Create** - Call `mcp__visant__brand-guidelines-create` with extracted data
5. **Update** - Call `mcp__visant__brand-guidelines-update` to fix unicode/accents and add tags
6. **Logo** (optional) - Call `mcp__visant__brand-guidelines-upload-logo` if logo files found

## Extraction Rules

Parse messy Figma text exports by looking for these patterns:

### Identity
- **name**: Brand name (usually in title or filename)
- **tagline**: Look for slogan, tagline, subtitulo sections
- **description**: Look for descricao inicial, sobre, about, servicos sections
- **website**: Any URL mentioned

### Colors
- Extract hex values (#XXXXXX) with their names and roles
- Map names like "Foundation", "Primary", "Background" to roles: primary, secondary, background, accent, text

### Typography
- Look for font family names (e.g., "DM Sans", "Inter", "Space Mono")
- Map to roles: heading, body, mono, accent
- Extract style info: Bold, Regular, SemiBold

### Guidelines
- **voice**: Tom de voz section content
- **dos**: Positive recommendations, "deve", "sempre"
- **donts**: Negative rules, "nunca", "evitar", "nao fazer"
- **imagery**: Visual direction, photography rules, graphic elements description

### Strategy
- **manifesto**: Look for "manifesto", "por que existe", "proposito" sections
- **positioning**: Key positioning statements as array
- **archetypes**: Look for arquetipo sections with name, description, role (primary/secondary), examples
- **voiceValues**: Tom de voz entries with title, description, example phrase
- **personas**: Look for persona sections with name, age, occupation, bio, desires, painPoints, traits

### Tags
- **industry**: Sector keywords
- **style**: Visual style descriptors
- **keywords**: Brand pillars and key terms

## API Constraints

- `brand-guidelines-create` may fail with unicode in strategy field - use ASCII-safe text first
- `brand-guidelines-update` handles unicode properly - use it to patch accents after creation
- Colors array replaces fully on update - always send complete array
- Typography array replaces fully on update - always send complete array

## Output

After completion, confirm:
- What was populated (sections list)
- Guideline ID for future reference
- Offer next steps: publish public, upload logo, refine sections, generate creatives
