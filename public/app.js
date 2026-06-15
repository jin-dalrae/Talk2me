// ---- websocket ---------------------------------------------------------------
const proto = location.protocol === 'https:' ? 'wss' : 'ws';
let ws;

function connect() {
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => setStatus('Connecting to your friends…');
  ws.onclose = () => {
    setStatus('Disconnected. Reconnecting…');
    talkBtn.disabled = true;
    setTimeout(connect, 1500);
  };
  ws.onmessage = (ev) => handleServer(JSON.parse(ev.data));
}

function handleServer(m) {
  switch (m.type) {
    case 'ready':
      if (!started) {
        startBtn.hidden = false;
        setStatus('Ready when you are');
      } else {
        talkBtn.disabled = false;
        setStatus('Ready — hold to talk');
      }
      break;
    case 'speaker':
      currentSpeaker = m.name;
      respBubble = null; // new responder bubble created on first transcript chunk
      setStatus(`${m.name} is thinking…`, `speaking-${m.name}`);
      break;
    case 'user_transcript':
      setBubbleText(userBubble, m.text);
      break;
    case 'transcript':
      if (!respBubble) respBubble = addBubble(m.name, m.name);
      setBubbleText(respBubble, m.text);
      setStatus(`${m.name} is speaking…`, `speaking-${m.name}`);
      break;
    case 'searching':
      setStatus(`🔎 ${m.name} is looking that up…`, `speaking-${m.name}`);
      break;
    case 'audio':
      playPcm(bytesFromBase64(m.data));
      break;
    case 'interrupted':
      stopPlayback();
      break;
    case 'turn_end':
      talkBtn.disabled = false;
      setStatus('Ready — hold to talk');
      break;
    case 'error':
      setStatus(`⚠ ${m.message}`);
      break;
  }
}

// ---- UI ----------------------------------------------------------------------
const transcriptEl = document.getElementById('transcript');
const statusEl = document.getElementById('status');
const talkBtn = document.getElementById('talk');
const startBtn = document.getElementById('start');

let currentSpeaker = null;
let userBubble = null;
let respBubble = null;
let started = false;

// First gesture: unlock audio, prime the mic, and ask the coaches to open.
startBtn.addEventListener('click', async () => {
  started = true;
  startBtn.hidden = true;
  ensurePlayCtx();
  await ensureMic();
  if (micCtx?.state === 'suspended') await micCtx.resume();
  talkBtn.disabled = false;
  setStatus('Starting…');
  if (ws?.readyState === 1) ws.send(JSON.stringify({ type: 'begin' }));
});

function setStatus(text, cls = '') {
  statusEl.textContent = text;
  statusEl.className = `status ${cls}`;
}

function addBubble(cls, who) {
  const el = document.createElement('div');
  el.className = `bubble ${cls}`;
  if (who) {
    const w = document.createElement('span');
    w.className = 'who';
    w.textContent = who;
    el.appendChild(w);
  }
  const body = document.createElement('span');
  body.className = 'body';
  el.appendChild(body);
  transcriptEl.appendChild(el);
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
  return el;
}

function setBubbleText(el, text) {
  if (!el) return;
  el.querySelector('.body').textContent = text;
  transcriptEl.scrollTop = transcriptEl.scrollHeight;
}

// ---- mode toggle -------------------------------------------------------------
document.querySelectorAll('input[name="mode"]').forEach((r) => {
  r.addEventListener('change', (e) => {
    if (e.target.checked && ws?.readyState === 1) {
      ws.send(JSON.stringify({ type: 'mode', mode: e.target.value }));
      setStatus('Switching mode…');
      talkBtn.disabled = true;
    }
  });
});

// ---- audio playback (24 kHz PCM) ---------------------------------------------
let playCtx = null;
let playHead = 0;
let liveSources = [];

function ensurePlayCtx() {
  if (!playCtx) {
    playCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
  }
  if (playCtx.state === 'suspended') playCtx.resume();
  return playCtx;
}

function playPcm(bytes) {
  const ctx = ensurePlayCtx();
  const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 1);
  const f32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;

  const buf = ctx.createBuffer(1, f32.length, 24000);
  buf.getChannelData(0).set(f32);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);

  const start = Math.max(ctx.currentTime, playHead);
  src.start(start);
  playHead = start + buf.duration;

  liveSources.push(src);
  src.onended = () => {
    liveSources = liveSources.filter((s) => s !== src);
  };
}

function stopPlayback() {
  for (const s of liveSources) {
    try { s.stop(); } catch {}
  }
  liveSources = [];
  if (playCtx) playHead = playCtx.currentTime;
}

// ---- mic capture (16 kHz PCM, via AudioWorklet) ------------------------------
// Capture runs on the audio thread so DOM updates can't starve it and drop
// audio. The worklet streams PCM chunks and, on stop, flushes the tail before
// we tell the server the turn is over.
let micCtx = null;
let micStream = null;
let workletNode = null;
let recording = false;
let micReady = false;

async function ensureMic() {
  if (micReady) return true;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
  } catch (err) {
    setStatus('⚠ Microphone permission needed');
    return false;
  }
  micCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  await micCtx.audioWorklet.addModule('capture-worklet.js');

  const source = micCtx.createMediaStreamSource(micStream);
  workletNode = new AudioWorkletNode(micCtx, 'capture-processor');
  const mute = micCtx.createGain();
  mute.gain.value = 0; // keep the graph pulling without echoing the mic

  workletNode.port.onmessage = (e) => {
    if (ws?.readyState !== 1) return;
    if (e.data.pcm) {
      ws.send(JSON.stringify({ type: 'audio', data: base64FromBytes(new Uint8Array(e.data.pcm)) }));
    } else if (e.data.ended) {
      // all buffered audio has been sent — now safe to close the turn
      ws.send(JSON.stringify({ type: 'mic_end' }));
    }
  };

  source.connect(workletNode);
  workletNode.connect(mute);
  mute.connect(micCtx.destination);
  micReady = true;
  return true;
}

// ---- push to talk ------------------------------------------------------------
async function startTalking() {
  if (talkBtn.disabled || recording) return;
  ensurePlayCtx();
  const ok = await ensureMic();
  if (!ok) return;
  if (micCtx?.state === 'suspended') await micCtx.resume();

  recording = true;
  talkBtn.classList.add('recording');
  setStatus('Listening…', 'listening');

  // user's bubble first, so it sits above the reply
  userBubble = addBubble('user', 'You');
  setBubbleText(userBubble, '…');

  ws.send(JSON.stringify({ type: 'mic_start' }));
  workletNode.port.postMessage({ cmd: 'start' });
}

function stopTalking() {
  if (!recording) return;
  recording = false;
  talkBtn.classList.remove('recording');
  setStatus('Thinking…');
  // tell the worklet to flush; it will post {ended} which sends mic_end for us
  workletNode?.port.postMessage({ cmd: 'stop' });
}

talkBtn.addEventListener('mousedown', startTalking);
talkBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startTalking(); }, { passive: false });
window.addEventListener('mouseup', stopTalking);
talkBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopTalking(); }, { passive: false });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    startTalking();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    stopTalking();
  }
});

// ---- base64 <-> bytes --------------------------------------------------------
function base64FromBytes(bytes) {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

function bytesFromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

connect();
