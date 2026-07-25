import api from "../utils/axios";

let inFlightPromise = null;

export const getConversations = async () => {
  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const { data } = await api.get("/chat/get-conversations");
      return data?.data || data?.conversations || data;
    } catch (error) {
      if (import.meta.env.DEV) {
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