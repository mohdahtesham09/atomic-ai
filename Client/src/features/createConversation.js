import api from "../utils/axios";

export const createConversation = async () => {
    try {
        const { data } = await api.get("/chat/create-conversation");
        return data?.data || data;
    } catch (error) {
        console.log("Error creating conversation:", error);
        return null;
    }
};