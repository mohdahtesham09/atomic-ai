import api from "../utils/axios";

export const createConversation = async () => {
    try {
        const { data } = await api.get("/api/v1/chat/create-conversation");
        return data?.data || data;
    } catch (error) {
        console.log("Error creating conversation:", error);
        return null;
    }
};