/**
 * Firebase Modular SDK Initialization (Singleton)
 * Connected to Firebase Project: dashboard-e6cea
 * Realtime Database: https://dashboard-e6cea-default-rtdb.firebaseio.com
 */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getDatabase, 
  ref, 
  set, 
  get, 
  update, 
  onValue, 
  push, 
  query, 
  orderByChild, 
  limitToLast 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

export const firebaseConfig = {
  apiKey: "AIzaSyA-q-ybqAiPyt1Sn5HQ1g6iuv4HmIgaeA0",
  authDomain: "dashboard-e6cea.firebaseapp.com",
  databaseURL: "https://bulb-12492-default-rtdb.firebaseio.com",
  projectId: "dashboard-e6cea",
  storageBucket: "dashboard-e6cea.firebasestorage.app",
  messagingSenderId: "874226898255",
  appId: "1:874226898255:web:92253634794c1db03d613a",
  measurementId: "G-0TPN6G2H52"
};

// Initialize Firebase only ONCE
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const database = getDatabase(app, firebaseConfig.databaseURL);

// Google Auth Provider setup
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account"
});

// Database Paths Specification
export const DB_PATHS = {
  BULB_STATE: "home/bulb/state",
  SENSORS: "home/sensors",
  ALT_SENSORS: "sensors",
  SYSTEM_MODE: "home/system/mode",
  SYSTEM_THRESHOLD: "home/system/ldrThreshold",
  LOGS: "home/logs"
};

export {
  app,
  ref,
  set,
  get,
  update,
  onValue,
  push,
  query,
  orderByChild,
  limitToLast,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
};
