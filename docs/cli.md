# Terminal interface

Corex Code uses an interactive terminal UI for normal sessions and plain text
output for one-shot prompts and model-management commands. The interface keeps
the current mode, model, provider, task activity, conversation, and approvals in
one view.

## Screen layout

```text
                  COREX CODE · v0.1.0

╭─────────────────────────────────────────────────────────────────────╮
│ › Ask anything…                                                     │
│                                                                     │
│ Build · qwen2.5-coder:3b · Ollama                                  │
╰─────────────────────────────────────────────────────────────────────╯
 Ready                    shift+tab mode  ctrl+p commands  ctrl+o models
```

The interface uses the terminal's locked alternate screen. The compact text banner
stays pinned at the top, while the composer, status, and shortcuts stay pinned
at the bottom. Only the middle conversation viewport scrolls, using the
mouse wheel or one screen at a time, without moving the terminal itself. Narrow
terminals use a compact banner and omit the repository path from the footer.

Startup does not contact Ollama. Use `/model` to connect and select or download
a model; connection and model errors are shown only after that action.

## Composer

- Type a prompt directly into the bordered composer.
- Type `/` to show every command. Continue typing to filter the list, use the
  arrow keys to choose a command, and press `Enter` to run it.
- Press `Enter` to submit.
- Press `Shift+Enter` or `Meta+Enter` to insert a newline when the terminal
  reports modifier keys.
- Press `Up` and `Down` in a single-line composer to navigate prompt history.
- Press `Escape` to clear the current draft.
- Pasted input is limited to 8,000 characters per prompt.
- The composer is disabled while a turn is running.

Model output streams into the conversation. The activity line reports tool
execution, approval requests, applied files, cancellation, and errors. Token
usage appears in the composer status when the provider reports it.

Conversation messages use a borderless chat layout: your messages appear in
cyan on the right, while Corex responses appear in green on the left. System and
error messages remain left-aligned with their own status colors.

## Response rendering

Assistant responses support terminal-friendly Markdown:

- headings use bold accent colors;
- bullet lists use visible markers;
- inline code uses a distinct code color;
- fenced code blocks receive a bordered panel and language label;
- common language and SQL keywords, strings, numbers, and comments receive
  syntax colors; and
- diff additions and removals render in green and red.

Some smaller local models emit a tool request as JSON text instead of using
Ollama's structured tool-call field. Corex recognizes only declared tool names,
validates their arguments through the normal safety layer, suppresses the raw
JSON, and sends the tool result back to the model. Ordinary JSON answers and
unknown tool names remain normal visible text and are never executed.

## Modes

Press `Shift+Tab` to cycle modes:

| Mode | Behavior |
| --- | --- |
| Build | Inspect the repository and propose edits for explicit approval |
| Plan | Inspect the repository and produce a plan; host-side editing is disabled |
| Ask | Inspect evidence and answer questions; host-side editing is disabled |

Plan and Ask are enforced by the runtime. A model tool call cannot bypass their
read-only restriction.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Enter` | Submit the composer or select a palette item |
| `Shift+Enter` | Insert a newline when supported by the terminal |
| `Shift+Tab` | Cycle Build, Plan, and Ask modes |
| `Ctrl+P` | Open the command palette |
| `Ctrl+O` | Open the model modal (shortcut for `/model`) |
| `Ctrl+L` | Clear the visible conversation |
| `Ctrl+C` | Cancel the active turn, or exit when idle |
| `Up` / `Down` | Navigate a palette or prompt history |
| `Page Up` / `Page Down` | Scroll older or newer chat messages |
| `Ctrl+Up` / `Ctrl+Down` | Alternative chat scrolling shortcuts |
| `Escape` | Close a palette or clear the draft |
| `Y` / `N` | Apply or reject a displayed patch approval |

## Command palette

Press `Ctrl+P`, then use `Up`, `Down`, and `Enter`.

| Command | Action |
| --- | --- |
| `/help` | Display commands and keyboard shortcuts |
| `/status` | Display short Git status |
| `/diff` | Display the safe unstaged Git diff |
| `/model` | Select an installed model or download a model |
| `/copy` | Copy the latest complete assistant response |
| `/copy-code [number]` | Copy a numbered code block from the latest response |
| `/clear` | Clear the visible conversation |
| `/new` | Start a fresh agent session |
| `/exit` | Exit Corex |

Commands may also be typed directly into the composer.

Every assistant response displays a copy control below it, and every fenced code
block displays its own copy control. `/copy-code N` remains available for
keyboard use; omitting the number copies the last code block in the response.

The displayed `[ Copy full response ]` and `[ Copy code ]` controls can also be
clicked with the mouse. Compatible terminals change the mouse pointer to a hand
while it is over a copy control. Keyboard commands remain available in terminals
that do not report mouse movement or pointer shapes.

## Model picker

Type `/model` to open the model manager. It separates the active model,
installed models, and a curated catalog of downloadable open coding models.
Selecting an installed model activates it immediately. Selecting a model that
is not installed downloads it, displays byte and percentage progress, and
activates it automatically when complete.

Press `Ctrl+C` during a download to pause it. Press `R` or `Enter` to retry and
resume through Ollama's resumable blob downloads, `X` to cancel, or `Escape` to
return to the catalog. “Download another model” accepts any valid Ollama model
name. `Ctrl+O` opens the same manager as a shortcut.
Switching models starts a fresh agent session so conversation state from one
model is not silently passed to another.

Use the explicit download command when a model is not installed:

```bash
corex models pull qwen2.5-coder:7b
```

Download progress stays in the modal and `Ctrl+C` cancels the active download.

## Patch approvals

When Build mode proposes a patch, the composer is replaced by an approval panel
containing the path, explanation, and exact diff. Press `Y` to apply it or `N`
or `Escape` to reject it. The agent cannot consume normal composer input while
an approval is pending.

Approval remains bound to the displayed patch and source hash. If the file has
changed, Corex rejects the stale patch even after approval.

## One-shot mode

Passing a prompt keeps output suitable for scripts and logs instead of launching
the terminal UI:

```bash
corex "Explain the configuration loader"
```

Interactive mode requires a TTY. Non-interactive environments must pass a
prompt or use a model-management subcommand.
