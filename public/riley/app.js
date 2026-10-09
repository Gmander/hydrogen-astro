(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const localDay = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const localInput = (date) => `${localDay(date)}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  const timeLabel = (date) => new Date(date).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
  let selectedDay = localDay(new Date());
  let filter = 'all';
  let entries = [];
  let undoAction = null;
  let toastTimer;
  const names = {feed:'Feed',wee:'Wee',poo:'Poo',both:'Wee + poo'};
  const symbols = {feed:'♡',wee:'♧',poo:'≋',both:'≋'};
  const includes = (entry, type) => entry.type === type || (entry.type === 'both' && (type === 'wee' || type === 'poo'));
  function seed() {
    const now = new Date();
    // Place sample moments within today's elapsed time, including just after midnight.
    const elapsed = now.getTime() - new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
    const sample = [
      {type:'feed',method:'breast',side:'Left',duration:'18',person:'Kane',note:'A quiet cuddle afterwards.'},
      {type:'wee',person:'Aidan'},
      {type:'feed',method:'bottle',amount:'70',person:'Aidan'},
      {type:'both',person:'Kane'},
      {type:'wee',person:'Kane'},
      {type:'feed',method:'breast',side:'Right',duration:'15',person:'Kane'},
    ];
    entries = sample.map((entry,i) => ({id:crypto.randomUUID(),note:'',...entry,time:new Date(now.getTime()-elapsed*(.08+i*.15)).toISOString()}));
    selectedDay = localDay(now); filter = 'all'; render();
  }
  function detail(entry) {
    const parts = [];
    if (entry.type === 'feed') {
      parts.push(entry.method === 'bottle' ? 'Bottle' : 'Breast');
      if (entry.method === 'bottle' && entry.amount) parts.push(`${entry.amount} ml`);
      if (entry.method === 'breast') {
        if (entry.side) parts.push(entry.side === 'Both' ? 'Both sides' : `${entry.side} side`);
        if (entry.duration) parts.push(`${entry.duration} min`);
      }
    } else parts.push(entry.type === 'both' ? 'Wet + dirty nappy' : entry.type === 'wee' ? 'Wet nappy' : 'Dirty nappy');
    parts.push(entry.person); return parts.join(' · ');
  }
  function element(tag, className, text) {
    const node = document.createElement(tag); node.className = className;
    if (text !== undefined) node.textContent = text; return node;
  }
  function render() {
    const today = localDay(new Date());
    const date = new Date(`${selectedDay}T12:00:00`);
    const isToday = selectedDay === today;
    $('day-label').textContent = isToday ? 'Today' : date.toLocaleDateString([], {weekday:'long'});
    $('date-label').textContent = date.toLocaleDateString([], {day:'numeric',month:'short',year:'numeric'});
    $('next-day').disabled = selectedDay >= today;
    $('timeline-title').textContent = isToday ? 'Today’s timeline' : 'The day’s timeline';
    $('summary-period').textContent = isToday ? 'Today so far' : date.toLocaleDateString([], {month:'long',day:'numeric'});
    const dayEntries = entries.filter(e=>localDay(new Date(e.time)) === selectedDay).sort((a,b)=>new Date(b.time)-new Date(a.time));
    const shown = dayEntries.filter(e=>filter === 'all' || includes(e,filter));
    $('event-count').textContent = `${shown.length} ${shown.length === 1 ? 'moment' : 'moments'}`;
    document.querySelectorAll('[data-filter]').forEach(button=>{const active=button.dataset.filter === filter;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    $('timeline').replaceChildren();
    shown.forEach(entry=>{
      const item = element('li','');
      const button = element('button','timeline-entry'); button.type='button';
      button.setAttribute('aria-label',`Edit ${names[entry.type]} at ${timeLabel(entry.time)}`);
      const time = element('span','entry-time',timeLabel(entry.time));
      const icon = element('span',`entry-symbol ${entry.type === 'both' ? 'poo' : entry.type}`,symbols[entry.type]);icon.setAttribute('aria-hidden','true');
      const body = element('span','entry-body');body.append(element('strong','',names[entry.type]),element('span','detail',detail(entry)));
      if(entry.note) body.append(element('span','note',entry.note));
      const arrow=element('span','entry-arrow','↗');arrow.setAttribute('aria-hidden','true');
      button.append(time,icon,body,arrow);button.addEventListener('click',()=>openEntry(entry.type,entry));item.append(button);$('timeline').append(item);
    });
    $('empty').hidden = shown.length > 0;
    $('summary').replaceChildren();
    ['feed','wee','poo'].forEach(type=>{const row=element('div','stat-row');row.append(element('span','',`${names[type]}s`),element('strong','',String(dayEntries.filter(e=>includes(e,type)).length)));$('summary').append(row);});
    const latest=dayEntries.find(e=>e.type==='feed');
    $('last-feed').textContent = latest ? `${timeLabel(latest.time)} · ${latest.method === 'bottle' ? 'Bottle' : 'Breast'}` : 'No feed recorded';
  }
  function syncFields() {
    const isFeed=$('entry-type').value==='feed';
    const breast=$('feed-method').value==='breast';
    $('feed-fields').hidden=!isFeed;$('breast-fields').hidden=!breast;$('bottle-fields').hidden=breast;
    // Hidden inputs must not keep an otherwise valid form from being submitted.
    ['feed-side','feed-duration'].forEach(id=>$(id).disabled=!isFeed || !breast);
    $('feed-amount').disabled=!isFeed || breast;
    $('dialog-title').textContent=`${$('entry-id').value ? 'Edit' : 'Record'} ${names[$('entry-type').value].toLowerCase()}`;
  }
  function openEntry(type,entry) {
    $('entry-form').reset();$('entry-time').setCustomValidity('');$('entry-id').value=entry?.id || '';$('entry-type').value=type;
    const now=new Date();
    const defaultTime=selectedDay === localDay(now) ? now : new Date(`${selectedDay}T12:00:00`);
    $('entry-time').value=localInput(entry ? new Date(entry.time) : defaultTime);
    $('entry-time').max=localInput(now);
    $('entry-person').value=entry?.person || 'Aidan';$('entry-note').value=entry?.note || '';
    $('feed-method').value=entry?.method || 'breast';$('feed-side').value=entry?.side ?? 'Left';
    $('feed-duration').value=entry?.duration || '';$('feed-amount').value=entry?.amount || '';
    $('delete-entry').hidden=!entry;syncFields();$('entry-dialog').showModal();
  }
  function notify(message,undo) {
    clearTimeout(toastTimer);undoAction=undo || null;$('toast-text').textContent=message;$('undo').hidden=!undo;$('toast').hidden=false;
    toastTimer=setTimeout(()=>{$('toast').hidden=true;undoAction=null;},undo ? 12000 : 4500);
  }
  document.querySelectorAll('[data-add]').forEach(button=>button.addEventListener('click',()=>openEntry(button.dataset.add)));
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;render();}));
  $('entry-type').addEventListener('change',syncFields);$('feed-method').addEventListener('change',syncFields);
  ['close-dialog','cancel-dialog'].forEach(id=>$(id).addEventListener('click',()=>$('entry-dialog').close()));
  $('entry-form').addEventListener('submit',event=>{
    event.preventDefault();
    const timestamp=new Date($('entry-time').value);
    if(!Number.isFinite(timestamp.getTime()) || timestamp > new Date()) { $('entry-time').setCustomValidity('Choose a valid time that is not in the future.');$('entry-time').reportValidity();return; }
    const id=$('entry-id').value;const type=$('entry-type').value;
    const entry={id:id || crypto.randomUUID(),type,time:timestamp.toISOString(),person:$('entry-person').value,note:$('entry-note').value.trim()};
    if(type==='feed') {entry.method=$('feed-method').value;if(entry.method==='breast'){entry.side=$('feed-side').value;entry.duration=$('feed-duration').value;}else entry.amount=$('feed-amount').value;}
    entries=id ? entries.map(e=>e.id===id ? entry : e) : [...entries,entry];
    selectedDay=localDay(timestamp);filter='all';$('entry-dialog').close();render();notify(id ? 'Moment updated.' : 'Moment added to the demo.');
  });
  $('entry-time').addEventListener('input',()=>$('entry-time').setCustomValidity(''));
  $('delete-entry').addEventListener('click',()=>{const deleted=entries.find(e=>e.id===$('entry-id').value);entries=entries.filter(e=>e.id!==deleted.id);$('entry-dialog').close();render();notify('Moment deleted.',()=>{entries.push(deleted);render();notify('Moment restored.');});});
  $('undo').addEventListener('click',()=>undoAction?.());
  function changeDay(offset){const date=new Date(`${selectedDay}T12:00:00`);date.setDate(date.getDate()+offset);selectedDay=localDay(date);render();}
  $('previous-day').addEventListener('click',()=>changeDay(-1));$('next-day').addEventListener('click',()=>changeDay(1));
  $('reset-demo').addEventListener('click',()=>{seed();notify('Sample day restored.');});
  seed();
})();
