import api from "../utils/axios";

export const deleteConversation = async (conversationId) => {
    try {
        const { data } = await api.delete(`/api/v1/chat/delete-conversation/${conversationId}`);
        return data?.data || data;
    } catch (error) {
        console.log("Error deleting conversation:", error);
        return null;
    }
};
