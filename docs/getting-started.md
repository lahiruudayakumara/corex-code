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

## Install from npm

```bash
npm install --global corex-code
corex --version
corex
```

The npm registry distributes the package, while Bun runs the installed CLI.
Corex opens without contacting Ollama and waits for `/model` before model setup.

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

Start Ollama:

```bash
ollama serve
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

## Select and download models

Corex opens the terminal UI without blocking on model setup. Type `/model` to
open an inline modal like this:

```text
Select or download model
› qwen2.5-coder:3b 3.1B Q4_K_M
  Download configured: qwen2.5-coder:7b
  Download another model…
```

Use the arrow keys and `Enter` to choose an installed model, download the
configured model, or enter another Ollama model name. Download progress remains
inside the modal and `Ctrl+C` cancels it.

The same operations are available as explicit commands:

```bash
corex models list
corex models pull qwen2.5-coder:7b
```

Use `--host` with either command when Ollama is not listening at
`http://127.0.0.1:11434`:

```bash
corex models list --host http://192.168.1.10:11434
```

For a non-interactive Corex invocation, install the configured model first or
pass the name of an installed model with `--model`.

## Interactive terminal UI

The full interface guide is in [cli.md](cli.md).

| Input | Behavior |
| --- | --- |
| `Enter` | Submit the composer |
| `Shift+Enter` | Insert a newline when supported by the terminal |
| `Shift+Tab` | Cycle Build, Plan, and Ask modes |
| `Ctrl+P` | Open the command palette |
| `Ctrl+O` | Open the `/model` modal |
| `/help` | Show session help |
| `/status` | Show short Git status |
| `/diff` | Show the safe unstaged Git diff |
| `/model` | Select or download an Ollama model |
| `/clear` | Clear the visible conversation |
| `/new` | Start a new agent session |
| `/exit` | Close the session |
| `Ctrl+C` | Cancel the active turn, or exit while idle |

When Corex proposes a change, the composer becomes an approval panel containing
the explanation and exact diff. Press `Y` to apply or `N`/`Escape` to reject.
Corex verifies that the source file has not changed since proposal creation and
uses an atomic replacement.

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

### The configured model is not installed

Type `/model` in the terminal UI, run `corex models pull <name>`, or select an
installed model for one invocation with `corex --model <name>`.

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
