# Contributing to Visant Labs

Thanks for considering contributing! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/[YOUR-USER]/visantlabs-os.git`
3. Install dependencies: `npm install`
4. Copy `env.example` to `.env.local` and configure the required variables
5. Run `npm run dev:all` to start the dev server

## Code Standards

- **TypeScript**: Strong typing, avoid `any` when possible
- **Formatting**: Run `npm run format` (Prettier)
- **Linting**: Run `npm run lint` (ESLint)
- **Commits**: Use conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`)
- **Components**: Use the existing design system in `src/components/ui/` — do not create new UI primitives without discussion
- **i18n**: All user-facing strings must use the translation system (`useTranslation` hook)

## Project Structure

```
src/
  components/     # React components (ui/, brand/, canvas/, 3d/, etc.)
  pages/          # Route page components
  hooks/          # Custom React hooks + queries
  services/       # API service clients
  lib/            # Core utilities, types, schemas
  locales/        # en-US.json, pt-BR.json
server/           # Express backend, Prisma schema, API routes
mcp-server/       # MCP server tools and transport
plugin/           # Figma plugin (separate build)
cli/              # CLI tool (separate build)
tests/            # Vitest unit + integration tests
```

## Before Submitting a PR

1. Run `npm run format` to format code
2. Run `npm run lint` to check for errors
3. Run `npm run type-check` to verify TypeScript
4. Test the affected features manually in the browser
5. Make sure the app starts without errors

## Pull Requests

1. Create a descriptive branch: `git checkout -b feat/my-feature`
2. Keep commits small and focused
3. Clearly describe what changed and why in the PR body
4. Reference related issues if applicable
5. Add screenshots for UI changes

## Working with Optional Services

When adding features that depend on external services (Stripe, Liveblocks, R2, AI APIs):

- Always check if the service is configured before calling it
- Provide graceful fallbacks when possible
- Document the dependency in the relevant setup guide under `docs/`

## Architecture Notes

- **Brand Guidelines** are the core data model — they feed into mockups, creative studio, canvas, and 3D. Changes here have wide impact.
- **Image Lab** consolidates halftone, texture, riso, and shader into one unified editor. New effects should follow the existing mode pattern.
- **3D Studio** uses React Three Fiber — all Three.js objects must be declarative React components, not imperative.
- **Canvas** uses React Flow — custom nodes go in `src/components/canvas/nodes/`.

## Questions?

Open an issue to discuss larger changes or reach out to the maintainers.
