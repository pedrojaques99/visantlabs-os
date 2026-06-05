# Visant Labs® | AI Design Platform

<div align="center">
  <p><strong>Open-source AI-powered platform for brand creation, mockup generation, 3D visualization, and creative production.</strong></p>
  <p>Brand guidelines as AI input, 30+ design tools, Figma plugin, MCP server, and CLI — all in one stack.</p>

![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6)
![React](https://img.shields.io/badge/React-19-61dafb)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)

</div>

---

## What is Visant Labs?

Visant Labs is a full-stack AI design platform where **brand guidelines are input for AI generation, not just static documentation**. Upload your brand, and every tool in the platform — mockups, 3D, creative studio, canvas — uses your identity to produce on-brand results.

## Platform Features

### Brand Guidelines

Comprehensive design system management with identity, colors, typography, logos, voice/tone, strategy, archetypes, and personas. Features include:

- AI-powered auto-populate from URLs, PDFs, or text
- Design system validation with WCAG contrast checks
- Version history with rollback
- Figma sync for design tokens extraction
- Public sharing with read-only links
- Completeness health check with AI analysis
- Brand grid dashboard with search, folder filters, and sort

### 3D Studio

WebGL-based 3D model viewer and editor built on Three.js and React Three Fiber:

- SVG/PNG to 3D extrusion with auto-fit sizing
- Brand logo import directly from guidelines
- 15+ material presets (plastic, metal, glass, wood, ceramic, neon, holographic)
- Chain/pendant system with GLB import
- Shape frames (ring, star, shield, hex, heart, diamond)
- Scene controls: HDRI environments, shadows, ground, grid, fog
- Post-processing: SSAO, chromatic aberration, film grain, color grading
- Animations: spin, float, pulse, wobble, physics
- Export: PNG, JPG, GIF, MP4 turntable, GLB, OBJ
- Cloud scene persistence with undo/redo

### Image Lab

Unified multi-mode image editor with 4 engines:

- **Halftone**: CMYK halftone with dot size, angle, and color control
- **Texture**: Film grain, noise, paper, canvas texture overlays
- **Riso**: Risograph printing simulation with ink layers
- **Shader**: Custom visual effects and color grading
- Magic Hand interactive parameter control
- Server-side video/GIF export with FFmpeg
- MCP tools for headless processing

### Mockup Machine

AI-powered mockup generator with 500+ community presets:

- Upload design + describe scene = photorealistic mockup
- Categories: devices, print, apparel, signage, packaging, stationery
- Brand-aware generation (injects logos, colors from guidelines)
- Multi-model: GPT Image, Gemini, Seedream, Ideogram V3/V4, REVE Image 1.0
- Compare Models mode: generate with multiple providers side-by-side
- Community preset library with likes, search, and filtering
- Multi-format output: 1:1, 9:16, 16:9, 4:5

### Canvas / Pipeline Editor

React Flow-based node graph for batch design automation:

- 50+ node types: Image, Video, Text, Merge, Upscale, Mockup, Branding, Logo, Strategy
- Variables & data nodes for CSV/JSON batch processing
- Real-time collaboration via Liveblocks
- Pipeline asset inbox for organizing inputs
- Export/import as JSON workflows

### Content Studio

Campaign-to-assets pipeline — one brief generates all social media content:

- Write a campaign brief → generate copy + images for every platform at once
- Brand guideline injection for on-brand results
- Tone control (professional, casual, playful, bold, minimal)
- Multi-provider image generation (Gemini, Ideogram, REVE, Seedream)
- Background job polling with auto-resume on page reload
- Full i18n support (en-US, pt-BR)

### Creative Studio

AI-driven layout composition engine:

- Structured planning: background, text layers, logo placement, overlays
- Brand-aware generation from guidelines context
- Server-side rendering to PNG
- Project management with save/load

### Branding Machine

Guided AI brand identity generator:

- Multi-step pipeline: market research, personas, archetypes, manifesto, colors, typography
- Moodboard collection and sentiment analysis
- SWOT analysis generation
- AI expert chat for brand strategy

### 30+ Design Tools

All available at `/apps`:

| Tool               | Description                                                                |
| ------------------ | -------------------------------------------------------------------------- |
| Visual Search      | Multi-source search (Unsplash, Pexels, Pixabay, Wikimedia, Clearbit, Svgl) |
| Upscale            | AI image upscaling                                                         |
| Compress           | Image compression and optimization                                         |
| Color Converter    | HEX, RGB, HSL, CMYK conversion                                             |
| Color Palette      | Extract and generate color palettes                                        |
| Format Converter   | Multi-format image conversion                                              |
| SVG Optimizer      | SVG cleanup and minification                                               |
| QR Code            | QR code generator with branding                                            |
| Favicon            | Multi-size favicon generator                                               |
| OG Image           | Open Graph image generator                                                 |
| Watermark          | Batch watermark tool                                                       |
| Background Remover | AI-powered background removal                                              |
| Grid Paint         | Pixel grid drawing tool                                                    |
| Grid Machine       | Layout grid generator                                                      |
| Moodboard Studio   | Visual moodboard builder                                                   |
| Extractor          | PDF/document text extraction                                               |
| Budget Machine     | Project budget templates and sharing                                       |
| Wind Tunnel        | Experimental design lab                                                    |

### Figma Plugin

In-editor AI assistant with brand context:

- Brand apply (inject colors, fonts, logos to Figma)
- Brand import/sync from Figma variables
- Brand matrix comparison automation
- Component registry and context tools
- Export with bleed and metadata

### Playground

AI-powered interactive miniapps and experimentation space:

- Chat interface for AI-composed components
- Community sharing with fork/like/publish
- Sandpack live code preview
- Collapsible sidebar with search

### MCP Server

Model Context Protocol server for AI agent integration:

- 93+ tools for brand, mockup, creative, image, and analytics operations
- OAuth 2.1 + PKCE authentication (no more hardcoded tokens)
- Streamable HTTP transport (`POST /api/mcp`) + legacy SSE (`GET /api/mcp/sse`)
- Persistent refresh tokens with automatic cleanup
- HTTP and stdio transport modes

### CLI Tool

```bash
npx visantlabs login     # Authenticate
npx visantlabs mcp setup # Configure MCP for Claude Code
npx visantlabs skills    # Manage skills
```

### Developer Portal

- API key management with usage tracking
- Interactive API documentation
- Usage dashboard with cost analytics
- Getting started guide

## Tech Stack

| Layer         | Technologies                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Frontend      | React 19, TypeScript 5, Vite 6, Tailwind CSS                                                    |
| UI            | Shadcn/ui, Framer Motion, React Flow, Konva.js                                                  |
| 3D            | Three.js, React Three Fiber, React Three Drei                                                   |
| State         | Zustand, TanStack React Query                                                                   |
| Backend       | Node.js, Express, Prisma ORM                                                                    |
| Database      | MongoDB (Prisma ORM)                                                                            |
| AI/ML         | Google Gemini, OpenAI GPT Image, Ideogram V3/V4, REVE Image 1.0, Google Veo 3 (video), Seedream |
| Storage       | Cloudflare R2                                                                                   |
| Auth          | Google OAuth, email/password, TOTP 2FA, session tokens                                          |
| Collaboration | Liveblocks (real-time canvas)                                                                   |
| Payments      | Stripe, AbacatePay (PIX/Brazil)                                                                 |
| i18n          | English (en-US), Portuguese Brazil (pt-BR)                                                      |
| Testing       | Vitest, Supertest, MSW                                                                          |

## Quick Start

### Prerequisites

- Node.js 20+
- MongoDB (local, [Atlas](https://www.mongodb.com/cloud/atlas), or Docker: `docker run -d -p 27017:27017 mongo`)
- Google Gemini API Key

### Installation

```bash
# Clone
git clone https://github.com/pedrojaques99/visantlabs-os.git
cd visantlabs-os

# Install
npm install

# Configure
cp env.example .env.local
# Edit .env.local with your keys (see env.example for all options)

# Run
npm run dev:all    # Frontend (3000) + Backend (3001)
# Or separately:
npm run dev        # Frontend only
npm run dev:server # Backend only
```

### Minimum Environment Variables

```env
MONGODB_URI=mongodb://localhost:27017/visantlabs
JWT_SECRET=your-secret-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_GEMINI_API_KEY=your-gemini-key
```

## Optional Services

| Service       | Required For                     | Setup Guide                                          | Without It           |
| ------------- | -------------------------------- | ---------------------------------------------------- | -------------------- |
| Google Gemini | AI generation, mockups, branding | [docs/SETUP_LLM.md](docs/SETUP_LLM.md)               | AI features disabled |
| Ideogram      | Ideogram V3/V4 image generation  | Set `IDEOGRAM_API_KEY` in `.env.local`               | Ideogram unavailable |
| REVE          | REVE Image 1.0 generation        | Set `REVE_API_KEY` in `.env.local`                   | REVE unavailable     |
| Stripe        | Subscriptions, credit purchases  | [docs/SETUP_STRIPE.md](docs/SETUP_STRIPE.md)         | Payments disabled    |
| AbacatePay    | PIX payments (Brazil)            | [docs/SETUP_ABACATEPAY.md](docs/SETUP_ABACATEPAY.md) | PIX unavailable      |
| Cloudflare R2 | Permanent image storage          | [docs/SETUP_R2.md](docs/SETUP_R2.md)                 | Base64 temp storage  |
| Liveblocks    | Real-time canvas collaboration   | [docs/SETUP_LIVEBLOCKS.md](docs/SETUP_LIVEBLOCKS.md) | Individual mode      |

### Additional Docs

- [MCP Server Setup](docs/SETUP_MCP.md) — Connect AI agents to Visant via MCP
- [API Key Policy](docs/API_KEY_POLICY.md) — Key management and security guidelines

## Development

```bash
npm run dev:all        # Full-stack dev
npm run type-check     # TypeScript check
npm run lint           # ESLint
npm run format         # Prettier
npm run db:studio      # Prisma Studio
npm run check-env      # Validate env vars
npm run check-mongodb  # Test DB connection
```

### Project Structure

```
src/
  components/     # React components (UI, brand, canvas, 3D, etc.)
  pages/          # Route pages
  hooks/          # Custom React hooks
  services/       # API service clients
  lib/            # Core utilities and types
  locales/        # i18n translation files
server/           # Express backend + Prisma
mcp-server/       # MCP server for AI agents
plugin/           # Figma plugin source
cli/              # CLI tool source
scripts/          # Build and utility scripts
tests/            # Vitest test suites
docs/             # Setup and policy docs
```

## Forking & Customization

1. **Branding** — Edit `src/config/branding.ts` (company name, links, support email)
2. **SEO** — Update `public/sitemap.xml` and `public/robots.txt` with your domain
3. **Legal** — Update legal pages in `src/locales/en-US.json` and `pt-BR.json`
4. **Environment** — Set `VITE_SITE_URL` to your production domain

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

[React Flow](https://reactflow.dev/) | [Three.js](https://threejs.org/) | [Konva.js](https://konvajs.org/) | [Google Gemini](https://ai.google.dev/) | [Liveblocks](https://liveblocks.io/) | [Stripe](https://stripe.com/) | [Shadcn/ui](https://ui.shadcn.com/)

---

Created by **Pedro Jaques & [Visant Company](https://www.visant.co)**
