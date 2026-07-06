// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth"
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "atomicai-4c0c3.firebaseapp.com",
  projectId: "atomicai-4c0c3",
  storageBucket: "atomicai-4c0c3.firebasestorage.app",
  messagingSenderId: "123869898709",
  appId: "1:123869898709:web:549a14b8174b8407a4ff5c",
  measurementId: "G-VNTKWJLVF0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()