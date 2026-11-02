import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSyBUNmJ0UZTSbPCbxXdLzTjHXCzv6tmvXyM",
  authDomain: "app-hisaab.firebaseapp.com",
  databaseURL: "https://app-hisaab-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "app-hisaab",
  storageBucket: "app-hisaab.appspot.com",
  messagingSenderId: "198534532005",
  appId: "1:198534532005:web:ac1d49c62167523532b64c",
  measurementId: "G-8JCMVER0S0",
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const database = getDatabase(app)

export default app
