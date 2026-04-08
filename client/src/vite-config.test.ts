import { describe, expect, it } from "vitest";
import config from "../vite.config";

describe("vite config", function () {
  it("uses a relative base path for file:// deployments", function () {
    expect(config.base).toBe("./");
  });
});
