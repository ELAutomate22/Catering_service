/* =============================================================================
   Create or update an admin account.
   -----------------------------------------------------------------------------
       npm run admin:password
       npm run admin:password -- --local     (against the local dev database)

   The password is typed here on your machine, hashed here, and only the hash
   and its salt are sent to the database. The password itself is never written
   to a file, never committed, and never leaves this terminal.

   Run it again with the same email to change that admin's password.
   ========================================================================== */

import { createInterface } from "node:readline";
import { pbkdf2, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { spawnSync } from "node:child_process";
import { Writable } from "node:stream";

const ITERATIONS = 100000;           // must match auth.js (Workers runtime ceiling)
const derive = promisify(pbkdf2);

/* A writable that suppresses echo, so the password is not shown as it is typed. */
function ask(question, { silent = false } = {}) {
  const muted = new Writable({
    write(chunk, enc, cb) {
      if (!silent) process.stdout.write(chunk, enc);
      cb();
    },
  });
  const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
  return new Promise((resolve) => {
    process.stdout.write(question);
    rl.question("", (answer) => {
      rl.close();
      if (silent) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const sqlQuote = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const main = async () => {
  const local = process.argv.includes("--local");

  console.log("\nYeshua Royal Catering — admin account setup");
  console.log(local ? "Target: LOCAL development database\n" : "Target: REMOTE (live) database\n");

  const email = (await ask("Admin email: ")).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    console.error("\nThat does not look like an email address.");
    process.exit(1);
  }

  const password = await ask("Password (min 12 characters): ", { silent: true });
  if (password.length < 12) {
    console.error("\nToo short — use at least 12 characters.");
    process.exit(1);
  }
  const again = await ask("Confirm password: ", { silent: true });
  if (password !== again) {
    console.error("\nThose did not match.");
    process.exit(1);
  }

  const salt = randomBytes(16);
  const hash = await derive(password, salt, ITERATIONS, 32, "sha256");
  const now = new Date().toISOString();

  // Upsert, so re-running simply changes the password for that email.
  const sql =
    "INSERT INTO admin_users (id, email, password_hash, password_salt, iterations, created_at) " +
    `VALUES (${sqlQuote(crypto.randomUUID())}, ${sqlQuote(email)}, ${sqlQuote(hash.toString("hex"))}, ` +
    `${sqlQuote(salt.toString("hex"))}, ${ITERATIONS}, ${sqlQuote(now)}) ` +
    "ON CONFLICT(email) DO UPDATE SET " +
    "password_hash = excluded.password_hash, password_salt = excluded.password_salt, " +
    "iterations = excluded.iterations;";

  const args = ["wrangler", "d1", "execute", "yeshua-reviews", local ? "--local" : "--remote", "--command", sql];
  const run = spawnSync("npx", args, { stdio: "inherit", shell: process.platform === "win32" });

  if (run.status !== 0) {
    console.error("\nCould not write to the database. Is wrangler signed in, and have the migrations been applied?");
    process.exit(run.status || 1);
  }

  console.log(`\nDone. ${email} can now sign in.`);
  console.log("Sessions last 12 hours. Run this again at any time to change the password.\n");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
