import { Annotation } from '@langchain/langgraph';

// Reducer: always replace with the incoming value; keep old value only if new is undefined.
const replace = (old, incoming) => (incoming !== undefined ? incoming : old);

export const agentState = Annotation.Root({
    prompt:            Annotation({ reducer: replace, default: () => "" }),
    aiResponse:        Annotation({ reducer: replace, default: () => "" }),
    agent:             Annotation({ reducer: replace, default: () => "chat" }),
    selectedAgent:     Annotation({ reducer: replace, default: () => "auto" }),
    conversationId:    Annotation({ reducer: replace, default: () => null }),
    userId:            Annotation({ reducer: replace, default: () => null }),
    conversationMemory:Annotation({ reducer: replace, default: () => "" }),
    userMemory:        Annotation({ reducer: replace, default: () => "" }),
    history:           Annotation({ reducer: replace, default: () => [] }),
    searchResult:      Annotation({ reducer: replace, default: () => null }),
    searchResults:     Annotation({ reducer: replace, default: () => [] }),
    sources:           Annotation({ reducer: replace, default: () => [] }),
    images:            Annotation({ reducer: replace, default: () => [] }),
    // artifacts reducer: new value always replaces old; defaults to empty array
    artifacts:         Annotation({ reducer: replace, default: () => [] }),
    artifactFile:      Annotation({ reducer: replace, default: () => null }),
    currencyPreference:Annotation({ reducer: replace, default: () => "INR" }),
    selectedModel:     Annotation({ reducer: replace, default: () => "flash" }),
    uploadedFiles:     Annotation({ reducer: replace, default: () => [] }),
    uploadedImages:    Annotation({ reducer: replace, default: () => [] }),
    userId: Annotation(),
    file: Annotation()
})



