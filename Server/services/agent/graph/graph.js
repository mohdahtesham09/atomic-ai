import {StateGraph} from "@langchain/langgraph"
import { agentState } from "./state.js"
import { chatAgent } from "../agents/chat.agent.js"
import { searchAgent } from "../agents/search.agent.js"
import { pdfAgent } from "../agents/pdf.agent.js"
import { pptAgent } from "../agents/ppt.agent.js"
import { codingAgent } from "../agents/coding.agent.js"
import { visionAgent } from "../agents/vision.agent.js"
import { pdfRag } from "../agents/pdfRag.agent.js"
import { imageAnalyzer } from "../agents/imageAnalyzer.agent.js"
import { router } from "./router.js"



const workflow = new StateGraph(agentState)

workflow.addNode("router", router)
workflow.addNode("chat", chatAgent)
workflow.addNode("search", searchAgent)
workflow.addNode("pdf", pdfAgent)
workflow.addNode("ppt", pptAgent)
workflow.addNode("coding", codingAgent)
workflow.addNode("vision", visionAgent)
workflow.addNode("pdfRag", pdfRag)
workflow.addNode("imageAnalyzer",imageAnalyzer)




//? Connect edegs

workflow.addEdge("__start__", "router")
workflow.addConditionalEdges("router", (state) => {
    console.log("AGENT AFTER ROUTER:", state.agent);

    switch (state.agent) {
        case "chat":
            return "chat";
        case "search":
            return "search";
        case "coding":
            return "coding";
        case "pdf":
            return "pdf";
        case "ppt":
            return "ppt";
        case "vision":
            return "vision";
        case "pdfRag":
            return "pdfRag";
        case "imageAnalyzer":
            return "imageAnalyzer";
        default:
            return "chat";
    }
}, {
    chat:"chat",
    search:"search",
    coding:"coding",
    ppt:"ppt",
    pdf:"pdf",
    vision:"vision",
    pdfRag: "pdfRag",
    imageAnalyzer: "imageAnalyzer",

})

workflow.addEdge("search", "chat")
workflow.addEdge("chat", "__end__")
workflow.addEdge("coding", "__end__")
workflow.addEdge("pdf", "__end__")
workflow.addEdge("ppt", "__end__")
workflow.addEdge("vision", "__end__")
workflow.addEdge("pdfRag", "__end__")
workflow.addEdge("imageAnalyzer", "__end__")


export default workflow.compile()