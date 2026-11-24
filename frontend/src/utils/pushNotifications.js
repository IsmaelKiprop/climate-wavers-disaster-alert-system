import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { client } from "../api";
import { getFirebaseApp, firebaseConfig } from "../config/firebase.config";
import { endpoints } from "./endpoints";

export async function registerForBackgroundPush({ requestPermission = false } = {}) {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return false;
  const vapidKey = import.meta.env.VITE_APP_FIREBASE_VAPID_KEY;
  if (!vapidKey || !firebaseConfig.apiKey || !firebaseConfig.projectId) return false;

  try {
    if (!(await isSupported())) return false;
    let permission = Notification.permission;
    if (permission === "default" && requestPermission) permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const app = getFirebaseApp();
    if (!app) return false;
    const workerConfig = new URLSearchParams({
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain || "",
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket || "",
      messagingSenderId: firebaseConfig.messagingSenderId || "",
      appId: firebaseConfig.appId || "",
    });
    const registration = await navigator.serviceWorker.register(
      `/push/fcm-sw.js?${workerConfig.toString()}`,
      { scope: "/push/" }
    );
    const token = await getToken(getMessaging(app), {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return false;
    const result = await client.run("post", endpoints.championsPushToken, { token, platform: "web" }, true);
    return Boolean(result?.push_configured);
  } catch {
    return false;
  }
}
