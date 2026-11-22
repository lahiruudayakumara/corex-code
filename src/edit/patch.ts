import { chmod, readFile, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, relative } from "node:path";
import { createTwoFilesPatch } from "diff";
import { CorexError } from "../errors";
import { resolveRepositoryFile } from "../safety/paths";

export type PatchProposal = {
  path: string;
  explanation: string;
  beforeHash: string;
  before: string;
  after: string;
  diff: string;
};

function hash(content: string): string {
  return new Bun.CryptoHasher("sha256").update(content).digest("hex");
}

export async function createPatchProposal(
  root: string,
  input: { path: string; oldText: string; newText: string; explanation: string },
): Promise<PatchProposal> {
  if (!input.oldText) throw new CorexError("oldText must be a non-empty exact excerpt");
  if (input.oldText === input.newText) throw new CorexError("The proposed edit does not change the file");
  const resolved = await resolveRepositoryFile(root, input.path);
  const before = await readFile(resolved, "utf8");
  const first = before.indexOf(input.oldText);
  if (first < 0) throw new CorexError("oldText does not match the current file");
  if (before.indexOf(input.oldText, first + input.oldText.length) >= 0) {
    throw new CorexError("oldText is ambiguous; provide a larger unique excerpt");
  }
  const after = before.slice(0, first) + input.newText + before.slice(first + input.oldText.length);
  const path = relative(await realpath(root), resolved);
  return {
    path,
    explanation: input.explanation,
    beforeHash: hash(before),
    before,
    after,
    diff: createTwoFilesPatch(`a/${path}`, `b/${path}`, before, after, "before", "after", { context: 3 }),
  };
}

export async function applyPatchProposal(root: string, proposal: PatchProposal): Promise<void> {
  const resolved = await resolveRepositoryFile(root, proposal.path);
  const current = await readFile(resolved, "utf8");
  if (hash(current) !== proposal.beforeHash) {
    throw new CorexError("The file changed after the patch was proposed; regenerate the patch");
  }

  const mode = (await stat(resolved)).mode;
  const temporary = `${dirname(resolved)}/.${basename(resolved)}.corex-${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary, proposal.after, { encoding: "utf8", mode });
    await chmod(temporary, mode);
    await rename(temporary, resolved);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}
