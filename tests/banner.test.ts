import { describe, expect, test } from "bun:test";
import { COREX_CODE_BANNER, renderBanner } from "../src/ui/banner";

describe("CLI banner", () => {
  test("renders the Corex Code wordmark and version", () => {
    expect(COREX_CODE_BANNER).toStartWith("  ____ ___");
    expect(renderBanner("0.1.0")).toEndWith("Local-first coding agent · v0.1.0");
    expect(renderBanner("0.1.0").split("\n")).toHaveLength(7);
  });
});
