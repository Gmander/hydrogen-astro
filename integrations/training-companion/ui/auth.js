import {restoreSession,clearSessionHint} from './auth-session.js';
import { Auth0Client } from '@auth0/auth0-spa-js';
let config, client;
export async function initializeAuth() {
  config = await fetch('/api/training/config').then(r => { if (!r.ok) throw Error('Sign-in is temporarily unavailable.'); return r.json(); });
  if (config.preview) return config;
  if (!config.clientId) throw Error('This preview is awaiting sign-in setup.');
  client ??= new Auth0Client({ domain: config.domain, clientId: config.clientId,
    cacheLocation: 'memory', useRefreshTokens: true, useRefreshTokensFallback: true,
    workerUrl: '/training/auth0-worker.js',
    authorizationParams: { audience: config.audience, scope: config.scopes, redirect_uri: location.origin + '/training/' },
  });
  try {
    const session = await restoreSession(client, {search:location.search,hash:location.hash,storage:sessionStorage,replace:url=>history.replaceState(null,'',url)});
    return {...config,...session};
  } catch (error) { error.authConfig=config; throw error; }
}
export async function getToken() {
  if (config.preview) {
    const response = await fetch('/__preview/session', { cache: 'no-store' });
    if (!response.ok) throw Object.assign(Error('Choose a sample account to open the preview.'), { status: 401 });
    return (await response.json()).token;
  }
  return client.getTokenSilently();
}
export async function signIn(account) {
  if (config.preview) {
    const response = await fetch('/__preview/sign-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account }) });
    if (!response.ok) throw Error('Could not open the sample account.');
    location.replace('/training/');
  } else await client.loginWithRedirect({ authorizationParams: { prompt: 'login' } });
}
export async function signOut() {
  clearSessionHint(sessionStorage);
  if (config.preview) {
    const response = await fetch('/__preview/sign-out', { method: 'POST' });
    if (!response.ok) throw Error('Could not sign out. Try again.');
    location.replace('/training/');
  } else await client.logout({ logoutParams: { returnTo: location.origin + '/training/' } });
}
export async function activateAccount() {
  const token = await getToken();
  const response = await fetch('/api/training/activate', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
  const result = await response.json();
  if (!response.ok) throw Error(result.error ?? 'Could not create your space.');
  return result;
}
