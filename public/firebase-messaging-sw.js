importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// [Manual Configuration Required by User]
// User must update these keys after creating a Firebase Project.
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    // Background Message Handler
    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Background message: ', payload);
        const notificationTitle = payload.notification?.title || 'Wellness The Hannam';
        const notificationOptions = {
            body: payload.notification?.body || '새로운 알림이 도착했습니다.',
            icon: '/pwa-icon.png', // Uses the PWA icon
            badge: '/pwa-icon.png', // Small badge
            data: payload.data,
            vibrate: [200, 100, 200]
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
} catch (error) {
    console.warn("Firebase SW Init failed (Keys likely missing):", error);
}

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    // Open the app
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                return client.focus();
            }
            return clients.openWindow('/');
        })
    );
});
