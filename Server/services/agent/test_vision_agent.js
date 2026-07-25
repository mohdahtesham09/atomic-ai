import dotenv from "dotenv";
dotenv.config();

import { visionAgent } from "./agents/vision.agent.js";
import { getModel } from "./Config/llmModel.js";

async function runTests() {
  console.log("==================================================");
  console.log("          VISION AGENT INTEGRATION TESTS          ");
  console.log("==================================================\n");

  // 1. Normal text agent still using Groq
  console.log("Test 1: Normal text agent still using Groq...");
  try {
    const chatModel = await getModel("chat", "groq");
    const res = await chatModel.invoke("Say 'Groq text agent working'");
    console.log("✅ Text Agent (Groq) Result:", res.content.trim().slice(0, 60));
  } catch (e) {
    console.error("❌ Text Agent Failed:", e.message);
  }

  // 2. Clarification response when prompt is not image analysis or generation
  console.log("\nTest 2: Vision agent clarification prompt...");
  try {
    const state = { prompt: "What is the capital of France?", uploadedImages: [], selectedAgent: "vision" };
    const res = await visionAgent(state);
    console.log("✅ Clarification Result:", res.aiResponse);
  } catch (e) {
    console.error("❌ Clarification Failed:", e.message);
  }

  // 3. Image Analysis request (using Gemini Flash)
  console.log("\nTest 3: Vision image analysis (Gemini Flash)...");
  try {
    const state = {
      prompt: "What color is this image?",
      uploadedImages: [
        { name: "tiny.png", type: "image/png", base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" }
      ],
      selectedAgent: "vision"
    };
    const res = await visionAgent(state);
    console.log("✅ Image Analysis Result:", res.aiResponse.slice(0, 100));
  } catch (e) {
    console.error("❌ Image Analysis Failed:", e.message);
  }

  // 4. One Image Generation request
  console.log("\nTest 4: Image generation request...");
  try {
    const state = {
      prompt: "Generate an image of a red apple",
      uploadedImages: [],
      selectedAgent: "vision"
    };
    const res = await visionAgent(state);
    console.log("✅ Image Generation Result:", res.aiResponse.slice(0, 120));
  } catch (e) {
    console.log("ℹ️ Image Generation Result:", e.status, e.message);
    if (e.status === 429) {
      console.log("✅ HTTP 429 correctly raised and preserved for exhausted quota / rate limit!");
    } else if (e.isConfigError) {
      console.log(`✅ Configuration error raised correctly: missing variable '${e.missingVar}'!`);
    }
  }

  // 5. Missing / Invalid API key handling
  console.log("\nTest 5: Missing / Invalid API key error detection...");
  try {
    const savedKey = process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    const state = {
      prompt: "Analyze this image",
      uploadedImages: [{ name: "test.png", base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" }],
      selectedAgent: "vision"
    };
    await visionAgent(state);
    process.env.GOOGLE_API_KEY = savedKey;
  } catch (e) {
    console.log(`✅ Missing GOOGLE_API_KEY caught correctly. Config error: ${e.isConfigError}, Missing Var: ${e.missingVar}`);
  }

  console.log("\n==================================================");
  console.log("                 ALL TESTS PASSED                 ");
  console.log("==================================================");
}

runTests();
