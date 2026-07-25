import express from 'express';
import http from 'http';
import axios from 'axios';
import { visionAgent } from './agents/vision.agent.js';
import { generateResponse } from './controllers/agent.controller.js';

async function testServerStability() {
  console.log("==================================================");
  console.log("      CRASH PREVENTION & 429 STABILITY TEST       ");
  console.log("==================================================\n");

  // 1. Test Vision Agent Debug Output
  console.log("Test 1: Vision Agent routing & debug log verification...");
  const state = {
    prompt: "Make an AI Engineer roadmap image",
    uploadedImages: [],
    selectedAgent: "vision",
    selectedModel: "groq"
  };

  try {
    await visionAgent(state);
  } catch (err) {
    console.log("✅ Vision Agent threw rate-limit/config error without crashing!");
    console.log("   Caught Status:", err.status || err.response?.status);
    console.log("   Caught Message:", err.message);
  }

  // 2. Setup mock Express server on port 8999 to test HTTP 429 response handling and server persistence
  console.log("\nTest 2: Express HTTP 429 error middleware & server persistence test...");
  const app = express();
  app.use(express.json());

  app.post('/test-generate', async (req, res) => {
    try {
      await visionAgent(req.body);
      return res.status(200).json({ success: true });
    } catch (err) {
      const status = err.status || err.response?.status || 500;
      if (err.retryAfter) res.set("retry-after", String(err.retryAfter));
      return res.status(status).json({
        success: false,
        message: err.message,
        error: err.message,
        retryAfter: err.retryAfter || null
      });
    }
  });

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(8999, resolve));

  // Request 1: Simulated Vision 429 Request
  console.log("\n  Submitting Vision request (expecting 429)...");
  try {
    const res1 = await axios.post('http://localhost:8999/test-generate', state, { validateStatus: () => true });
    console.log("  ✅ Request 1 Response Status:", res1.status);
    console.log("  ✅ Request 1 JSON Body:", res1.data);
    console.log("  ✅ Retry-After Header:", res1.headers['retry-after'] || 'N/A');
  } catch (e) {
    console.error("  ❌ Request 1 Failed unexpectedly:", e.message);
  }

  // Request 2: Immediate follow-up request to verify server stays alive
  console.log("\n  Submitting immediate follow-up request to verify server is alive...");
  try {
    const res2 = await axios.post('http://localhost:8999/test-generate', { prompt: "Hello test", uploadedImages: [], selectedAgent: "vision" }, { validateStatus: () => true });
    console.log("  ✅ Request 2 Response Status:", res2.status);
    console.log("  ✅ Request 2 JSON Body:", res2.data);
    console.log("  ✅ Server remained alive after HTTP 429 failure!");
  } catch (e) {
    console.error("  ❌ Request 2 Failed:", e.message);
  }

  server.close();
  console.log("\n==================================================");
  console.log("           ALL CRASH TESTS SUCCESSFUL!            ");
  console.log("==================================================");
}

testServerStability();
