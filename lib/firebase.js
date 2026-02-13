import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyAfL2KBnTUGDYlW0UXYmLIEzzI5B02ERlI",
    authDomain: "unspoken-thoughts-510e4.firebaseapp.com",
    projectId: "unspoken-thoughts-510e4",
    storageBucket: "unspoken-thoughts-510e4.firebasestorage.app",
    messagingSenderId: "327991676114",
    appId: "1:327991676114:web:42cadfb9f180cc798ef10b",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();