import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js';

const $ = id => document.getElementById(id);
const isLogin = Boolean($('login-form'));
const errorBox = $('login-error') || $('signup-error');
const setError = msg => { if (errorBox) errorBox.textContent = msg || ''; };
const friendlyError = e => ({
  'auth/invalid-email':'Please enter a valid email address.',
  'auth/invalid-credential':'Email or password is incorrect.',
  'auth/wrong-password':'Email or password is incorrect.',
  'auth/user-not-found':'No account was found for this email.',
  'auth/email-already-in-use':'An account with this email already exists.',
  'auth/weak-password':'Password must be at least 6 characters.',
  'auth/network-request-failed':'Network error. Check your internet connection.',
  'auth/too-many-requests':'Too many attempts. Please wait and try again.',
  'auth/popup-closed-by-user':'Google sign-in was cancelled.'
}[e.code] || 'Authentication failed. Please try again.');

onAuthStateChanged(auth, user => { if (user) location.replace('dashboard.html'); });

document.querySelectorAll('[data-password-toggle]').forEach(btn => btn.addEventListener('click', () => {
  const input = $(btn.dataset.passwordToggle); input.type = input.type === 'password' ? 'text' : 'password'; btn.textContent = input.type === 'password' ? 'Show' : 'Hide';
}));

if (isLogin) {
  $('login-form').addEventListener('submit', async e => {
    e.preventDefault(); setError(''); const btn = $('login-btn'); btn.disabled = true; btn.textContent = 'LOGGING IN…';
    try { await signInWithEmailAndPassword(auth, $('login-email').value.trim(), $('login-password').value); location.replace('dashboard.html'); }
    catch (err) { setError(friendlyError(err)); btn.disabled = false; btn.textContent = 'LOGIN'; }
  });
  $('google-btn').addEventListener('click', async () => {
    setError(''); const btn = $('google-btn'); btn.disabled = true; btn.textContent = 'CONNECTING…';
    try { await signInWithPopup(auth, new GoogleAuthProvider()); location.replace('dashboard.html'); }
    catch (err) { setError(friendlyError(err)); btn.disabled = false; btn.textContent = 'Continue with Google'; }
  });
} else {
  $('signup-form').addEventListener('submit', async e => {
    e.preventDefault(); setError(''); const email = $('signup-email').value.trim(); const password = $('signup-password').value; const confirm = $('signup-confirm').value; const btn = $('signup-btn');
    if (password !== confirm) return setError('Passwords do not match.'); if (password.length < 6) return setError('Password must be at least 6 characters.');
    btn.disabled = true; btn.textContent = 'CREATING ACCOUNT…';
    try { await createUserWithEmailAndPassword(auth, email, password); location.replace('dashboard.html'); }
    catch (err) { setError(friendlyError(err)); btn.disabled = false; btn.textContent = 'CREATE ACCOUNT'; }
  });
}
