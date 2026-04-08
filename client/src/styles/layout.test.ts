import { describe, expect, it } from "vitest";

import fs from "node:fs";
import path from "node:path";

const layoutCss = fs.readFileSync(
  path.resolve(import.meta.dirname, "./layout.css"),
  "utf8"
);

describe("layout css", () => {
  it("clips the entire app into a 24px rounded screen shape", () => {
    expect(layoutCss).toContain("#app {");
    expect(layoutCss).toContain("border-radius: 24px;");
    expect(layoutCss).toContain("overflow: hidden;");
    expect(layoutCss).toContain("position: relative;");
  });

  it("keeps the artwork at a fixed 360 by 360 while allowing the content column to shrink", () => {
    expect(layoutCss).toContain(".app-shell {\n  background: #000;");
    expect(layoutCss).toContain("position: relative;");
    expect(layoutCss).toContain("grid-template-columns: 360px minmax(0, 1fr);");
    expect(layoutCss).toContain("gap: 24px;");
    expect(layoutCss).not.toContain("padding-left: 28px;");
    expect(layoutCss).toContain(".artwork-panel");
    expect(layoutCss).toContain("background: #111;");
    expect(layoutCss).toContain("border-radius: 16px;");
    expect(layoutCss).toContain("height: 360px;");
    expect(layoutCss).toContain("overflow: hidden;");
    expect(layoutCss).toContain("width: 360px;");
  });

  it("allows the info panel and progress area to shrink within the device width", () => {
    expect(layoutCss).toContain(".info-panel");
    expect(layoutCss).toContain("justify-content: space-between;");
    expect(layoutCss).toContain("min-width: 0;");
    expect(layoutCss).toContain(".info-panel-footer {");
    expect(layoutCss).toContain(".info-panel-footer > * + * {");
    expect(layoutCss).toContain("margin-top: 8px;");
    expect(layoutCss).toContain(".progress-root");
    expect(layoutCss).toContain("width: 100%;");
  });

  it("defines an absolute spotify background layer under the shell content", () => {
    expect(layoutCss).toContain(".spotify-background");
    expect(layoutCss).toContain("position: absolute;");
    expect(layoutCss).toContain("inset: 0;");
    expect(layoutCss).toContain(".artwork-panel,");
    expect(layoutCss).toContain("z-index: 1;");
  });

  it("preserves the native hidden behavior for top-level app screens", () => {
    expect(layoutCss).toContain("#app > [hidden] {");
    expect(layoutCss).toContain("display: none !important;");
  });

  it("defines a full-screen settings page with its own scroll container", () => {
    expect(layoutCss).toContain(".settings-screen {");
    expect(layoutCss).toContain("display: flex;");
    expect(layoutCss).toContain("flex-direction: column;");
    expect(layoutCss).toContain(".settings-scroll {");
    expect(layoutCss).toContain("overflow-y: auto;");
  });
});
