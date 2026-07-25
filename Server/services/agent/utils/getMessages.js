import axios from "axios"

export const getMessages = async (conversationId) => {
    try {
        console.log("fetching messages for:", conversationId);
        const { data } = await axios.get(`${process.env.CHAT_SERVICE}/get-messages/${conversationId}`);
        const messages = data?.data || data?.messages || [];
        console.log("fetched messages length:", messages.length);
        return messages;
    } catch (error) {
        console.log("getMessage error:", error.message);
        return [];
    }
}