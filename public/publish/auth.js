// Sign-in with Firebase email and password. The session is kept in this browser (local
// persistence) and refreshed automatically, so people only sign in once per device.
// Email-link sign-in is deliberately not used: the free Firebase plan allows only 5 of those
// emails per day. Password sign-in has no send quota.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  browserLocalPersistence, createUserWithEmailAndPassword, getAuth, onAuthStateChanged,
  sendEmailVerification, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

export function friendlyAuthError(e) {
  switch (e?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "That email or password isn't right.";
    case "auth/email-already-in-use": return "That email already has an account. Use Sign in instead.";
    case "auth/weak-password": return "Use a password with at least 6 characters.";
    case "auth/invalid-email": return "That doesn't look like an email address.";
    case "auth/too-many-requests": return "Too many tries. Wait a few minutes and try again.";
    case "auth/quota-exceeded": return "Too many emails were sent today. Try again tomorrow, or ask Aidan.";
    default: return "Something went wrong. Try again.";
  }
}

export async function startAuth(config, onUser) {
  const auth = getAuth(initializeApp(config));
  await setPersistence(auth, browserLocalPersistence);
  const back = { url: `${location.origin}/publish/` };
  const emit = (u) => onUser(u ? { email: u.email, verified: u.emailVerified } : null);
  onAuthStateChanged(auth, emit);

  return {
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    async signUp(email, password) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(cred.user, back);
    },
    resetPassword: (email) => sendPasswordResetEmail(auth, email, back),
    resendVerification: () => sendEmailVerification(auth.currentUser, back),
    async refresh() {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      emit(auth.currentUser);
    },
    getToken: () => auth.currentUser.getIdToken(),
    signOut: () => signOut(auth),
  };
}
