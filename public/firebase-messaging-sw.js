importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// [Configured on 2026-01-27]
const firebaseConfig = {
    apiKey: "AIzaSyCM7qVBaXxA0DtgHQMzdx1eoIOe-SL5s2s",
    authDomain: "wellness-the-hannam.firebaseapp.com",
    projectId: "wellness-the-hannam",
    storageBucket: "wellness-the-hannam.appspot.com",
    messagingSenderId: "179021880006",
    appId: "1:179021880006:web:9c0d6f5f72cdcbd63855c7"
};

try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    // Background Message Handler
    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);
        // Customize notification here
        const notificationTitle = payload.notification?.title || 'Wellness The Hannam';
        const notificationOptions = {
            body: payload.notification?.body,
            icon: '/pwa-icon.png',
            data: payload.data // Pass data (url, image) to notification
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
