import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyAhaqx8Wkn6MOtkCdJK--WhfTy3ZcULOeo",
  authDomain: "pagina-ineva.firebaseapp.com",
  projectId: "pagina-ineva",
  storageBucket: "pagina-ineva.firebasestorage.app",
  messagingSenderId: "634812168080",
  appId: "1:634812168080:web:ebf993399d546c36bc6515"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)