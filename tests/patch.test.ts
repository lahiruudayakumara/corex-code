import { afterEach, describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { applyPatchProposal, createPatchProposal } from "../src/edit/patch";
import { temporaryDirectory } from "./helpers";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => Promise.all(cleanups.splice(0).map((cleanup) => cleanup())));

describe("patch proposals", () => {
  test("previews and atomically applies an exact edit", async () => {
    const directory = await temporaryDirectory("corex-patch-");
    cleanups.push(directory.cleanup);
    await writeFile(join(directory.path, "value.ts"), "export const value = 1;\n");
    const proposal = await createPatchProposal(directory.path, {
      path: "value.ts",
      oldText: "value = 1",
      newText: "value = 2",
      explanation: "Update the value",
    });
    expect(proposal.diff).toContain("-export const value = 1;");
    expect(proposal.diff).toContain("+export const value = 2;");
    await applyPatchProposal(directory.path, proposal);
    expect(await readFile(join(directory.path, "value.ts"), "utf8")).toBe("export const value = 2;\n");
  });

  test("rejects ambiguous and stale edits", async () => {
    const directory = await temporaryDirectory("corex-patch-");
    cleanups.push(directory.cleanup);
    const path = join(directory.path, "value.ts");
    await writeFile(path, "same\nsame\n");
    expect(
      createPatchProposal(directory.path, {
        path: "value.ts",
        oldText: "same",
        newText: "changed",
        explanation: "Ambiguous",
      }),
    ).rejects.toThrow("ambiguous");

    await writeFile(path, "before\n");
    const proposal = await createPatchProposal(directory.path, {
      path: "value.ts",
      oldText: "before",
      newText: "after",
      explanation: "Change it",
    });
    await writeFile(path, "changed elsewhere\n");
    expect(applyPatchProposal(directory.path, proposal)).rejects.toThrow("changed after");
  });
});
