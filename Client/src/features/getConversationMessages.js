import api from "../utils/axios";

export const getConversationMessages = async (conversationId) => {
    try {
        const { data } = await api.get(`/api/v1/chat/get-messages/${conversationId}`);
        return data?.data || data;
    } catch (error) {
        console.log("Error fetching conversation messages:", error);
        return [];
    }
};
