import redis from "../../../shared/redis/redis.js"
import { getMessages } from "../utils/getMessages.js"
import { UserMemory } from "../models/userMemory.model.js"

export const getMemory = async (conversationId)=> {
    if (!conversationId) return "";
    
    const key = `messages-${conversationId}`
    const cached = await redis.get(key)
    let messages = [];

    if(cached){
        messages = JSON.parse(cached)
    } else {
        const fetched = await getMessages(conversationId)
        if (fetched && Array.isArray(fetched)) {
            messages = fetched.map(m => ({ role: m.role, content: m.content }));
            await redis.set(key, JSON.stringify(messages), "EX", 24*60*60)
        }
    }

    if (!messages || messages.length === 0) return "";

    const formatted = messages.map(msg => {
        const prefix = msg.role === "user" ? "User" : "Assistant";
        return `${prefix}: ${msg.content}`;
    }).join("\n\n");

    console.log("formatted memory length:", formatted.length);
    return formatted;
}

export const addMessage = async(conversationId, role, content)=>{
    if (!conversationId) return;
    const key = `messages-${conversationId}`
    const rawMessages = await redis.get(key)
    const messages = rawMessages ? JSON.parse(rawMessages) : []
    
    messages.push({
        role, content
    })

    if(messages.length > 20){
        messages.shift()
    }

    await redis.set(key, JSON.stringify(messages), "EX", 24*60*60)
}

// ----------------- USER MEMORY LOGIC -----------------

export const getUserMemory = async (userId) => {
    if (!userId) return "";
    try {
        const userMem = await UserMemory.findOne({ userId }).maxTimeMS(3000);
        if (!userMem || !userMem.memories || userMem.memories.length === 0) return "";
        
        return userMem.memories.map(m => `${m.key}: ${m.value}`).join("\n");
    } catch (error) {
        console.error("Error fetching user memory:", error.message);
        return "";
    }
};

export const saveUserMemory = async (userId, key, value, category = "general") => {
    if (!userId) return;
    try {
        let userMem = await UserMemory.findOne({ userId });
        if (!userMem) {
            userMem = new UserMemory({ userId, memories: [] });
        }

        const existingIndex = userMem.memories.findIndex(m => m.key === key);
        if (existingIndex > -1) {
            userMem.memories[existingIndex].value = value;
            userMem.memories[existingIndex].updatedAt = new Date();
        } else {
            userMem.memories.push({ key, value, category });
        }

        await userMem.save();
    } catch (error) {
        console.error("Error saving user memory:", error);
    }
};

export const processUserMemory = async (userId, prompt) => {
    if (!userId || !prompt) return;
    
    const lowerPrompt = prompt.toLowerCase();
    
    // Simple rule-based extraction based on user requirements
    const nameMatch = lowerPrompt.match(/(?:my name is|i am)\s+([a-zA-Z\s]+)/);
    if (nameMatch && nameMatch[1]) {
        await saveUserMemory(userId, "name", nameMatch[1].trim(), "identity");
    }
    
    const fullNameMatch = lowerPrompt.match(/my full name is\s+([a-zA-Z\s]+)/);
    if (fullNameMatch && fullNameMatch[1]) {
        await saveUserMemory(userId, "fullName", fullNameMatch[1].trim(), "identity");
    }

    const callMeMatch = lowerPrompt.match(/(?:call me|from now on call me)\s+([a-zA-Z\s]+)/);
    if (callMeMatch && callMeMatch[1]) {
        await saveUserMemory(userId, "preferredName", callMeMatch[1].trim(), "identity");
    }
};