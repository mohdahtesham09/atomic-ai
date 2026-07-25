import { spawn } from "child_process";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../..");

async function runFiniteTest() {
  console.log("==================================================");
  console.log("    FINITE TEMPORARY ENDPOINT & SERVICE TEST      ");
  console.log("==================================================\n");

  const children = [];

  const startService = (name, cwd) => {
    const child = spawn("node", ["index.js"], { cwd, stdio: "ignore" });
    children.push(child);
    console.log(`[FiniteTest] Started temporary ${name} (PID: ${child.pid})...`);
    return child;
  };

  try {
    startService("Auth (8001)", path.join(rootDir, "Server/services/auth"));
    startService("Chat (8002)", path.join(rootDir, "Server/services/chat"));
    startService("Agent (8003)", path.join(rootDir, "Server/services/agent"));
    startService("Gateway (8000)", path.join(rootDir, "Server/gateway"));

    console.log("[FiniteTest] Waiting 3 seconds for services to initialize...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Health Checks
    console.log("\n1. Testing Health Endpoints...");
    const gHealth = await axios.get("http://localhost:8000/health", { validateStatus: () => true });
    console.log("   Gateway (8000):", gHealth.status, gHealth.data);

    const aHealth = await axios.get("http://localhost:8001/health", { validateStatus: () => true });
    console.log("   Auth (8001):   ", aHealth.status, aHealth.data);

    const cHealth = await axios.get("http://localhost:8002/health", { validateStatus: () => true });
    console.log("   Chat (8002):   ", cHealth.status, cHealth.data);

    const agHealth = await axios.get("http://localhost:8003/health", { validateStatus: () => true });
    console.log("   Agent (8003):  ", agHealth.status, agHealth.data);

    // Endpoints Test
    console.log("\n2. Testing Gateway Endpoints...");
    const resMe = await axios.get("http://localhost:8000/api/v1/me", { validateStatus: () => true });
    console.log("   GET /api/v1/me Status:", resMe.status, resMe.data);

    const resLogin = await axios.post("http://localhost:8000/api/v1/auth/login", { token: "test" }, { validateStatus: () => true });
    console.log("   POST /api/v1/auth/login Status:", resLogin.status);

    // Vision Generation Test
    console.log("\n3. Testing Vision Image Generation Request...");
    const visionPayload = {
      message: "Make an AI Engineer roadmap image",
      conversationId: "6a60dd746aa09de50854b4ce",
      selectedAgent: "vision",
      selectedModel: "groq"
    };

    const resVision = await axios.post("http://localhost:8002/message", visionPayload, {
      headers: { "x-user-id": "6a4b7a18f0b1ced042c9d7cc" },
      validateStatus: () => true
    });

    console.log("   Vision Response Status:", resVision.status);
    console.log("   Vision Response Body:  ", resVision.data);

  } catch (error) {
    console.error("[FiniteTest Error]:", error.message);
  } finally {
    console.log("\n[FiniteTest] Terminating all temporary service child processes...");
    for (const child of children) {
      try {
        child.kill("SIGKILL");
      } catch (_) {}
    }
    console.log("[FiniteTest] All temporary child processes cleaned up.");
  }
}

runFiniteTest();
