// Writes the current build id into the service worker so a new deploy
// invalidates the old cache. Run after tsc.
import { readFileSync, writeFileSync } from "node:fs";

const sw = "public/sw.js";
const src = readFileSync(sw, "utf8");
const id = process.env.GITHUB_SHA?.slice(0, 7) ?? Date.now().toString(36);
writeFileSync(sw, src.replace(/const BUILD = "[^"]*";/, `const BUILD = "${id}";`));
console.log(`service worker stamped with build ${id}`);
