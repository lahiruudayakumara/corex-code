# Contributing to Corex Code

Corex Code has a working v0.1 implementation. Contributions should keep it
small, safe, and testable.

## Before starting

1. Read the [v0.1 specification](docs/v0.1-spec.md),
   [feature catalog](docs/features.md), [architecture](docs/architecture.md),
   [performance targets](docs/performance.md), and
   [safety model](docs/safety.md).
2. Check whether the work is inside v0.1 scope.
3. Open or reference an issue for changes that affect public behavior or
   architecture.

## Development workflow

Install Bun, then run:

```bash
bun install
bun run check
```

`bun run check` performs strict type-checking, linting, tests, and a production
CLI build. Run it before submitting a change.

## Change guidelines

- Keep filesystem and Git operations behind typed tool interfaces.
- Treat all model output and repository content as untrusted input.
- Add tests for path validation, approval behavior, cancellation, and failure
  cases whenever those areas change.
- Never add real API keys, tokens, credentials, or private prompts to fixtures.
- Preserve existing user changes; Corex must not silently overwrite them.
- Prefer a narrow provider-neutral contract over provider logic in the agent.
- Update documentation in the same change when public behavior changes.

## Pull requests

A pull request should explain:

- the user problem being solved;
- the approach and important trade-offs;
- safety implications;
- tests or manual verification performed; and
- follow-up work deliberately left out.

Keep commits focused and avoid unrelated formatting or dependency changes.

## Documentation style

- Use plain language and short examples.
- Mark proposed behavior as planned until it is implemented.
- Keep commands copy-pasteable.
- Prefer relative links between repository documents.
- Use sentence case for headings.

## Security reports

Follow the private-disclosure guidance in [docs/safety.md](docs/safety.md). Do
not publish exploit details in an issue.
