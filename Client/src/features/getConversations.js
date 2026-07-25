import api from "../utils/axios";

let inFlightPromise = null;

export const getConversations = async () => {
  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const { data } = await api.get("/api/v1/chat/get-conversations");
      return data?.data || data?.conversations || data;
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error(
          "Error fetching conversations:",
          error.response?.data || error.message
        );
      }
      return [];
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
};