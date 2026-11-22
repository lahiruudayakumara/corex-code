# Getting started

Corex Code v0.1 is a Bun-powered terminal agent for Git repositories. It uses a
local Ollama model, exposes bounded read/search/diff tools, and requires approval
before applying an exact patch.

## Prerequisites

- macOS, Linux, or Windows with a compatible terminal;
- Bun 1.3 or newer;
- Git;
- ripgrep (`rg`); and
- Ollama with a coding model that supports tool calling.

On a 16 GB Apple silicon machine, begin with a smaller quantized coding model.
Model quality and speed depend on the model, quantization, context, and runtime.

## Install for development

```bash
git clone <repository-url>
cd corex-code
bun install
bun run check
```

Replace `<repository-url>` with the canonical repository URL once it is
published. Bun creates and uses `bun.lock`; do not create npm, pnpm, or Yarn
lockfiles for this project.

## Configure Ollama

Start Ollama and download the default model:

```bash
ollama serve
ollama pull qwen2.5-coder:7b
```

Copy the example configuration:

```bash
cp corex.config.example.json corex.config.json
```

The supported v0.1 configuration is:

```json
{
  "provider": "ollama",
  "model": "qwen2.5-coder:7b",
  "ollama": {
    "baseUrl": "http://127.0.0.1:11434",
    "keepAlive": "5m"
  },
  "agent": {
    "maxSteps": 12,
    "maxFileBytes": 200000,
    "maxSearchResults": 100
  }
}
```

This file contains no secret. Keep provider credentials out of configuration if
future adapters introduce them.

## Run Corex

Start the development CLI from the repository you want Corex to inspect:

```bash
bun run /path/to/corex-code/src/cli.ts
```

From the Corex Code repository itself, use:

```bash
bun run dev
```

To build and link the `corex` command:

```bash
bun run build
bun link
corex --help
```

You can start an interactive session:

```bash
corex
```

Or run one prompt:

```bash
corex "Explain the configuration loader"
```

Use `-C` when the target repository is not the current directory:

```bash
corex -C /path/to/project "Find where users are validated"
```

`--model` and `--host` override configuration for one invocation.

## Interactive commands

| Command | Behavior |
| --- | --- |
| `/help` | Show session help |
| `/status` | Show short Git status |
| `/diff` | Show the safe unstaged Git diff |
| `/exit` | Close the session |
| `Ctrl+C` | Cancel the active model turn |

When Corex proposes a change, it displays the explanation and exact diff. Enter
`y` or `yes` to apply that patch. Any other response rejects it without changing
the file. Corex verifies that the source file has not changed since proposal
creation and uses an atomic replacement.

## Available model tools

- list tracked and unignored files;
- read a bounded range from a text file;
- search repository text with ripgrep;
- show a safe unstaged Git diff; and
- propose one unique exact-text replacement for approval.

v0.1 intentionally has no generic shell, network, commit, branch, push, or
destructive Git tool.

## Troubleshooting

### `bun: command not found`

Install Bun using its official installer and make sure Bun's binary directory is
on `PATH`. Restart the terminal after installation.

### Corex cannot find a Git repository

Run the CLI inside a working tree or pass its path with `corex -C`. Verify that
`git status` succeeds there.

### Ollama connection fails

Confirm `ollama serve` is running, the configured base URL is reachable, and the
selected model appears in `ollama list`.

### The model does not call tools

Select a coding model with tool-calling support. A plain completion model may
respond with text but cannot inspect or edit the repository safely.

### A file is excluded

Corex blocks `.git`, `.corex`, `node_modules`, environment files, private keys,
credentials files, paths outside the repository, and symlinks that escape the
repository. These boundaries cannot be relaxed in v0.1.

### A patch is stale or ambiguous

A stale file changed after Corex created its proposal. An ambiguous `oldText`
appears more than once. Ask Corex to read the current file and propose a new,
unique exact replacement.
