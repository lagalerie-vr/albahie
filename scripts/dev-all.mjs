// Runs the Next.js app AND the authoritative bidding server together, so live
// bidding works without remembering to start a second terminal.
//   npm run dev:all
import { spawn } from "node:child_process";

const procs = [
  { name: "web   ", cmd: "npm", args: ["run", "dev"], color: "\x1b[36m" },
  { name: "bids  ", cmd: "npm", args: ["run", "auction-server"], color: "\x1b[33m" },
];

const children = procs.map(({ name, cmd, args, color }) => {
  const child = spawn(cmd, args, { shell: true, stdio: ["inherit", "pipe", "pipe"] });
  const prefix = `${color}[${name}]\x1b[0m `;
  const pipe = (stream) =>
    stream.on("data", (d) =>
      process.stdout.write(
        d
          .toString()
          .split(/\r?\n/)
          .map((line) => (line ? prefix + line : line))
          .join("\n"),
      ),
    );
  pipe(child.stdout);
  pipe(child.stderr);
  child.on("exit", (code) => {
    console.log(`${prefix}exited (${code}) — shutting down`);
    shutdown();
  });
  return child;
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    try {
      c.kill();
    } catch {
      /* already gone */
    }
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
