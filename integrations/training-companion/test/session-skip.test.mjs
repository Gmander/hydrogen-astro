import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,startTimer,skipSet,tick,finishSet,completedWorkout} from '../ui/session.js';
test('skipping a running interval cancels it without recording work or starting the next timer',()=>{
 const set={seconds:120,reps:null,load:null,unit:null,loadMeaning:'bodyweight',side:'both'};
 const s=createSession({title:'Skip test',exercises:[{name:'First',sets:[set]},{name:'Next',sets:[set]}]},'2026-11-28');
 startTimer(s,'exercise',120,0);skipSet(s);
 assert.equal(s.index,1);assert.equal(s.timer,null);assert.equal(s.queue[0].actual,null);assert.equal(s.queue[0].skipped,true);
 assert.equal(tick(s,130000),null);assert.throws(()=>completedWorkout(s),/at least one set/);
 finishSet(s,set,130000);assert.deepEqual(completedWorkout(s).exercises.map(e=>e.name),['Next']);
});
