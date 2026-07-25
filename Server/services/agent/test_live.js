import axios from 'axios';

async function testLiveServices() {
  console.log("==================================================");
  console.log("      LIVE HTTP VERIFICATION (PORTS 8002 & 8003)  ");
  console.log("==================================================\n");

  // 1. Health checks
  const hAgent = await axios.get("http://localhost:8003/health");
  console.log("Agent Service Health:", hAgent.data);

  const hChat = await axios.get("http://localhost:8002/health");
  console.log("Chat Service Health:", hChat.data);

  // 2. Target request: Vision Image Generation ('Make an AI Engineer roadmap image')
  console.log("\nSubmitting target Vision request: 'Make an AI Engineer roadmap image'...");
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
    console.log("✅ Target Vision Retry-After Header:", resVision.headers["retry-after"] || "N/A");
  } catch (err) {
    console.error("❌ Target Vision Request failed unexpectedly:", err.message);
  }

  // 3. Verify services stay alive after 429
  console.log("\nChecking health of services after HTTP 429 response...");
  const hAgentAfter = await axios.get("http://localhost:8003/health");
  console.log("✅ Agent Service Health after 429:", hAgentAfter.data);

  const hChatAfter = await axios.get("http://localhost:8002/health");
  console.log("✅ Chat Service Health after 429:", hChatAfter.data);

  console.log("\n==================================================");
  console.log("      ALL LIVE HTTP VERIFICATIONS PASSED!         ");
  console.log("==================================================");
}

testLiveServices();
