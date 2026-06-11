// ═══════════════════════════════════════════════════════
//  VISIO — Gemini-powered AI Scanner (100% FREE)
// ═══════════════════════════════════════════════════════

const $ = id => document.getElementById(id);
const el = (tag, cls, html='') => { const e=document.createElement(tag); if(cls)e.className=cls; if(html)e.innerHTML=html; return e; };

// ── MODES ────────────────────────────────────────────────
const MODES = {
  scan:      { label:'Scan',       icon:'🔍', color:'var(--accent)',  prompt:'What is this? Explain what it is, what it does, and how to interact with it. 2-3 natural spoken sentences.' },
  ocr:       { label:'Read Text',  icon:'📖', color:'var(--info)',    prompt:'Read and transcribe ALL visible text in this image exactly as it appears. If there is no text, say so briefly.' },
  nutrition: { label:'Nutrition',  icon:'🥗', color:'var(--accent2)', prompt:'Identify the food or drink shown. Estimate calories, key nutrients, and any allergen warnings. Be concise and conversational.' },
  barcode:   { label:'Barcode',    icon:'📦', color:'var(--warn)',    prompt:'Describe the product based on visible packaging, brand name, and labels. Give the product name, what it is, and any notable info.' },
  danger:    { label:'Danger',     icon:'⚠️',  color:'var(--danger)', prompt:'Analyze this image for hazards, dangerous substances, warning labels, or unsafe situations. State clearly if it is dangerous or safe. Be brief and direct.' },
  quiz:      { label:'Quiz Me',    icon:'🎯', color:'var(--quiz)',    prompt:'Identify the object and return ONLY this JSON (no markdown, no backticks): {"object":"name","question":"a question about it","options":["A","B","C","D"],"correct":0,"explanation":"why A is correct"}' },
};

// ── STATE ─────────────────────────────────────────────────
let state = {
  apiKey:       sessionStorage.getItem('visio_gemini_key') || '',
  mode:         'scan',
  lang:         localStorage.getItem('visio_lang') || 'en-US',
  autoMode:     false,
  autoInterval: null,
  stream:       null,
  facing:       'environment',
  cameraReady:  false,
  scanning:     false,
  speaking:     false,
  listening:    false,
  tfModel:      null,
  tfLoading:    false,
  offlineMode:  localStorage.getItem('visio_offline') === 'true',
  history:      JSON.parse(localStorage.getItem('visio_history') || '[]'),
  currentImage: null,
  currentResponse: '',
  quizData:     null,
};

// ── GEMINI API CALL ───────────────────────────────────────
async function callGemini(imageB64, promptText) {
  // Use gemini-2.0-flash — free tier, fast, great vision
  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${state.apiKey}`;

  const langName = getLanguageName(state.lang);
  const systemInstruction = `You are Visio, a friendly visual AI assistant. Always respond in ${langName}. Be concise, natural, and conversational — as if speaking aloud to someone.`;

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{
      parts: [
        { inline_data: { mime_type: 'image/jpeg', data: imageB64 } },
        { text: promptText }
      ]
    }],
    generationConfig: { maxOutputTokens: 400, temperature: 0.7 }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `Gemini error ${res.status}`;
    if (res.status === 400 && msg.includes('API_KEY')) throw new Error('Invalid API key — check Settings');
    if (res.status === 429) throw new Error('Rate limit hit — wait a moment and try again');
    throw new Error(msg);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
}

// ── INIT ──────────────────────────────────────────────────
async function init() {
  renderModeTabs();
  updateApiStatus();
  if (state.offlineMode) loadTFModel();
  setupVoiceInput();
  const checkOnline = () => document.body.classList.toggle('offline', !navigator.onLine);
  window.addEventListener('online', checkOnline);
  window.addEventListener('offline', checkOnline);
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.activeElement.id === 'question-input') doScan();
  });
}

// ── ONBOARDING ────────────────────────────────────────────
function enterApp() {
  $('screen-onboard').classList.remove('active');
  $('screen-main').classList.add('active');
  startCamera();
}

// ── CAMERA ───────────────────────────────────────────────
async function startCamera() {
  try {
    if (state.stream) state.stream.getTracks().forEach(t => t.stop());
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: state.facing, width: { ideal: 1280 }, height: { ideal: 960 } }
    });
    const vid = $('vid');
    vid.srcObject = state.stream;
    vid.className = state.facing === 'environment' ? 'rear' : '';
    vid.style.display = 'block';
    $('cam-empty').style.display = 'none';
    state.cameraReady = true;
    $('btn-scan-main').disabled = false;
    $('btn-flip').disabled = false;
  } catch(e) {
    toast('Camera access denied — please allow camera', 'err');
  }
}

function flipCamera() {
  state.facing = state.facing === 'environment' ? 'user' : 'environment';
  startCamera();
}

// ── MODE TABS ─────────────────────────────────────────────
function renderModeTabs() {
  const wrap = $('mode-tabs');
  wrap.innerHTML = '';
  Object.entries(MODES).forEach(([key, m]) => {
    const tab = el('button', 'mode-tab' + (key === state.mode ? ' active' : ''));
    tab.innerHTML = `<span class="tab-dot"></span>${m.icon} ${m.label}`;
    tab.onclick = () => setMode(key);
    wrap.appendChild(tab);
  });
}

function setMode(key) {
  state.mode = key;
  stopAuto();
  renderModeTabs();
  const m = MODES[key];
  $('mode-badge').textContent = `${m.icon} ${m.label} mode`;
  $('mode-badge').style.color = m.color;
  const btn = $('btn-scan-main');
  btn.classList.remove('auto-on');
  btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> SCAN`;
  $('resp-text').className = 'idle';
  $('resp-text').textContent = `${m.icon} ${m.label} mode — point and scan`;
  $('response-strip').className = 'response-strip';
  $('danger-overlay').classList.remove('visible');
}

// ── CAPTURE ───────────────────────────────────────────────
function captureFrame() {
  const vid = $('vid');
  const canvas = $('canvas-main');
  const w = vid.videoWidth || 640, h = vid.videoHeight || 480;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.save();
  if (state.facing === 'user') { ctx.translate(w, 0); ctx.scale(-1, 1); }
  ctx.drawImage(vid, 0, 0);
  ctx.restore();
  return canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
}

// ── QR SCAN ───────────────────────────────────────────────
function tryQR() {
  if (typeof jsQR === 'undefined') return null;
  const canvas = $('canvas-main');
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(img.data, img.width, img.height);
  return code ? code.data : null;
}

// ── TENSORFLOW OFFLINE ────────────────────────────────────
async function loadTFModel() {
  if (state.tfModel || state.tfLoading) return;
  state.tfLoading = true;
  toast('Loading offline model…', 'warn');
  try {
    await tf.ready();
    state.tfModel = await mobilenet.load();
    toast('Offline model ready ✓', 'ok');
  } catch(e) {
    toast('Offline model failed', 'err');
    state.offlineMode = false;
  }
  state.tfLoading = false;
}

async function classifyOffline() {
  if (!state.tfModel) return null;
  const img = new Image();
  img.src = $('canvas-main').toDataURL();
  await new Promise(r => img.onload = r);
  const preds = await state.tfModel.classify(img);
  return preds.slice(0,3).map(p => p.className).join(', ');
}

// ── MAIN SCAN ─────────────────────────────────────────────
async function doScan() {
  if (state.scanning) return;
  if (!state.cameraReady) { await startCamera(); return; }
  if (!state.apiKey && !state.offlineMode) {
    goSettings();
    toast('Add your free Gemini API key first', 'warn');
    return;
  }

  state.scanning = true;
  setScanningUI(true);
  $('danger-overlay').classList.remove('visible');

  const flash = $('cam-flash');
  flash.classList.add('pop');
  setTimeout(() => flash.classList.remove('pop'), 120);

  try {
    const imageB64 = captureFrame();
    state.currentImage = 'data:image/jpeg;base64,' + imageB64;

    // QR shortcut
    if (state.mode === 'barcode') {
      const qr = tryQR();
      if (qr) {
        const msg = `QR code detected: ${qr}`;
        setResponse(msg); speak(msg);
        saveHistory(state.currentImage, msg, 'barcode');
        return;
      }
    }

    // Offline
    if (state.offlineMode && state.tfModel) {
      const labels = await classifyOffline();
      const msg = labels ? `I can see: ${labels}. (Offline mode — connect for full detail)` : 'Could not identify offline.';
      setResponse(msg); speak(msg);
      saveHistory(state.currentImage, msg, state.mode);
      return;
    }

    const question = $('question-input').value.trim();
    const promptText = question || MODES[state.mode].prompt;

    const text = await callGemini(imageB64, promptText);

    if (state.mode === 'quiz') {
      handleQuiz(text);
    } else {
      const isDanger = state.mode === 'danger' &&
        /danger|hazard|toxic|warning|unsafe|corrosive|flammable|poison/i.test(text);
      setResponse(text, isDanger ? 'danger-resp' : '');
      $('danger-overlay').classList.toggle('visible', isDanger);
      speak(text);
      saveHistory(state.currentImage, text, state.mode);
      state.currentResponse = text;
    }

  } catch(e) {
    setResponse('⚠ ' + e.message, 'danger-resp');
    toast(e.message, 'err');
  } finally {
    state.scanning = false;
    setScanningUI(false);
  }
}

// ── AUTO SCAN ─────────────────────────────────────────────
function toggleAuto() {
  if (state.autoMode) { stopAuto(); return; }
  state.autoMode = true;
  const btn = $('btn-scan-main');
  btn.classList.add('auto-on');
  btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="2"/></svg> AUTO ON`;
  toast('Auto scan every 3s', 'ok');
  doScan();
  state.autoInterval = setInterval(() => { if (!state.scanning) doScan(); }, 3000);
}

function stopAuto() {
  state.autoMode = false;
  clearInterval(state.autoInterval);
  state.autoInterval = null;
  const btn = $('btn-scan-main');
  btn.classList.remove('auto-on');
  btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> SCAN`;
}

// ── QUIZ ──────────────────────────────────────────────────
function handleQuiz(raw) {
  let q;
  try {
    q = JSON.parse(raw.replace(/```json|```/g,'').trim());
  } catch(e) {
    setResponse(raw); speak(raw); return;
  }
  state.quizData = q;
  saveHistory(state.currentImage, `Quiz: ${q.question}`, 'quiz');
  speak(`${q.object}! Here's your quiz. ${q.question}`);
  $('quiz-q').textContent = q.question;
  const wrap = $('quiz-options');
  wrap.innerHTML = '';
  q.options.forEach((opt, i) => {
    const b = el('button','quiz-opt', opt);
    b.onclick = () => answerQuiz(i, b, wrap);
    wrap.appendChild(b);
  });
  $('quiz-feedback').textContent = '';
  $('quiz-next').classList.remove('visible');
  $('quiz-modal').classList.add('open');
}

function answerQuiz(idx, btn, wrap) {
  const q = state.quizData;
  Array.from(wrap.children).forEach(b => b.onclick = null);
  if (idx === q.correct) {
    btn.classList.add('correct');
    $('quiz-feedback').textContent = '✓ Correct! ' + q.explanation;
    speak('Correct! ' + q.explanation);
  } else {
    btn.classList.add('wrong');
    wrap.children[q.correct].classList.add('correct');
    $('quiz-feedback').textContent = '✗ ' + q.explanation;
    speak('Not quite. ' + q.explanation);
  }
  $('quiz-next').classList.add('visible');
}

function closeQuiz() { $('quiz-modal').classList.remove('open'); }
function nextQuiz()  { closeQuiz(); doScan(); }

// ── VOICE INPUT ───────────────────────────────────────────
function setupVoiceInput() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { $('btn-mic').style.display = 'none'; return; }
  const rec = new SR();
  rec.interimResults = false;
  rec.onresult = e => {
    $('question-input').value = e.results[0][0].transcript;
    stopListening(rec);
    doScan();
  };
  rec.onerror = rec.onend = () => stopListening(rec);
  $('btn-mic').onclick = () => {
    if (state.listening) { stopListening(rec); return; }
    state.listening = true;
    $('btn-mic').classList.add('listening');
    rec.lang = state.lang;
    rec.start();
    toast('Listening…');
  };
}

function stopListening(rec) {
  state.listening = false;
  $('btn-mic').classList.remove('listening');
  try { rec.stop(); } catch(e){}
}

// ── TTS ───────────────────────────────────────────────────
function speak(text) {
  stopSpeaking();
  if (!text || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = state.lang;
  u.rate = 0.95; u.pitch = 1.05;
  const voices = speechSynthesis.getVoices();
  const pref = voices.find(v => v.lang.startsWith(state.lang.split('-')[0]) && /premium|enhanced|natural/i.test(v.name))
            || voices.find(v => v.lang.startsWith(state.lang.split('-')[0]));
  if (pref) u.voice = pref;
  u.onstart = () => setSpeakingUI(true);
  u.onend = u.onerror = () => setSpeakingUI(false);
  speechSynthesis.speak(u);
}

function stopSpeaking() {
  speechSynthesis.cancel();
  setSpeakingUI(false);
}

function setSpeakingUI(on) {
  state.speaking = on;
  $('response-strip').classList.toggle('speaking', on);
  $('btn-stop').disabled = !on;
}

// ── HISTORY ───────────────────────────────────────────────
function saveHistory(imgSrc, text, mode) {
  state.history.unshift({ id: Date.now(), time: new Date().toLocaleTimeString(), img: imgSrc, text, mode });
  if (state.history.length > 10) state.history.pop();
  localStorage.setItem('visio_history', JSON.stringify(state.history));
  $('hist-badge').classList.toggle('visible', state.history.length > 0);
  $('hist-badge').textContent = Math.min(state.history.length, 9);
}

function openHistory() { renderHistory(); $('drawer-history').classList.add('open'); }
function closeHistory() { $('drawer-history').classList.remove('open'); }

function renderHistory() {
  const list = $('history-list');
  list.innerHTML = '';
  if (!state.history.length) {
    list.appendChild(el('div','history-empty','No scans yet — go point at something!'));
    return;
  }
  state.history.forEach(item => {
    const div = el('div','history-item');
    div.innerHTML = `
      <img class="history-thumb" src="${item.img}" alt="">
      <div class="history-info">
        <div class="history-mode">${MODES[item.mode]?.icon||'🔍'} ${MODES[item.mode]?.label||item.mode}</div>
        <div class="history-time">${item.time}</div>
        <div class="history-resp">${item.text}</div>
      </div>`;
    div.onclick = () => { setResponse(item.text); speak(item.text); closeHistory(); };
    list.appendChild(div);
  });
}

function clearHistory() {
  state.history = [];
  localStorage.removeItem('visio_history');
  $('hist-badge').classList.remove('visible');
  renderHistory();
  toast('History cleared', 'ok');
}

// ── SHARE ─────────────────────────────────────────────────
function openShare() {
  if (!state.currentImage) { toast('Scan something first', 'warn'); return; }
  $('share-img').src = state.currentImage;
  $('share-resp-text').textContent = state.currentResponse || '';
  $('share-overlay').classList.add('open');
}

function closeShare() { $('share-overlay').classList.remove('open'); }

function downloadShare() {
  const c = document.createElement('canvas');
  c.width = 720; c.height = 700;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0f0f18';
  ctx.fillRect(0,0,c.width,c.height);
  const img = new Image();
  img.src = state.currentImage;
  img.onload = () => {
    ctx.drawImage(img, 0, 0, c.width, 480);
    const g = ctx.createLinearGradient(0,340,0,480);
    g.addColorStop(0,'rgba(15,15,24,0)'); g.addColorStop(1,'rgba(15,15,24,1)');
    ctx.fillStyle = g; ctx.fillRect(0,340,c.width,140);
    ctx.fillStyle = '#7bffc8'; ctx.font = 'bold 28px sans-serif';
    ctx.fillText('VISIO', 30, 530);
    ctx.fillStyle = 'rgba(240,240,250,0.4)'; ctx.font = '14px monospace';
    ctx.fillText('AI Visual Scanner • Free', 96, 530);
    ctx.fillStyle = 'rgba(240,240,250,0.75)'; ctx.font = '15px monospace';
    const words = state.currentResponse.split(' ');
    let line = '', y = 568, maxW = c.width - 60;
    words.forEach(w => {
      const test = line + w + ' ';
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line,30,y); line=w+' '; y+=24; }
      else line = test;
    });
    ctx.fillText(line, 30, y);
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = 'visio-scan.png';
    a.click();
  };
}

// ── SETTINGS ─────────────────────────────────────────────
function goSettings() {
  $('screen-main').classList.remove('active');
  $('screen-settings').classList.add('active');
  $('s-api-key').value = state.apiKey;
  $('s-lang').value = state.lang;
  $('s-offline').checked = state.offlineMode;
}

function backToMain() {
  $('screen-settings').classList.remove('active');
  $('screen-main').classList.add('active');
}

function saveSettings() {
  const key = $('s-api-key').value.trim();
  state.apiKey = key;
  state.lang = $('s-lang').value;
  state.offlineMode = $('s-offline').checked;
  sessionStorage.setItem('visio_gemini_key', state.apiKey);
  localStorage.setItem('visio_lang', state.lang);
  localStorage.setItem('visio_offline', state.offlineMode);
  updateApiStatus();
  if (state.offlineMode) loadTFModel();
  toast('Settings saved ✓', 'ok');
  backToMain();
}

function updateApiStatus() {
  const btn = $('api-status-btn');
  if (state.apiKey) {
    btn.style.borderColor = 'var(--accent)';
    btn.style.color = 'var(--accent)';
  }
}

// ── UI HELPERS ────────────────────────────────────────────
function setScanningUI(on) {
  $('cam-wrap').classList.toggle('scanning', on);
  $('btn-scan-main').disabled = on;
  if (on) {
    $('resp-text').className = 'loading';
    $('resp-text').innerHTML = 'Analysing<span class="cursor"></span>';
  }
}

function setResponse(text, cls='') {
  const el = $('resp-text');
  el.className = cls || '';
  el.textContent = '';
  $('response-strip').className = 'response-strip' + (cls ? ' '+cls : '');
  let i = 0;
  const iv = setInterval(() => {
    if (i < text.length) el.textContent += text[i++];
    else clearInterval(iv);
  }, 14);
}

function toast(msg, type='') {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast' + (type ? ' '+type : '');
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 3000);
}

function getLanguageName(code) {
  const map = {'en-US':'English','en-GB':'English','hi-IN':'Hindi','bn-IN':'Bengali','ta-IN':'Tamil','te-IN':'Telugu','mr-IN':'Marathi','gu-IN':'Gujarati','kn-IN':'Kannada','ml-IN':'Malayalam','pa-IN':'Punjabi','fr-FR':'French','de-DE':'German','es-ES':'Spanish','ja-JP':'Japanese','zh-CN':'Chinese','ar-SA':'Arabic','pt-BR':'Portuguese','ru-RU':'Russian','ko-KR':'Korean'};
  return map[code] || 'English';
}

// ── SERVICE WORKER ────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

// ── BOOT ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => {};
  init();
});
