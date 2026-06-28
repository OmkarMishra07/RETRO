import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Starting Music2D Combined Dev Environment...");

// Start Express Backend
const backend = spawn("npx", ["tsx", "watch", "server.ts"], {
  stdio: "inherit",
  shell: true,
  cwd: __dirname
});

// Start Vite Frontend
const frontend = spawn("npx", ["vite", "--port=3000", "--host=0.0.0.0"], {
  stdio: "inherit",
  shell: true,
  cwd: __dirname
});

// Handle termination signals
process.on("SIGINT", () => {
  console.log("\nStopping processes...");
  backend.kill();
  frontend.kill();
  process.exit();
});

process.on("SIGTERM", () => {
  backend.kill();
  frontend.kill();
  process.exit();
});
