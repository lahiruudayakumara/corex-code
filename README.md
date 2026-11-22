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
> The `v0.1` branch contains the first runnable release. It supports Ollama,
> repository inspection, approved exact-text patches, and Git diff display.
> Later roadmap capabilities remain planned.

## v0.1 scope

The first release focuses on a small, trustworthy coding loop:

- chat with a configured language model from a terminal;
- inspect files inside the selected repository;
- propose file edits and require approval before applying them;
- preview the resulting Git diff; and
- keep tool activity visible to the user.

Persistent memory, automated verification, checkpoints, and multi-model routing
are planned for later releases. See the [roadmap](ROADMAP.md).

## Quick start

Prerequisites:

- Bun 1.3 or newer;
- Git; and
- ripgrep;
- Ollama with a tool-capable coding model.

```bash
bun install
cp corex.config.example.json corex.config.json
ollama serve
bun run dev
```

In another terminal, ensure the configured model is available with
`ollama pull qwen2.5-coder:7b`. Run `bun run build && bun link` if you want to
invoke the compiled CLI as `corex`.

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
