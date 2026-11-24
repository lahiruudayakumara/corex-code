export type ClipboardMethod = "system clipboard" | "terminal clipboard";

export async function copyText(text: string): Promise<ClipboardMethod> {
  if (!text) throw new Error("Nothing to copy");

  const command =
    process.platform === "darwin"
      ? ["pbcopy"]
      : process.platform === "win32"
        ? ["clip.exe"]
        : ["wl-copy"];

  try {
    const processHandle = Bun.spawn(command, {
      stdin: "pipe",
      stdout: "ignore",
      stderr: "ignore",
    });
    processHandle.stdin.write(text);
    await processHandle.stdin.end();
    if ((await processHandle.exited) === 0) return "system clipboard";
  } catch {
    // Fall through to OSC 52 for terminals without a native clipboard helper.
  }

  process.stdout.write(`\u001b]52;c;${Buffer.from(text).toString("base64")}\u0007`);
  return "terminal clipboard";
}
