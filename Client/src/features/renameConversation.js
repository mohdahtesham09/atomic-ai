import api from "../utils/axios";

export const renameConversation = async (conversationId, title) => {
    try {
        const { data } = await api.patch(`/chat/update-conversation/${conversationId}`, { title });
        return data?.data || data;
    } catch (error) {
        console.log("Error renaming conversation:", error);
        return null;
    }
};
