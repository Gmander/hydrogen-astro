import test from 'node:test';
import assert from 'node:assert/strict';
import {homeProfile} from '../home-profile.mjs';
import {identityKey,createOperations,scopes} from '../service.mjs';
import {openLocalStore} from '../local-store.mjs';
const who=subject=>({athleteId:'athlete-'+identityKey(subject).slice(8),permissions:new Set(scopes)});
const config={members:[{subject:'one',name:'First'},{subject:'two',name:'Second'}],equipment:[{name:'Dumbbell',quantity:2,load:15,unit:'lb'}]};
test('shared equipment resolves only explicitly configured identities and returns only own name',()=>{
 const one=homeProfile(JSON.stringify(config),who('one')),two=homeProfile(JSON.stringify(config),who('two'));
 assert.equal(one.name,'First');assert.equal(two.name,'Second');assert.deepEqual(one.equipment,two.equipment);assert.equal(one.members,undefined);assert.equal(homeProfile(JSON.stringify(config),who('other')),null);
 assert.equal(homeProfile('',who('one')),null);assert.throws(()=>homeProfile('{',who('one')));
});
test('profile reads use one current inventory while keeping workout storage and ownership unchanged',async t=>{
 const store=openLocalStore(':memory:');t.after(()=>store.close());const identity=who('one');
 await store.put('accounts/'+identity.athleteId,{profile:{name:'My training space',equipment:[]},workouts:{},operations:{}},null);
 let value=JSON.stringify(config);const run=createOperations(store,{profileFor:i=>homeProfile(value,i)});
 const before=await store.get('accounts/'+identity.athleteId);
 assert.equal((await run(identity,'get_profile',{})).equipment[0].load,15);
 value=JSON.stringify({...config,equipment:[{name:'Dumbbell',quantity:2,load:30,unit:'lb'}]});
 assert.equal((await run(identity,'get_profile',{})).equipment[0].load,30);
 assert.deepEqual(await store.get('accounts/'+identity.athleteId),before);
});
