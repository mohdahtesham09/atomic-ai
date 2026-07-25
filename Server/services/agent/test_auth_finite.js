import { spawn } from "child_process";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../..");

async function testAuthGateway() {
  console.log("==================================================");
  console.log("    FINITE GATEWAY & AUTH ENDPOINT VERIFICATION   ");
  console.log("==================================================\n");

  const children = [];

  const startService = (name, cwd) => {
    const child = spawn("node", ["index.js"], { cwd, stdio: "ignore" });
    children.push(child);
    console.log(`[AuthTest] Started temporary ${name} (PID: ${child.pid})...`);
    return child;
  };

  try {
    startService("Auth Service (8001)", path.join(rootDir, "Server/services/auth"));
    startService("Gateway Service (8000)", path.join(rootDir, "Server/gateway"));

    console.log("[AuthTest] Waiting 3 seconds for services to initialize...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Health Checks
    console.log("\n1. Health Check (Port 8000 Gateway):");
    const gHealth = await axios.get("http://localhost:8000/health", { validateStatus: () => true });
    console.log("   Status:", gHealth.status, gHealth.data);

    console.log("\n2. GET /api/v1/me Endpoint Check (Port 8000):");
    const resMe = await axios.get("http://localhost:8000/api/v1/me", { validateStatus: () => true });
    console.log("   Status:", resMe.status);
    console.log("   Body:  ", resMe.data);

    console.log("\n3. POST /api/v1/auth/login Endpoint Check (Port 8000 -> 8001 proxy):");
    const resLogin = await axios.post("http://localhost:8000/api/v1/auth/login", {}, { validateStatus: () => true });
    console.log("   Status:", resLogin.status);
    console.log("   Body:  ", resLogin.data);

  } catch (err) {
    console.error("[AuthTest Error]:", err.message);
  } finally {
    console.log("\n[AuthTest] Terminating all temporary child processes...");
    for (const child of children) {
      try {
        child.kill("SIGKILL");
      } catch (_) {}
    }
    console.log("[AuthTest] Cleanup complete.");
  }
}

testAuthGateway();
