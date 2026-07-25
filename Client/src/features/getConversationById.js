import api from "../utils/axios";

export const getConversationById = async (conversationId) => {
  try {
    const { data } = await api.get(`/api/v1/chat/conversation/${conversationId}`);
    return data;
  } catch (error) {
    console.error("Error fetching conversation by ID:", error);
    throw error;
  }
};
