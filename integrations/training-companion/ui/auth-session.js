// Only a non-secret session hint persists. Tokens remain in the SDK memory/worker.
export const sessionHintKey = 'rr-training-authenticated-tab-v1';
const recoverable = new Set(['login_required','consent_required','missing_refresh_token','interaction_required']);
export async function restoreSession(client, {search, hash='', storage, replace}) {
 const readHint=()=>{try{return storage.getItem(sessionHintKey)==='1';}catch{return false;}};
 const hint=value=>{try{if(value)storage.setItem(sessionHintKey,'1');else storage.removeItem(sessionHintKey);}catch{/* Storage denial leaves normal explicit sign-in available. */}};
 const params=new URLSearchParams(search);
 if(params.has('state')&&(params.has('code')||params.has('error'))){
  hint(false);
  let result;
  try{result=await client.handleRedirectCallback();await client.getTokenSilently();hint(true);}
  finally{const route=result?.appState?.returnHash;replace('/training/'+(typeof route==='string'&&/^#[a-zA-Z0-9/_-]*$/.test(route)?route:''));}
  return {redirecting:false};
 }
 try{await client.getTokenSilently();hint(true);return {redirecting:false};}
 catch(e){
  if(!recoverable.has(e.error))throw e;
  if(!readHint())return {redirecting:false};
  // Clear before navigating: a failed callback/reload cannot create a redirect loop.
  hint(false);
  await client.loginWithRedirect({authorizationParams:{prompt:'none'},appState:{returnHash:hash}});
  return {redirecting:true};
 }
}
export function clearSessionHint(storage){try{storage.removeItem(sessionHintKey);}catch{}}
