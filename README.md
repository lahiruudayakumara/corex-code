# Corex Code

> The intelligent, open-source coding agent.

**Code smarter. Remember everything. Ship with confidence.**

Corex Code is a local-first AI coding agent designed around safe changes,
focused repository context, and verifiable results. The CLI command is
`corex`.

The complete product architecture combines persistent memory, smart context,
token and cost controls, fast local inference, provider choice, verified edits,
safe autonomous execution, agent debugging, multi-agent coordination, and
optional team collaboration.

> [!IMPORTANT]
> Corex Code is in its initial design and implementation phase. The `v0.1`
> branch defines the first working release; commands shown in the documentation
> are the target interface until the implementation lands.

## v0.1 scope

The first release focuses on a small, trustworthy coding loop:

- chat with a configured language model from a terminal;
- inspect files inside the selected repository;
- propose file edits and require approval before applying them;
- preview the resulting Git diff; and
- keep tool activity visible to the user.

Persistent memory, automated verification, checkpoints, and multi-model routing
are planned for later releases. See the [roadmap](ROADMAP.md).

## Planned quick start

Prerequisites:

- Node.js 20 or newer;
- npm 10 or newer;
- Git; and
- either Ollama or credentials for a supported cloud model.

```bash
npm install
npm run build
npm link
corex
```

Corex will open the current Git repository and start an interactive session.
The exact installation flow will be verified and updated as the CLI is built.

## Documentation

- [v0.1 product specification](docs/v0.1-spec.md)
- [Complete feature catalog](docs/features.md)
- [Architecture](docs/architecture.md)
- [Performance and local models](docs/performance.md)
- [Getting started](docs/getting-started.md)
- [Safety model](docs/safety.md)
- [Roadmap](ROADMAP.md)
- [Contributing](CONTRIBUTING.md)

## Project principles

1. **User control:** reading, editing, and command execution are separate,
   explicit capabilities.
2. **Repository boundaries:** tools operate only inside the selected project
   unless the user deliberately expands the scope.
3. **Visible changes:** every proposed edit is reviewable before it is applied.
4. **Provider independence:** agent behavior is not coupled to one model vendor.
5. **Honest results:** Corex reports what it inspected, changed, and verified.

## License

Corex Code is available under the [MIT License](LICENSE).
