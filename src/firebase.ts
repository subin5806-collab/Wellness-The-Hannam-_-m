import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { db } from "../db";

// [Configured on 2026-01-27]
const firebaseConfig = {
    apiKey: "AIzaSyCM7qVBaXxA0DtgHQMzdx1eoIOe-SL5s2s",
    authDomain: "wellness-the-hannam.firebaseapp.com",
    projectId: "wellness-the-hannam",
    storageBucket: "wellness-the-hannam.appspot.com",
    messagingSenderId: "179021880006",
    appId: "1:179021880006:web:9c0d6f5f72cdcbd63855c7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export const FcmService = {
    // 1. Request Permission & Get Token
    requestPermission: async (memberId: string) => {
        try {
            // [Kakao Fix] Disable FCM on Kakao In-App Browser to prevent White Screen
            if (/KAKAOTALK|DaumApps/i.test(navigator.userAgent)) {
                console.warn("[System] KakaoTalk detected. Skipping FCM registration.");
                return;
            }

            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                console.log("Notification permission granted.");

                // Get Token
                const token = await getToken(messaging, {
                    vapidKey: "BK5VTVn4tr1FW1WbHirPlYcXvmEd-2dz6phcRX4BznW8THz7JvXkdwkgodbQmqjd649VgdxEuM0s764UioXC6RM"
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
            console.warn("FCM Init Error:", error);
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
