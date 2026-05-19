import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENDPOINT = "http://localhost:1934";
const META_PATH = join(__dirname, ".ov-test-meta.json");

function dockerAvailable(): boolean {
  try {
    execSync("docker compose version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function checkHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${ENDPOINT}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(maxWaitMs = 120_000): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    if (await checkHealthy()) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("OV test server failed to become healthy within 120s");
}

export default async function setup() {
  if (process.env.OPENVIKING_TEST_ENDPOINT) {
    writeFileSync(
      META_PATH,
      JSON.stringify({ endpoint: process.env.OPENVIKING_TEST_ENDPOINT, managed: false }),
    );
    return;
  }

  if (!dockerAvailable()) {
    writeFileSync(
      META_PATH,
      JSON.stringify({ endpoint: null, managed: false, reason: "docker not available" }),
    );
    return;
  }

  // Check if server is already up — skip restart
  if (await checkHealthy()) {
    writeFileSync(META_PATH, JSON.stringify({ endpoint: ENDPOINT, managed: false }));
    console.log(`[ov-test] server already healthy at ${ENDPOINT} — reusing`);
    return;
  }

  const dataDir = join(__dirname, "..", ".ov-test-data", "data");
  try { execSync(`rm -rf "${dataDir}"`, { stdio: "ignore" }); } catch { /* may need sudo */ }
  try { execSync(`sudo rm -rf "${dataDir}"`, { stdio: "ignore" }); } catch { /* ignore */ }
  mkdirSync(dataDir, { recursive: true });

  const composeFile = join(__dirname, "..", "docker-compose.test.yml");
  execSync(`docker compose -f "${composeFile}" down -v`, { stdio: "ignore" });
  execSync(`docker compose -f "${composeFile}" up -d`, { stdio: "inherit" });

  try {
    await waitForHealth();
    writeFileSync(META_PATH, JSON.stringify({ endpoint: ENDPOINT, managed: true }));
  } catch (err) {
    try {
      execSync(`docker compose -f "${composeFile}" logs --tail 50`, { stdio: "inherit" });
    } catch { /* ignore */ }
    throw err;
  }
}

export async function teardown() {
  if (process.env.OPENVIKING_TEST_ENDPOINT) return;

  let managed = false;
  try {
    const meta = JSON.parse(readFileSync(META_PATH, "utf-8")) as { managed?: boolean };
    managed = meta.managed ?? false;
  } catch { /* ignore */ }

  if (!managed) return;

  const composeFile = join(__dirname, "..", "docker-compose.test.yml");
  try {
    execSync(`docker compose -f "${composeFile}" down -v`, { stdio: "ignore" });
  } catch { /* ignore */ }
}
