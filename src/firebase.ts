import { initializeApp, getApps } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAH2hiXyrnxTDSa9vQJid8aFsryJk2jcHg",
  authDomain: "smartscanner-a5e0d.firebaseapp.com",
  projectId: "smartscanner-a5e0d",
  storageBucket: "smartscanner-a5e0d.firebasestorage.app",
  messagingSenderId: "976223541282",
  appId: "1:976223541282:web:a5dcfaeaaa99ac50f3127b"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    experimentalForceLongPolling: true 
  });
} catch (e) {
  dbInstance = getFirestore(app);
}

export const db = dbInstance;
export default app;
