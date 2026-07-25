import api from "../utils/axios";

export const logoutUser = async () => {
  try {
    const { data } = await api.post("/api/v1/auth/logout");
    return data;
  } catch (error) {
    console.log("Logout error:", error.response?.data || error.message);
    return null;
  }
};
