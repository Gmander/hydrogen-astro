import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreSession,sessionHintKey,clearSessionHint} from '../ui/auth-session.js';
function setup(){const map=new Map();return {storage:{getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},map,search:'',hash:'#library',replace:()=>{}};}
const missing=()=>Promise.reject(Object.assign(Error('Login needed'),{error:'login_required'}));
test('Safari reload uses top-level SSO once; failed callback never loops or stores credentials',async()=>{
 const env=setup();env.storage.setItem(sessionHintKey,'1');let options;
 const client={getTokenSilently:missing,loginWithRedirect:async o=>{options=o;},handleRedirectCallback:missing};
 assert.deepEqual(await restoreSession(client,env),{redirecting:true});assert.equal(options.authorizationParams.prompt,'none');assert.equal(options.appState.returnHash,'#library');assert.equal(env.map.size,0);
 let cleaned;await assert.rejects(restoreSession(client,{...env,search:'?state=test&error=login_required',replace:url=>cleaned=url}));assert.equal(cleaned,'/training/');
 options=null;assert.deepEqual(await restoreSession(client,env),{redirecting:false});assert.equal(options,null);
});
test('callback keeps authenticated memory and restores only a local app hash; logout clears hint',async()=>{
 const env=setup();let url;const client={handleRedirectCallback:async()=>({appState:{returnHash:'#library'}}),getTokenSilently:async()=> 'never-persist-this-token'};
 await restoreSession(client,{...env,search:'?state=test&code=test',replace:value=>url=value});assert.equal(url,'/training/#library');assert.deepEqual([...env.map],[[sessionHintKey,'1']]);
 clearSessionHint(env.storage);assert.equal(env.map.size,0);
 client.handleRedirectCallback=async()=>({appState:{returnHash:'https://other.example'}});
 await restoreSession(client,{...env,search:'?state=test&code=test',replace:value=>url=value});assert.equal(url,'/training/');
});
test('new visitors do not auto-redirect; infrastructure errors are surfaced; denied storage is tolerated',async()=>{
 const env=setup();let redirected=false;const client={getTokenSilently:missing,loginWithRedirect:async()=>{redirected=true;}};
 await restoreSession(client,env);assert.equal(redirected,false);
 client.getTokenSilently=async()=>{throw Object.assign(Error('Network failed'),{error:'network_error'});};await assert.rejects(restoreSession(client,env),/Network failed/);
 client.getTokenSilently=async()=> 'token';await restoreSession(client,{...env,storage:{getItem(){throw Error();},setItem(){throw Error();}}});
});
