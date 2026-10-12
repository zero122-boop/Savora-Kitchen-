import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: 'AIzaSyDVkYzkDRb9J0yDG5Du0jywbfgxXyODlCQ',
    authDomain: 'savora-kitchen-986a5.firebaseapp.com',
    projectId: 'savora-kitchen-986a5',
    storageBucket: 'savora-kitchen-986a5.firebasestorage.app',
    messagingSenderId: '911717559061',
    appId: '1:911717559061:web:3d52eb44f87fe6b545d71c',
    measurementId: 'G-5NJBQN2TEQ'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

window.savoraFirebase = Object.freeze({ app, auth, db });

export { app, auth, db };
