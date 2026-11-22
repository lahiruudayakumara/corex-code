# Performance and local models

Corex Code is designed so orchestration overhead stays small compared with model
generation and project checks. This document defines targets and a repeatable
benchmark strategy. Targets are not achieved results until published benchmark
runs demonstrate them.

## Performance principles

- Stream visible progress instead of waiting for a complete model response.
- Keep repository indexing incremental and off the interactive critical path.
- Cache by content hash so unchanged work is not repeated.
- Set hard context, output, tool, memory, and trace limits.
- Prefer focused reads and tests before broad operations.
- Measure each phase separately so slow model inference is distinguishable from
  Corex overhead.

## Initial targets

Targets use a warm process, an already downloaded local model, and a repository
whose initial index has completed.

| Metric | Target |
| --- | --- |
| CLI startup to prompt | p50 below 500 ms; p95 below 1 s |
| Input acknowledgement | below 100 ms |
| First visible status event | below 200 ms |
| Cached file search in a 100k-file repository | p95 below 500 ms |
| Incremental update after one file change | p95 below 250 ms |
| Approval UI after a patch is ready | below 100 ms |
| Task cancellation acknowledgement | below 250 ms |
| Runtime memory excluding the loaded model | below 500 MB for a medium repository |

Model time-to-first-token and generation rate are reported separately because
they depend strongly on model, quantization, context size, runtime, and hardware.
Corex should add no more than 10% p50 latency to a direct equivalent provider
request in the provider-overhead benchmark.

## Reference profiles

Benchmarks should publish exact hardware and software. The initial development
profile is an Apple silicon laptop with 16 GB unified memory. Test at least:

- a small local coding model suitable for interactive tasks;
- a medium quantized coding model that fits without memory pressure; and
- a deterministic mock adapter to isolate Corex overhead.

No single model is declared universally fastest or best. Documentation should
recommend models only from measured results and should include quality,
latency, memory, and context-size trade-offs.

## Benchmark scenarios

1. **Cold start:** launch Corex without an existing process or index cache.
2. **Warm start:** launch with valid configuration and repository cache.
3. **Focused question:** locate and explain one symbol without editing.
4. **Small patch:** inspect two files, propose one edit, and display the diff.
5. **Verified patch:** change one source file and run its focused tests.
6. **Resume:** restore a checkpoint and continue from the next incomplete step.
7. **Large repository:** search and select context from at least 100,000 files.
8. **Long session:** complete repeated tasks while tracking memory growth.

Each scenario records startup, indexing, retrieval, prompt construction,
provider queue, first token, generation, tool execution, verification, total
time, tokens, peak memory, cache state, and errors.

## Local-model optimizations

### Prompt and context

- Reuse a stable system prefix when the runtime supports prefix caching.
- Send source excerpts rather than whole files.
- Deduplicate identical content across tool results and memory.
- Use compact structured tool results with output truncation metadata.
- Summarize only when a summary will be reused or saves more tokens than it
  costs to create.

### Repository work

- Use ripgrep for lexical search and ignore generated directories.
- Parse and index only changed files.
- Batch background embedding work and allow embeddings to be disabled.
- Keep symbol, Git, and test mappings in a local transactional cache.

### Model runtime

- Reuse provider connections and cache model capability discovery.
- Keep a selected model warm when supported and permitted by memory limits.
- Stream tokens and tool calls immediately.
- Use task-specific context limits instead of always filling the model window.
- Permit a small local model for routing or summarization and a stronger model
  for implementation, while keeping this behavior explicit and configurable.

## Performance gates

Continuous integration uses the deterministic adapter for stable regression
limits. Hardware-dependent local-model benchmarks run on documented machines
and publish historical results. A release cannot claim a target is met without
the benchmark command, configuration, raw result artifact, and version metadata.

Regressions above an agreed threshold block release unless documented and
approved with a clear quality or safety trade-off.
