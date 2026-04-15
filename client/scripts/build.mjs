import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import esbuild from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const distDir = path.join(clientRoot, "dist");
const assetsDir = path.join(distDir, "assets");

export function renderIndexHtml(jsPath, cssPath) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ThingOS</title>
    <link rel="stylesheet" href="./${cssPath}">
  </head>
  <body>
    <div id="app"></div>
    <script src="./${jsPath}"></script>
  </body>
</html>
`;
}

async function main() {
  await rm(distDir, { force: true, recursive: true });
  await mkdir(assetsDir, { recursive: true });

  await esbuild.build({
    bundle: true,
    entryPoints: [path.join(clientRoot, "src", "main.ts")],
    format: "iife",
    loader: {
      ".css": "css",
      ".woff2": "dataurl",
    },
    outfile: path.join(assetsDir, "app.js"),
    sourcemap: false,
    target: ["chrome69"],
  });

  await writeFile(path.join(distDir, "index.html"), renderIndexHtml("assets/app.js", "assets/app.css"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
