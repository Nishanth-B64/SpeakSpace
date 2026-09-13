import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyC7Og8aYRV8rYTjNHwC59cVeYSh5Ys-8qo",
  authDomain: "speakspace-8e4d0.firebaseapp.com",
  projectId: "speakspace-8e4d0",
  storageBucket: "speakspace-8e4d0.firebasestorage.app",
  messagingSenderId: "965382432822",
  appId: "1:965382432822:web:bff4f0257966faa0011097",
  measurementId: "G-RYFZ53Q9DH"
};

const firebaseApp = initializeApp(firebaseConfig);

// Analytics is optional and unavailable in some browsers or local environments.
if (await isSupported()) {
  getAnalytics(firebaseApp);
}

window.firebaseApp = firebaseApp;

export { firebaseApp };
