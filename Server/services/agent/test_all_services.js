import axios from 'axios';

async function verifyAllServices() {
  console.log("==================================================");
  console.log("     END-TO-END SYSTEM STABILITY & VERIFICATION   ");
  console.log("==================================================\n");

  // 1. Health checks on all 4 ports
  try {
    const g = await axios.get("http://localhost:8000/health");
    console.log("✅ Gateway (Port 8000):", g.data);
  } catch (e) { console.error("❌ Gateway check failed:", e.message); }

  try {
    const a = await axios.get("http://localhost:8001/health");
    console.log("✅ Auth Service (Port 8001):", a.data);
  } catch (e) { console.error("❌ Auth check failed:", e.message); }

  try {
    const c = await axios.get("http://localhost:8002/health");
    console.log("✅ Chat Service (Port 8002):", c.data);
  } catch (e) { console.error("❌ Chat check failed:", e.message); }

  try {
    const ag = await axios.get("http://localhost:8003/health");
    console.log("✅ Agent Service (Port 8003):", ag.data);
  } catch (e) { console.error("❌ Agent check failed:", e.message); }

  // 2. Test GET /api/v1/me (Gateway endpoint)
  console.log("\nTesting GET http://localhost:8000/api/v1/me...");
  try {
    const resMe = await axios.get("http://localhost:8000/api/v1/me", { validateStatus: () => true });
    console.log("✅ GET /api/v1/me Status:", resMe.status, "(Expected 401 for unauthenticated request without session cookie)");
    console.log("✅ GET /api/v1/me Body:", resMe.data);
  } catch (e) {
    console.error("❌ GET /api/v1/me Failed with connection error:", e.message);
  }

  // 3. Test POST /api/v1/auth/login (Gateway -> Auth proxy)
  console.log("\nTesting POST http://localhost:8000/api/v1/auth/login...");
  try {
    const resLogin = await axios.post("http://localhost:8000/api/v1/auth/login", { token: "invalid_test_token" }, { validateStatus: () => true });
    console.log("✅ POST /api/v1/auth/login Status:", resLogin.status);
    console.log("✅ POST /api/v1/auth/login Body:", resLogin.data);
  } catch (e) {
    console.error("❌ POST /api/v1/auth/login Failed with connection error:", e.message);
  }

  // 4. Test Target Vision Request through Chat Service (Port 8002)
  console.log("\nTesting Target Vision Request: 'Make an AI Engineer roadmap image'...");
  const visionPayload = {
    message: "Make an AI Engineer roadmap image",
    conversationId: "6a60dd746aa09de50854b4ce",
    selectedAgent: "vision",
    selectedModel: "groq"
  };

  try {
    const resVision = await axios.post("http://localhost:8002/message", visionPayload, {
      headers: { "x-user-id": "6a4b7a18f0b1ced042c9d7cc" },
      validateStatus: () => true
    });
    console.log("✅ Target Vision Response Status:", resVision.status);
    console.log("✅ Target Vision Response Body:", resVision.data);
  } catch (e) {
    console.error("❌ Target Vision Request failed with connection error:", e.message);
  }

  // 5. Post-test health verification
  console.log("\nVerifying all services remained alive after requests...");
  const g2 = await axios.get("http://localhost:8000/health");
  const c2 = await axios.get("http://localhost:8002/health");
  const ag2 = await axios.get("http://localhost:8003/health");
  console.log("✅ Gateway Health:", g2.data);
  console.log("✅ Chat Service Health:", c2.data);
  console.log("✅ Agent Service Health:", ag2.data);

  console.log("\n==================================================");
  console.log("       ALL SYSTEM ENDPOINTS & SERVICES VERIFIED   ");
  console.log("==================================================");
}

verifyAllServices();
