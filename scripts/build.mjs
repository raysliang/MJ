import { readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const buildVersion = `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;
const cacheKey = buildVersion.replace(/[^0-9]/g, "");

await build({
  bundle: true,
  define: {
    __BUILD_VERSION__: JSON.stringify(buildVersion)
  },
  entryPoints: ["src/main.js"],
  format: "iife",
  outfile: "dist/mj.js"
});

const indexPath = "index.html";
const indexHtml = readFileSync(indexPath, "utf8");
const updatedIndexHtml = indexHtml.replace(
  /\.\/dist\/mj\.js\?v=[^"']+/,
  `./dist/mj.js?v=${cacheKey}`
);
if (updatedIndexHtml !== indexHtml) {
  writeFileSync(indexPath, updatedIndexHtml);
}

console.log(`Built dist/mj.js (${buildVersion})`);