# Safety model

Corex Code treats model output as untrusted input. The model can request a
capability, but host-side code validates and authorizes every operation.

## v0.1 trust boundary

Corex is allowed to inspect the selected Git repository. It is not allowed to:

- read outside the resolved repository root;
- follow a symbolic link outside that root;
- read known secret files by default;
- write a file without showing and approving the proposed patch;
- execute arbitrary shell commands;
- modify Git history, branches, remotes, the index, or commits; or
- send credentials to a model intentionally.

## Path safety

All tool paths must be resolved against one immutable repository root. The tool
layer rejects absolute paths, traversal segments, null bytes, paths inside
`.git`, and resolved paths outside the root. It must check the final real path
so symbolic links cannot bypass the boundary.

## Read policy

The default deny list should include:

```text
.env
.env.*
.git/**
**/*.pem
**/*.key
**/credentials*
node_modules/**
```

Generated and dependency directories are excluded for relevance and cost as
well as safety. A repository may add excludes. Relaxing secret-file rules
requires an explicit future policy design; it is not part of v0.1.

## Write approval

Approval is bound to the exact patch content and file versions shown to the
user. Changing a proposal invalidates prior approval. Before applying it, Corex
verifies that source content still matches the version used to create the
patch.

Rejecting or cancelling a proposal leaves all files unchanged. File replacement
should use a temporary file and atomic rename when the platform supports it.

## Secret handling

- Provider tokens are read from environment variables.
- Configuration files contain provider and model names, not tokens.
- Logs redact known credential values and common authorization headers.
- Raw provider errors are sanitized before display.
- Prompts include only context selected through repository tools.

Redaction reduces accidental exposure but is not a substitute for excluding
secret files from model context.

## Prompt injection

Repository content may contain instructions intended to manipulate the model.
Corex treats file content as data, never as authorization. Text inside a file
cannot approve a patch, change the repository boundary, enable a tool, or alter
the safety policy.

## Reporting a vulnerability

Do not open a public issue containing exploit details or credentials. Until a
private security contact is published, report only that a private disclosure
channel is needed; a maintainer can then arrange a secure exchange.
