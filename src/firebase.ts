import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { db } from "../db";

// [Manual Configuration Required by User]
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const FcmService = {
    // 1. Request Permission & Get Token
    requestPermission: async (memberId: string) => {
        try {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                console.log("Notification permission granted.");

                // Get Token
                const token = await getToken(messaging, {
                    vapidKey: "YOUR_VAPID_KEY" // User must provide VAPID Key (Web Push Certificate)
                });

                if (token) {
                    console.log("FCM Token:", token);
                    // Save to DB
                    await db.fcmTokens.add(memberId, token);
                    return token;
                }
            } else {
                console.log("Notification permission denied.");
            }
        } catch (error) {
            // Ignore "Key missing" errors for now as user hasn't set them
            console.warn("FCM Init Error (Expected if keys are missing):", error);
        }
    },

    // 2. Foreground Message Listener
    onForegroundMessage: (callback: (payload: any) => void) => {
        onMessage(messaging, (payload) => {
            console.log("Foreground Message received: ", payload);
            callback(payload);
        });
    }
};
