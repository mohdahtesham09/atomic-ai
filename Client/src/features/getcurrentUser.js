import api from "../utils/axios";

/**
 * Fetches the currently authenticated user from the backend.
 * Handles all common backend response shapes:
 *  - { user: {...} }
 *  - { data: {...} }
 *  - direct user object
 * Returns null silently on 401 (not logged in).
 */
const getCurrentUser = async () => {
  try {
    const { data } = await api.get("/api/v1/me");
    return data?.user || data?.data || data;
  } catch (error) {
    if (error.response?.status === 401) {
      return null;
    }
    return null;
  }
};

export default getCurrentUser;