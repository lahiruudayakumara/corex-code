import { CorexError } from "./errors";

type RunOptions = {
  cwd: string;
  signal?: AbortSignal | undefined;
  timeoutMs?: number;
  maxOutputBytes?: number;
  allowedExitCodes?: number[];
};

export type ProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export async function runProcess(
  command: string,
  args: string[],
  options: RunOptions,
): Promise<ProcessResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const process = Bun.spawn([command, ...args], {
      cwd: options.cwd,
      stdout: "pipe",
      stderr: "pipe",
      signal: controller.signal,
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ]);
    const limit = options.maxOutputBytes ?? 1_000_000;
    if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > limit) {
      throw new CorexError(`Command output exceeded ${limit} bytes`);
    }
    if (!(options.allowedExitCodes ?? [0]).includes(exitCode)) {
      throw new CorexError(`${command} failed (${exitCode}): ${stderr.trim() || stdout.trim()}`);
    }
    return { stdout, stderr, exitCode };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new CorexError(options.signal?.aborted ? "Operation cancelled" : "Command timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
