import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyDQ0ttmojsPWvLmO5_zQbEtcDZU-kdyrA4",
  authDomain: "ineva-resto-bar.firebaseapp.com",
  projectId: "ineva-resto-bar",
  storageBucket: "ineva-resto-bar.firebasestorage.app",
  messagingSenderId: "187881514354",
  appId: "1:187881514354:web:5e1b8e3b0428afb6c769eb"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)