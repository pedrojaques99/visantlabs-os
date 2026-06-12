# Reference Seeder

Populate the geo-tagged reference library (`/references`) from **curated, jury-selected
award archives**. The curation already exists — D&AD, The One Club (TDC/ADC), iF, Pentawards,
Fonts In Use et al. have done it, and most record the **country of origin**. We just harvest it.

## Philosophy

**Collection is decoupled from ingestion.**

```
 award gallery ──(Firecrawl, LLM extraction)──▶ SeedItem[] ──(ingest core)──▶ reference library
       │                                            ▲
       └────────── or a hand-authored JSON manifest ┘
```

- **Ingestion** (`ingest.ts`) is deterministic, idempotent, and testable: it normalizes
  provenance via the taxonomy SSoT (`src/lib/references/taxonomy.ts`), dedups against prior
  runs + the live library, re-hosts a compressed copy on R2 (never hotlinks), and runs the
  existing `ingestReference()` pipeline (AI tags + multimodal vector).
- **Collection** (`sources/*.ts`) is pluggable. Each adapter knows one gallery's URL shape and
  returns `SeedItem[]`. We use Firecrawl's `agent` (schema-driven LLM extraction) rather than
  brittle HTML parsing, so adapters survive layout changes.

## Start here (free, no credits)

The **`arena`** source uses the public Are.na API (no token, no Firecrawl credits).
It's the zero-cost way to start populating today:

```bash
# free: pull curated design channels from Are.na
npx tsx server/scripts/seedReferences.ts --source arena --limit 30

# geo-scoped (uses Are.na's geo-themed channels)
npx tsx server/scripts/seedReferences.ts --source arena --country Switzerland --limit 20
npx tsx server/scripts/seedReferences.ts --source arena --country Japan --limit 20
```

Firecrawl-based sources (one-club, fonts-in-use, pentawards) need credits; the runner
auto-skips them when credits are 0 and continues with free sources.

## Usage

```bash
# list sources
npx tsx server/scripts/seedReferences.ts --list

# dry-run a scoped scrape (no writes; shows the plan)
npx tsx server/scripts/seedReferences.ts --source one-club --country Japan --limit 20 --dry-run

# live seed
npx tsx server/scripts/seedReferences.ts --source pentawards --limit 30

# all sources
npx tsx server/scripts/seedReferences.ts --source all --limit 15

# ingest a pre-built manifest — no scraping, no Firecrawl credits needed
npx tsx server/scripts/seedReferences.ts --from-json ./my-refs.json
```

### Flags

| Flag | Meaning |
|---|---|
| `--source <id\|all>` | adapter to run (`--list` to see) |
| `--country <name>` | scope to a country — "Japan", "Russia", "Switzerland"… |
| `--limit <n>` | max items per source (default 20) |
| `--from-json <file>` | ingest a manifest, skip scraping |
| `--dry-run` | plan only — no scraping side effects, no DB/R2 writes |
| `--private` | seed as non-public (default: public) |
| `--user <id>` | ingestor userId (default `SEED_USER_ID` env or `system-reference-seed`) |

## Requirements

- **Env** (`.env.local`): `MONGODB_URI`, `PINECONE_API_KEY`, `R2_*`, `GEMINI_API_KEY` —
  same as the server. The script reuses the server pipeline directly.
- **Firecrawl** (for scraping paths only): installed + credits. Check `firecrawl --status`.
  No credits? Use `--from-json` or `--dry-run`. The runner pre-flights credits and aborts cleanly.

## Manifest format (`--from-json`)

`SeedItem[]` or `{ "items": SeedItem[] }`:

```json
[
  {
    "imageUrl": "https://…/work.jpg",
    "sourceUrl": "https://…/winner/123",
    "awardSource": "D&AD 2024",
    "title": "Acme Rebrand",
    "studio": "Studio X",
    "country": "Japan",
    "year": 2024
  }
]
```

Only `imageUrl` + `sourceUrl` are required. `country` is normalized and `region` auto-derived
via the taxonomy SSoT. `sourceUrl` is the dedup key.

## Ethics & robustness

- We store a **compressed copy + attribution link** (`sourceUrl`), not the original full-res —
  the same posture as Fonts In Use. Respect each source's robots.txt / ToS.
- Re-runs are **idempotent**: the `reference_seed_log` collection + live-library check prevent
  duplicates, so the seeder is safe to resume.
- Gallery URLs may need adjusting on first live run — sites evolve. The LLM extractor reads
  whatever gallery is served, so adapters degrade gracefully rather than crash.

## Adding a source

Copy an adapter in `sources/`, set its gallery URL + `awardSource`, register it in
`sources/index.ts`. High-value next targets (all geo-native): **iF Design**, **Golden Bee**
(Russia/Eastern Europe), **Packaging of the World** (`/location/{cc}`), **European Design Awards**,
**Kyoorius** (India), **Golden Pin** (Taiwan).
