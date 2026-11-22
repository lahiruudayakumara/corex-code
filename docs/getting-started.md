# Getting started

## Current project status

Corex Code v0.1 is not yet implemented. This guide describes the intended local
development workflow and will be tested against the CLI as it is built.

## Prerequisites

- macOS, Linux, or Windows with a compatible terminal;
- Node.js 20 or newer;
- npm 10 or newer;
- Git; and
- a model provider supported by the implementation.

For local development on a 16 GB machine, a smaller coding model through Ollama
is a practical starting point. Cloud providers can be used when a task needs a
larger model.

## Planned local setup

```bash
git clone <repository-url>
cd corex-code
npm install
npm run build
npm test
npm link
```

Replace `<repository-url>` with the canonical repository URL once it is
published.

## Configure Ollama

Install and start Ollama, then pull a coding model appropriate for the machine:

```bash
ollama pull qwen2.5-coder:7b
```

Create `corex.config.json` in the repository where Corex will run:

```json
{
  "provider": "ollama",
  "model": "qwen2.5-coder:7b"
}
```

Model availability and names can change; this is an example configuration, not
a guaranteed default.

## Start a session

From the root of a Git repository:

```bash
corex
```

Then describe a bounded task, for example:

```text
Add input validation to the createUser function and update its unit tests.
```

Corex should show file reads and searches as they occur. If it proposes an
edit, review the patch and explicitly approve or reject it. After an approved
edit, inspect the displayed Git diff before doing any commit.

## Troubleshooting targets

### Corex cannot find a Git repository

Run the CLI from inside a working tree and verify `git status` succeeds.

### Ollama connection fails

Confirm the Ollama service is running and that the configured base URL is
reachable. Check that the selected model appears in `ollama list`.

### A file is excluded

Corex excludes sensitive and generated paths by default. Review the file policy
and repository configuration before adding a narrow exception. Secret files
such as `.env` should remain excluded.

### A patch is stale

The file changed after Corex read it. Reject the stale patch and ask Corex to
read the current file before proposing a new edit.
