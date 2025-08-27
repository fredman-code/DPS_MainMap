import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBASNfGOvhNP9i1Lt-GLj0kqD-jzi_wxrA",
  authDomain: "trev-bec38.firebaseapp.com",
  projectId: "trev-bec38",
  storageBucket: "trev-bec38.firebasestorage.app",
  messagingSenderId: "760280854446",
  appId: "1:760280854446:web:de3df4e659e9a3cc91e23f",
  measurementId: "G-MN8FMTVFD9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
export default db