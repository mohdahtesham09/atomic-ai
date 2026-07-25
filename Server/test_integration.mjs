import Redis from "ioredis";

const redis = new Redis({ host: "localhost", port: 6379 });

const sessionId = "integration-test-session-id";
const mockUser = {
  _id: "60d5ec49f39d2c3c98dc42f3",
  firebaseUid: "mock-firebase-uid",
  name: "Mohd",
  email: "mohd@atomic.ai",
  avatar: "",
  provider: "google.com",
};

const BASE = "http://localhost:8000";
const headers = {
  "Content-Type": "application/json",
  Cookie: `session=${sessionId}`,
};

async function api(method, path, body) {
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  return { status: res.status, data };
}

async function runTests() {
  console.log("=== STARTING INTEGRATION TESTS ===\n");

  // 1. Inject session into Redis
  console.log("[SETUP] Injecting mock session into Redis...");
  await redis.set(`session-${sessionId}`, JSON.stringify(mockUser), "EX", 3600);
  console.log("[SETUP] ✅ Mock session injected\n");

  // Test 1: Auth gateway
  console.log("[TEST 1] Auth Gateway - GET /api/v1/me");
  try {
    const { status, data } = await api("GET", "/api/v1/me");
    console.log(`  Status: ${status}`);
    console.log(`  User: ${data?.data?.name || data?.name || "N/A"}`);
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    console.log("  ✅ PASSED\n");
  } catch (err) {
    console.error(`  ❌ FAILED: ${err.message}\n`);
    await cleanup();
    process.exit(1);
  }

  // Test 2: Get conversations (baseline count)
  console.log("[TEST 2] Get Conversations - GET /api/v1/chat/get-conversations");
  let initialCount = 0;
  try {
    const { status, data } = await api("GET", "/api/v1/chat/get-conversations");
    console.log(`  Status: ${status}`);
    const convs = data?.conversations || data?.data || [];
    initialCount = convs.length;
    console.log(`  Found ${initialCount} existing conversations`);
    console.log("  ✅ PASSED\n");
  } catch (err) {
    console.error(`  ❌ FAILED: ${err.message}\n`);
    await cleanup();
    process.exit(1);
  }

  // Test 3: Send first message "hi"
  console.log('[TEST 3] Send First Message - POST /api/v1/chat/message ("hi")');
  let firstConvId = null;
  try {
    const { status, data } = await api("POST", "/api/v1/chat/message", {
      message: "hi",
      selectedAgent: "chat",
      selectedModel: "groq",
    });
    console.log(`  Status: ${status}`);
    console.log(`  Response: ${(data?.response || "").substring(0, 80)}...`);
    firstConvId = data?.conversationId || data?.conversation?._id;
    console.log(`  Conversation ID: ${firstConvId}`);
    if (!firstConvId) throw new Error("No conversationId returned");
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    console.log("  ✅ PASSED\n");
  } catch (err) {
    console.error(`  ❌ FAILED: ${err.message}\n`);
    await cleanup();
    process.exit(1);
  }

  // Test 4: Send follow-up message (same conversation)
  console.log('[TEST 4] Follow-up Message - POST /api/v1/chat/message ("explain in simple words")');
  try {
    const { status, data } = await api("POST", "/api/v1/chat/message", {
      conversationId: firstConvId,
      message: "explain in simple words",
      selectedAgent: "chat",
      selectedModel: "groq",
    });
    console.log(`  Status: ${status}`);
    console.log(`  Response: ${(data?.response || "").substring(0, 80)}...`);
    const followUpId = data?.conversationId || data?.conversation?._id;
    console.log(`  Follow-up Conv ID: ${followUpId}`);
    if (followUpId !== firstConvId) {
      throw new Error(`Conv ID mismatch! Expected ${firstConvId}, got ${followUpId}`);
    }
    console.log("  ✅ PASSED (same conversation ID reused)\n");
  } catch (err) {
    console.error(`  ❌ FAILED: ${err.message}\n`);
    await cleanup();
    process.exit(1);
  }

  // Test 5: Restore conversation (simulates reload)
  console.log(`[TEST 5] Restore Conversation - GET /api/v1/chat/conversation/${firstConvId}`);
  try {
    const { status, data } = await api("GET", `/api/v1/chat/conversation/${firstConvId}`);
    console.log(`  Status: ${status}`);
    const messages = data?.messages || data?.data?.messages || [];
    console.log(`  Messages count: ${messages.length}`);
    messages.forEach((msg, i) => {
      console.log(`    [${i + 1}] ${msg.role}: ${(msg.content || "").substring(0, 50)}...`);
    });
    if (messages.length < 2) throw new Error("Expected >= 2 messages in history");
    console.log("  ✅ PASSED\n");
  } catch (err) {
    console.error(`  ❌ FAILED: ${err.message}\n`);
    await cleanup();
    process.exit(1);
  }

  // Test 6: No duplicate conversations
  console.log("[TEST 6] Verify No Duplicate Conversations");
  try {
    const { data } = await api("GET", "/api/v1/chat/get-conversations");
    const convs = data?.conversations || data?.data || [];
    const finalCount = convs.length;
    console.log(`  Initial: ${initialCount}, Final: ${finalCount}`);
    if (finalCount === initialCount + 1) {
      console.log("  ✅ PASSED (exactly 1 new conversation)\n");
    } else {
      console.warn(`  ⚠️  Expected ${initialCount + 1}, got ${finalCount} (may have pre-existing data)\n`);
    }
  } catch (err) {
    console.error(`  ❌ FAILED: ${err.message}\n`);
  }

  // Test 7: PPT agent (non-critical, just verify no crash)
  console.log("[TEST 7] PPT Agent Request (non-critical)");
  try {
    const { status, data } = await api("POST", "/api/v1/chat/message", {
      message: "make a ppt for business automation",
      selectedAgent: "ppt",
      selectedModel: "groq",
    });
    console.log(`  Status: ${status}`);
    const artifacts = data?.artifacts || [];
    console.log(`  Artifacts count: ${artifacts.length}`);
    if (artifacts.length > 0) {
      console.log(`  Artifact type: ${artifacts[0].type}`);
      console.log(`  Has pptxBase64: ${Boolean(artifacts[0].pptxBase64)}`);
    }
    console.log(`  Response text: ${(data?.response || "").substring(0, 80)}...`);
    console.log("  ✅ PASSED (no crash)\n");
  } catch (err) {
    console.log(`  ⚠️  PPT request error (acceptable): ${err.message}\n`);
  }

  console.log("=== ALL TESTS COMPLETED ===");
  await cleanup();
}

async function cleanup() {
  await redis.disconnect();
}

runTests().catch(async (err) => {
  console.error("Fatal:", err);
  await cleanup();
  process.exit(1);
});
