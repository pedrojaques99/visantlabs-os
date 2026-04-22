# Plugin Tests

## Structure

```
tests/plugin/
├── unit/           # Unit tests for hooks, store, utils
├── integration/    # Integration tests (API, auth, brand sync)
├── e2e/            # End-to-end tests (requires Figma)
├── fixtures/       # Mock data, test data
└── README.md       # This file
```

## Running Tests

```bash
# All tests
npm test

# Watch mode
npm test -- --watch

# Specific suite
npm test -- tests/plugin/unit/store.test.ts

# Coverage
npm test -- --coverage
```

## Test Categories

### Unit Tests
- Store actions (Zustand)
- Hook logic (useAuth, useMentions, etc)
- Utilities (parsing, formatting)

### Integration Tests
- API calls (auth, brand sync, Gemini)
- Message flow (UI ↔ Sandbox)
- State synchronization

### E2E Tests
- Full plugin flow in Figma
- User interactions
- Real API calls

## To Implement

- [ ] Jest/Vitest setup
- [ ] Store tests
- [ ] Hook tests
- [ ] Component tests (React Testing Library)
- [ ] API mocking (MSW)
- [ ] Integration tests
- [ ] E2E tests (Playwright + Figma)
