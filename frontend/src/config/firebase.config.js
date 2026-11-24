import { getApp, getApps, initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore";


export const firebaseConfig = {
    apiKey: import.meta.env.VITE_APP_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_APP_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_APP_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_APP_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_APP_FIREBASE_MEASUREMENT_ID,
  }

export function getFirebaseApp() {
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) return null;
    return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export async function getFirestoreDB (){
    try{
        const app = getFirebaseApp();
        if (!app) return null;
        return getFirestore(app)
    }catch(err){
        console.log(err)
        // process.exit(1)
    }
}

