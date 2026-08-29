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

import { pbkdf2, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ITERATIONS = 100000;           // must match auth.js (Workers runtime ceiling)
const derive = promisify(pbkdf2);

const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const ETX = String.fromCharCode(3);    // Ctrl+C
const DEL = String.fromCharCode(127);
const BS = String.fromCharCode(8);

/* Read one line from stdin, echoing it or not.

   This deliberately does not use readline. readline in terminal mode redraws
   the current line itself, which wipes a prompt written beforehand, and its
   echo-muting has to be toggled around that internal draw — fiddly, and it
   behaved differently again when stdin was a pipe rather than a terminal.
   Reading stdin directly is longer but does exactly one thing, the same way
   every time. */
/* Anything typed past the end of one answer — the rest of a pasted block, or
   every line at once when stdin is a pipe — is held here for the next question
   instead of being thrown away with the listener. */
let pending = "";

function read(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const tty = Boolean(stdin.isTTY);
    process.stdout.write(question);

    let buffer = "";
    let settled = false;

    const finish = (rest) => {
      if (settled) return;
      settled = true;
      pending = rest;
      stdin.removeListener("data", onData);
      if (tty) stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write(NL);
      resolve(buffer);
    };

    // Returns leftover input if the line ended inside this text, else null.
    const consume = (text) => {
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === CR || ch === NL) {
          let rest = text.slice(i + 1);
          if (ch === CR && rest[0] === NL) rest = rest.slice(1);   // CRLF
          return rest;
        }
        if (ch === ETX) {
          process.stdout.write(NL);
          process.exit(130);
        }
        if (ch === DEL || ch === BS) {
          if (buffer.length) {
            buffer = buffer.slice(0, -1);
            if (tty && !hidden) process.stdout.write(BS + " " + BS);
          }
          continue;
        }
        buffer += ch;
        // Raw mode echoes nothing for us, so visible input is echoed here.
        if (tty && !hidden) process.stdout.write(ch);
      }
      return null;
    };

    // Left over from the previous answer, before touching stdin again.
    if (pending) {
      const carried = pending;
      pending = "";
      const rest = consume(carried);
      if (rest !== null) return finish(rest);
    }

    // A declaration, not a const: leftover input can complete the answer before
    // this point is reached, and finish() removes the listener by name.
    function onData(chunk) {
      const rest = consume(chunk);
      if (rest !== null) finish(rest);
    }

    if (tty) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", onData);
  });
}

const sqlQuote = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const main = async () => {
  const local = process.argv.includes("--local");

  console.log(NL + "Yeshua Royal Catering — admin account setup");
  console.log(local ? "Target: LOCAL development database" + NL : "Target: REMOTE (live) database" + NL);

  const email = (await read("Admin email: ")).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    console.error("That does not look like an email address.");
    process.exit(1);
  }

  const password = await read("Password (min 12 characters, hidden as you type): ", { hidden: true });
  if (password.length < 12) {
    console.error("Too short — use at least 12 characters. Nothing was changed.");
    process.exit(1);
  }

  const again = await read("Confirm password: ", { hidden: true });
  if (password !== again) {
    console.error("Those did not match. Nothing was changed — run the command again.");
    process.exit(1);
  }

  const salt = randomBytes(16);
  const hash = await derive(password, salt, ITERATIONS, 32, "sha256");
  const now = new Date().toISOString();

  // Upsert, so re-running simply changes the password for that email.
  const sql =
    "INSERT INTO admin_users (id, email, password_hash, password_salt, iterations, created_at) " +
    "VALUES (" + sqlQuote(crypto.randomUUID()) + ", " + sqlQuote(email) + ", " +
    sqlQuote(hash.toString("hex")) + ", " + sqlQuote(salt.toString("hex")) + ", " +
    ITERATIONS + ", " + sqlQuote(now) + ") " +
    "ON CONFLICT(email) DO UPDATE SET " +
    "password_hash = excluded.password_hash, password_salt = excluded.password_salt, " +
    "iterations = excluded.iterations;";

  console.log("Saving…");

  // Passed as a file rather than --command for two reasons: the Windows shell
  // splits a long SQL string into separate arguments, and command-line
  // arguments are visible to other processes in the process table. The file
  // holds only the hash, never the password, and is removed either way.
  const sqlPath = join(tmpdir(), "yrc-admin-" + randomBytes(6).toString("hex") + ".sql");
  writeFileSync(sqlPath, sql, { encoding: "utf8", mode: 0o600 });

  // npx is only reachable through a shell here, and shell mode does not escape
  // an argument array — that is what split the SQL into separate arguments. A
  // single pre-quoted command string avoids it. Nothing the user typed reaches
  // this line: only a generated temp path, and the SQL is inside the file.
  const command =
    "npx wrangler d1 execute yeshua-reviews " +
    (local ? "--local" : "--remote") +
    ' --file="' + sqlPath + '"';

  let run;
  try {
    run = spawnSync(command, { stdio: "inherit", shell: true });
  } finally {
    try { unlinkSync(sqlPath); } catch { /* already gone */ }
  }

  if (!run || run.status !== 0) {
    console.error(NL + "Could not write to the database. Is wrangler signed in, and have the migrations been applied?");
    process.exit((run && run.status) || 1);
  }

  console.log(NL + "Done. " + email + " can now sign in.");
  console.log("Sessions last 12 hours. Run this again at any time to change the password." + NL);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
