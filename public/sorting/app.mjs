import { questions, drawHouse } from './quiz.mjs';

const app = document.querySelector('#app');
let index = 0;
let answers = [];
let pending = null;
let currentHouse = null;

function focusHeading() { app.querySelector('h1, h2')?.focus(); }

function intro() {
  app.innerHTML = `<section class="intro"><p class="eyebrow">HOGWARTS HOUSE PLACEMENT · FORM 04</p><div class="ornament" aria-hidden="true">✧</div><h1>Where do<br>you <em>belong?</em></h1><p class="lead">Beyond first impressions. Beneath the obvious.<br>A more considered approach to finding your house.</p><div class="facts"><span>20 questions</span><span>About 4 minutes</span><span>Trust your instincts</span></div><button class="primary" id="begin">Begin the assessment <span aria-hidden="true">→</span></button><p class="fine">Choose the answer that feels most like you.<br>Some questions may require a moment of reflection.</p></section>`;
  app.querySelector('#begin').onclick = () => { index = 0; answers = []; question(); };
}

function question() {
  const q = questions[index];
  app.innerHTML = `<section class="question"><div class="progress-meta"><span>THE ASSESSMENT</span><span>${String(index + 1).padStart(2, '0')} / 20</span></div><div class="progress" role="progressbar" aria-label="Assessment progress" aria-valuemin="0" aria-valuemax="20" aria-valuenow="${index}"><span style="width:${index / questions.length * 100}%"></span></div><p class="eyebrow question-label">QUESTION ${String(index + 1).padStart(2, '0')}</p><h2 tabindex="-1" id="question-title">${q.prompt}</h2><div class="options" role="group" aria-labelledby="question-title">${q.options.map((option, i) => `<button class="option ${answers[index] === i ? 'selected' : ''}" aria-pressed="${answers[index] === i}" data-answer="${i}"><span class="letter">${'ABCD'[i]}</span><span>${option}</span><span class="check" aria-hidden="true">✓</span></button>`).join('')}</div><div class="navigation"><button class="back" id="back" ${index === 0 ? 'disabled' : ''}>← Back</button><span class="hint">Go with your first instinct.</span><button class="primary" id="next" ${answers[index] === undefined ? 'disabled' : ''}>${index === questions.length - 1 ? 'Complete' : 'Continue'} <span aria-hidden="true">→</span></button></div></section>`;
  app.querySelectorAll('[data-answer]').forEach(button => {
    button.onclick = () => {
      answers[index] = Number(button.dataset.answer);
      app.querySelectorAll('[data-answer]').forEach(el => { const active = el === button; el.classList.toggle('selected', active); el.setAttribute('aria-pressed', String(active)); });
      app.querySelector('#next').disabled = false;
    };
  });
  app.querySelector('#back').onclick = () => { if (index > 0) { index--; question(); } };
  app.querySelector('#next').onclick = () => {
    if (answers[index] === undefined) return;
    if (index < questions.length - 1) { index++; question(); }
    else reveal();
  };
  focusHeading();
}

function reveal() {
  currentHouse = drawHouse();
  app.innerHTML = `<section class="thinking" aria-live="polite"><div class="orbit" aria-hidden="true">✧</div><p class="eyebrow">ASSESSMENT COMPLETE</p><h2 tabindex="-1">A moment of<br><em>consideration.</em></h2><p class="lead" id="thinking-status">Consulting the ancient criteria…</p></section>`;
  focusHeading();
  pending = setTimeout(() => { document.querySelector('#thinking-status').textContent = 'Taking the geese into account…'; pending = setTimeout(result, 1500); }, 1400);
}

function result() {
  pending = null;
  const h = currentHouse;
  app.innerHTML = `<section class="result" style="--house:${h.color}"><p class="eyebrow">YOUR PLACE HAS BEEN FOUND</p><div class="house-mark" aria-hidden="true">${h.name[0]}</div><p class="animal">${h.animal}</p><h1 tabindex="-1">${h.name}</h1><p class="motto">${h.motto}</p><p class="traits">${h.traits}</p><p class="description">${h.description}</p><div class="result-actions"><button class="primary" id="share">Share your house <span aria-hidden="true">↗</span></button><button class="back" id="restart">Take it again</button></div><p class="share-status" role="status" id="share-status"></p><details><summary>A note on the methodology</summary><p>Twenty questions. Zero bearing on the result. You had an equal 25% chance of each house. The geese, the algebra, and your moral character were all administratively irrelevant.</p><p>No answers are sent anywhere or saved. Thank you for your contribution to magical science.</p></details></section>`;
  focusHeading();
  app.querySelector('#restart').onclick = () => { clearTimeout(pending); currentHouse = null; intro(); app.querySelector('#begin').focus(); };
  app.querySelector('#share').onclick = async () => {
    const data = { title: 'The Sorting Assessment', text: `I got ${h.name}. Find out where you belong.`, url: location.href.split('#')[0] };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(`${data.text} ${data.url}`); app.querySelector('#share-status').textContent = 'Copied. Send it to your next unsuspecting classmate.'; }
    } catch (error) { if (error.name !== 'AbortError') app.querySelector('#share-status').textContent = 'Copy the page address to share the assessment.'; }
  };
}

intro();
