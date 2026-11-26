// Pure session transitions. Timers pause after suspension; elapsed background time never logs exercise.
export const clone=v=>JSON.parse(JSON.stringify(v));
export function createSession(workout,date){
 const queue=workout.exercises.flatMap((exercise,ei)=>exercise.sets.map((set,si)=>({ei,si,name:exercise.name,target:clone(set),actual:null,skipped:false})));
 if(!queue.length)throw Error('Add at least one set before starting.');
 return {title:workout.title,date,notes:'',queue,index:0,timer:null,restSeconds:60,timedRestSeconds:0,autoAdvance:true,sound:true,keepAwake:true,startedAt:new Date().toISOString(),operationId:crypto.randomUUID(),pending:null};
}
export const remaining=(timer,now)=>timer?Math.max(0,timer.running?(timer.deadline-now)/1000:timer.remaining):0;
export function startTimer(session,kind,seconds,now){session.timer={kind,running:true,remaining:seconds,deadline:now+seconds*1000,lastTick:now};}
export function pauseTimer(session,now){if(session.timer?.running){session.timer.remaining=remaining(session.timer,now);session.timer.running=false;}}
export function resumeTimer(session,now){const t=session.timer;if(t){t.deadline=now+t.remaining*1000;t.lastTick=now;t.running=true;}}
export function finishSet(session,actual,now){
 const step=session.queue[session.index];if(!step)return;
 step.actual=clone(actual);session.index++;session.timer=null;
 if(session.index>=session.queue.length)return;
 const next=session.queue[session.index];const rest=step.target.seconds>0?session.timedRestSeconds:session.restSeconds;
 if(rest>0)startTimer(session,'rest',rest,now);
 else if(session.autoAdvance&&next.target.seconds>0)startTimer(session,'exercise',next.target.seconds,now);
}
export function afterRest(session,now){session.timer=null;const next=session.queue[session.index];if(session.autoAdvance&&next?.target.seconds>0)startTimer(session,'exercise',next.target.seconds,now);}
export function tick(session,now){
 const t=session.timer;if(!t?.running)return null;
 if(now-t.lastTick>5000){t.remaining=Math.max(0,(t.deadline-t.lastTick)/1000);t.running=false;return 'suspended';}
 t.lastTick=now;if(now<t.deadline)return null;
 if(t.kind==='rest'){afterRest(session,now);return 'rest-ended';}
 const actual=clone(session.queue[session.index].target);
 // A completed interval confirms its duration, not any planned repetition count.
 actual.reps=null;finishSet(session,actual,now);return 'set-ended';
}
export function completedWorkout(session){
 const exercises=[];for(const step of session.queue){if(!step.actual)continue;let e=exercises.find(e=>e.ei===step.ei);if(!e){e={ei:step.ei,name:step.name,sets:[]};exercises.push(e);}e.sets.push(clone(step.actual));}
 if(!exercises.length)throw Error('Log at least one set before saving a session.');
 return {title:session.title,status:'completed',date:session.date,notes:session.notes,exercises:exercises.map(({ei,...e})=>e)};
}
