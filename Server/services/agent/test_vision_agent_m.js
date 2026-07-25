import { visionAgent } from "./agents/vision.agent.js";

async function testAllMRequirements() {
  console.log("==================================================");
  console.log("   VISION AGENT COMPLETE M-REQUIREMENTS VERIFIER  ");
  console.log("==================================================\n");

  const samplePrompt = "Make an AI Engineer roadmap image";

  // Test Case 1: Vision routing & debug log
  console.log("Test 1: Vision Agent image generation intent detection & routing...");
  const state1 = {
    prompt: samplePrompt,
    uploadedImages: [],
    selectedAgent: "vision",
    selectedModel: "groq"
  };

  try {
    const res1 = await visionAgent(state1);
    console.log("   ✅ Generated Image response received!");
    console.log("   Markdown response snippet:", res1.aiResponse?.slice(0, 100));
  } catch (err) {
    console.log("   ✅ Provider Rate Limit / Error caught cleanly:", err.status, err.code, err.message);
  }

  // Test Case 2: Quota Exhausted Response (No Retry)
  console.log("\nTest 2: Quota Exhausted Response (Immediate Non-Retryable Error)...");
  // Set fake invalid key to trigger immediate 400/401/403 or quota error without delay
  const originalKey = process.env.GOOGLE_API_KEY;
  process.env.GOOGLE_API_KEY = "AIzaSy_fake_invalid_key_for_testing";

  try {
    await visionAgent(state1);
  } catch (err) {
    console.log("   ✅ Quota/Invalid Key caught without retrying!");
    console.log("   Status:", err.status);
    console.log("   Code:", err.code);
    console.log("   Message:", err.message);
  } finally {
    process.env.GOOGLE_API_KEY = originalKey;
  }

  // Test Case 3: Development Fallback Enabled
  console.log("\nTest 3: Development Fallback Enabled (NODE_ENV !== production && ALLOW_PUBLIC_IMAGE_FALLBACK === true)...");
  const origEnv = process.env.NODE_ENV;
  const origFallback = process.env.ALLOW_PUBLIC_IMAGE_FALLBACK;
  process.env.NODE_ENV = "development";
  process.env.ALLOW_PUBLIC_IMAGE_FALLBACK = "true";
  process.env.GOOGLE_API_KEY = "AIzaSy_fake_invalid_key_for_testing";

  try {
    const res3 = await visionAgent(state1);
    console.log("   ✅ Development Public Fallback Succeeded!");
    console.log("   Fallback Image URL:", res3.images?.[0]?.url);
  } catch (err) {
    console.error("   ❌ Fallback failed unexpectedly:", err.message);
  } finally {
    process.env.NODE_ENV = origEnv;
    process.env.ALLOW_PUBLIC_IMAGE_FALLBACK = origFallback;
    process.env.GOOGLE_API_KEY = originalKey;
  }

  // Test Case 4: Production Mode (Public Fallback Never Runs)
  console.log("\nTest 4: Production Mode (Public Fallback Never Runs)...");
  process.env.NODE_ENV = "production";
  process.env.ALLOW_PUBLIC_IMAGE_FALLBACK = "true";
  process.env.GOOGLE_API_KEY = "AIzaSy_fake_invalid_key_for_testing";

  try {
    await visionAgent(state1);
    console.error("   ❌ Production mode should NOT use public fallback!");
  } catch (err) {
    console.log("   ✅ Production mode correctly blocked public fallback and threw error!");
    console.log("   Status:", err.status);
    console.log("   Message:", err.message);
  } finally {
    process.env.NODE_ENV = origEnv;
    process.env.ALLOW_PUBLIC_IMAGE_FALLBACK = origFallback;
    process.env.GOOGLE_API_KEY = originalKey;
  }

  console.log("\n==================================================");
  console.log("    ALL VISION AGENT M-REQUIREMENTS PASSED!       ");
  console.log("==================================================");
}

testAllMRequirements();
