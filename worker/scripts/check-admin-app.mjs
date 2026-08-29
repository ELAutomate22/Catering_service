/* =============================================================================
   Syntax-check the admin app's own JavaScript.
   -----------------------------------------------------------------------------
       npm run check

   `node --check src/admin-app.js` only validates the module that returns the
   page. The app's JavaScript lives inside a template literal, so to Node it is
   just a string — a broken line in there passes every check and then renders a
   blank page in the browser with nothing but "Invalid or unexpected token" in
   the console. That happened, so this pulls the inline script out and parses it
   for real.
   ========================================================================== */

import { adminPage } from "../src/admin-app.js";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const html = adminPage();

const openTag = "<script>";
const closeTag = "</scr" + "ipt>";
const start = html.indexOf(openTag);
const end = html.lastIndexOf(closeTag);

if (start === -1 || end === -1) {
  console.error("Could not find the inline script in the admin page.");
  process.exit(1);
}

const js = html.slice(start + openTag.length, end);
const path = join(tmpdir(), "admin-app-" + randomBytes(6).toString("hex") + ".js");
writeFileSync(path, js, "utf8");

let run;
try {
  run = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
} finally {
  try { unlinkSync(path); } catch { /* already gone */ }
}

if (run.status !== 0) {
  console.error("Admin app JavaScript does not parse:\n");
  // Point at the inline script's own line numbers, not the temp file's path.
  console.error((run.stderr || "").split(path).join("admin-app inline script"));
  process.exit(1);
}

console.log("Admin app JavaScript parses cleanly (" + js.length + " chars).");
