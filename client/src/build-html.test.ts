import { describe, expect, it } from "vitest";

import { renderIndexHtml } from "../scripts/build.mjs";

describe("production html", function () {
  it("references relative non-module assets for file deployments", function () {
    var html = renderIndexHtml("assets/app.js", "assets/app.css");

    expect(html).toContain('<script src="./assets/app.js"></script>');
    expect(html).toContain('<link rel="stylesheet" href="./assets/app.css">');
    expect(html).not.toContain('type="module"');
    expect(html).not.toContain('src="/assets/');
  });
});
