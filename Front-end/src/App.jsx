import React, { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../utils/firebase";
import api from "../utils/axios";

const App = () => {
  const [loading, setLoading] = useState(false);

  const handleLogin = async (firebaseToken) => {
    try {
      if (!firebaseToken) {
        console.log("Firebase token not found");
        return;
      }

      const { data } = await api.post("/auth/login", {
        token: firebaseToken,
      });

      console.log("Backend response:", data);
    } catch (error) {
      console.log(
        "Backend login error:",
        error.response?.data || error.message,
      );
    }
  };

  const googleLogin = async () => {
    try {
      setLoading(true);

      const result = await signInWithPopup(auth, googleProvider);

      const firebaseToken = await result.user.getIdToken();

      console.log("Firebase token:", firebaseToken);

      await handleLogin(firebaseToken);

      console.log("Firebase user:", result.user);
    } catch (error) {
      console.log("Google login error:", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='w-screen min-h-screen bg-gray-100 py-8'>
      <button
        className='m-5 px-6 py-3 bg-gray-200 rounded-full font-bold disabled:opacity-50'
        onClick={googleLogin}
        disabled={loading}
      >
        {loading ? "Logging in..." : "Continue with Google"}
      </button>
    </div>
  );
};

export default App;
