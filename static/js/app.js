/* SpeakSpace - Real-time WebRTC, Device Previews, Speech-to-Text & SpeakSpace AI Coach */

const $ = (id) => document.getElementById(id);

// Toast notification helper
function showToast(message, icon = '✦') {
  const toast = $('toast');
  if (!toast) return;
  const toastIcon = $('toastIcon');
  const toastMsg = $('toastMsg');
  if (toastIcon) toastIcon.textContent = icon;
  if (toastMsg) toastMsg.textContent = message;
  toast.style.display = 'flex';
  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.style.display = 'none';
  }, 3200);
}

// Random Room Code Generator
const CODE_PREFIXES = ['SPEAK', 'TALK', 'FLUENT', 'CHAT', 'CONVO', 'PRACTICE', 'ECHO', 'VOICE'];
const CODE_SUFFIXES = ['BREEZE', 'STARS', 'RIVER', 'COAST', 'SPARK', 'WAVE', 'EAGLE', 'HARBOR'];
function generateRandomRoomCode() {
  const p = CODE_PREFIXES[Math.floor(Math.random() * CODE_PREFIXES.length)];
  const s = CODE_SUFFIXES[Math.floor(Math.random() * CODE_SUFFIXES.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${p}-${s}-${num}`;
}

// API helper
async function api(url, options = {}) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Request failed.');
  return body;
}

// Device Preview Helper (for create.html and join.html)
let previewStream = null;
let previewAudioCtx = null;
let previewAnalyser = null;
let previewAnimFrame = null;

async function startDevicePreview(videoEl, fallbackEl, meterFillEl, statusTextEl) {
  try {
    if (statusTextEl) statusTextEl.textContent = 'Requesting camera & mic…';
    if (previewStream) {
      previewStream.getTracks().forEach(t => t.stop());
    }
    previewStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: { echoCancellation: true, noiseSuppression: true }
    });

    if (videoEl) {
      videoEl.srcObject = previewStream;
      videoEl.style.display = 'block';
    }
    if (fallbackEl) fallbackEl.style.display = 'none';
    if (statusTextEl) statusTextEl.textContent = 'Devices connected';

    // Audio meter visualizer
    if (meterFillEl) {
      previewAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = previewAudioCtx.createMediaStreamSource(previewStream);
      previewAnalyser = previewAudioCtx.createAnalyser();
      previewAnalyser.fftSize = 64;
      source.connect(previewAnalyser);
      const dataArray = new Uint8Array(previewAnalyser.frequencyBinCount);

      function updateMeter() {
        if (!previewAnalyser) return;
        previewAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const pct = Math.min(100, Math.round((avg / 128) * 100));
        meterFillEl.style.width = `${pct}%`;
        previewAnimFrame = requestAnimationFrame(updateMeter);
      }
      updateMeter();
    }
    showToast('Camera and microphone ready!', '✅');
  } catch (err) {
    if (statusTextEl) statusTextEl.textContent = 'Permission denied or device missing';
    showToast('Could not access camera/mic. Check browser permissions.', '⚠️');
    console.warn('Device preview error:', err);
  }
}

async function testDevice(kind) {
  const cameraBtn = $('testCameraBtn');
  const micBtn = $('testMicBtn');
  const statusText = $('deviceStatusText');
  const constraints = kind === 'camera'
    ? { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }
    : { video: false, audio: { echoCancellation: true, noiseSuppression: true } };

  try {
    if (statusText) statusText.textContent = `Testing ${kind}…`;
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const oldTracks = (previewStream?.getTracks() || []).filter(track => track.kind === (kind === 'camera' ? 'video' : 'audio'));
    oldTracks.forEach(track => track.stop());
    if (!previewStream) previewStream = new MediaStream();
    previewStream.addTrack(stream.getTracks()[0]);

    if (kind === 'camera') {
      const video = $('previewVideo');
      if (video) {
        video.srcObject = previewStream;
        video.style.display = 'block';
      }
      if ($('previewFallback')) $('previewFallback').style.display = 'none';
      if (cameraBtn) cameraBtn.classList.add('active');
    } else {
      previewAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = previewAudioCtx.createMediaStreamSource(new MediaStream([stream.getAudioTracks()[0]]));
      previewAnalyser = previewAudioCtx.createAnalyser();
      previewAnalyser.fftSize = 64;
      source.connect(previewAnalyser);
      const dataArray = new Uint8Array(previewAnalyser.frequencyBinCount);
      const updateMeter = () => {
        if (!previewAnalyser) return;
        previewAnalyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        if ($('audioMeterFill')) $('audioMeterFill').style.width = `${Math.min(100, Math.round((average / 128) * 100))}%`;
        previewAnimFrame = requestAnimationFrame(updateMeter);
      };
      updateMeter();
      if (micBtn) micBtn.classList.add('active');
    }
    if (statusText) statusText.textContent = `${kind === 'camera' ? 'Camera' : 'Microphone'} test passed`;
    showToast(`${kind === 'camera' ? 'Camera' : 'Microphone'} is ready`, '✅');
  } catch (err) {
    if (statusText) statusText.textContent = `${kind === 'camera' ? 'Camera' : 'Microphone'} test failed`;
    showToast(`Could not access the ${kind}. Check browser permissions.`, '⚠️');
    console.warn(`${kind} test error:`, err);
  }
}

function cleanupDevicePreview() {
  if (previewAnimFrame) cancelAnimationFrame(previewAnimFrame);
  if (previewStream) {
    previewStream.getTracks().forEach(t => t.stop());
    previewStream = null;
  }
  if (previewAudioCtx && previewAudioCtx.state !== 'closed') {
    previewAudioCtx.close().catch(() => {});
  }
}

// --------------------------------------------------------------------------
// 1. Create Page Flow (create.html)
// --------------------------------------------------------------------------
function initCreatePage() {
  const hostNameInput = $('hostName');
  const roomCodeDisplay = $('roomCodeDisplay');
  const roomCodeHidden = $('roomCode');
  const randomizeBtn = $('randomizeCodeBtn');
  const copyCodeBtn = $('copyCodeBtn');
  const conversationFocus = $('conversationFocus');
  const customTopic = $('customTopic');

  // Prepopulate saved display name
  const savedName = localStorage.getItem('speakspace_name') || '';
  if (hostNameInput) hostNameInput.value = savedName;

  // Generate initial room code
  const initialCode = generateRandomRoomCode();
  if (roomCodeDisplay) roomCodeDisplay.textContent = initialCode;
  if (roomCodeHidden) roomCodeHidden.value = initialCode;

  if (randomizeBtn) {
    randomizeBtn.addEventListener('click', () => {
      const newCode = generateRandomRoomCode();
      if (roomCodeDisplay) roomCodeDisplay.textContent = newCode;
      if (roomCodeHidden) roomCodeHidden.value = newCode;
    });
  }

  if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', () => {
      const code = roomCodeHidden.value;
      navigator.clipboard.writeText(code).then(() => {
        showToast(`Room code ${code} copied!`, '📋');
      });
    });
  }

  if (conversationFocus) conversationFocus.addEventListener('change', () => {
    if (customTopic) customTopic.style.display = conversationFocus.value === 'custom' ? 'block' : 'none';
  });
  if ($('testCameraBtn')) $('testCameraBtn').addEventListener('click', () => testDevice('camera'));
  if ($('testMicBtn')) $('testMicBtn').addEventListener('click', () => testDevice('mic'));
}

function launchRoom() {
  const name = $('hostName').value.trim() || 'Host';
  const code = $('roomCode').value.trim().toUpperCase();
  if (code.length < 3) return alert('Room code must be at least 3 characters.');
  localStorage.setItem('speakspace_name', name);
  cleanupDevicePreview();
  const selectedTopic = $('conversationFocus')?.value === 'custom'
    ? $('customTopic')?.value.trim()
    : $('conversationFocus')?.value;
  const topicParam = selectedTopic ? `&topic=${encodeURIComponent(selectedTopic)}` : '';
  window.location.href = `/room/${encodeURIComponent(code)}?name=${encodeURIComponent(name)}${topicParam}`;
}

// --------------------------------------------------------------------------
// 2. Join Page Flow (join.html)
// --------------------------------------------------------------------------
function initJoinPage() {
  const nameInput = $('participantName');
  const codeInput = $('joinRoomCode');

  const savedName = localStorage.getItem('speakspace_name') || '';
  if (nameInput && !nameInput.value) nameInput.value = savedName;

  // Auto-uppercase room code as user types
  if (codeInput) {
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    });
  }

  if ($('testCameraBtn')) $('testCameraBtn').addEventListener('click', () => testDevice('camera'));
  if ($('testMicBtn')) $('testMicBtn').addEventListener('click', () => testDevice('mic'));
}

function proceedToRoom() {
  const name = $('participantName').value.trim() || 'Guest';
  const code = $('joinRoomCode').value.trim().toUpperCase();
  if (code.length < 3) return alert('Please enter a valid room code with at least 3 characters.');
  localStorage.setItem('speakspace_name', name);
  cleanupDevicePreview();
  window.location.href = `/room/${encodeURIComponent(code)}?name=${encodeURIComponent(name)}`;
}

// --------------------------------------------------------------------------
// 3. Live Practice Room Flow (room.html)
// --------------------------------------------------------------------------
const state = {
  peerId: crypto.randomUUID(),
  room: '',
  name: 'You',
  partner: null,
  pc: null,
  chatChannel: null,
  screenTrack: null,
  stream: null,
  polling: null,
  recording: false,
  recorderNode: null,
  audioContext: null,
  audioChunks: [],
  fileTransfers: new Map(),
  topic: 0
  ,customTopic: ''
};

const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const CHAT_FILE_MAX_BYTES = 10 * 1024 * 1024;
const CHAT_FILE_CHUNK_SIZE = 16 * 1024;

function setCallStatus(text, connected = false) {
  const statusEl = $('callStatus');
  const textEl = $('callStatusText');
  if (!statusEl || !textEl) return;
  const dot = statusEl.querySelector('.status-dot');
  if (dot) dot.classList.toggle('active', connected);
  textEl.textContent = text;
}

function showTopic() {
  if (state.customTopic) {
    if ($('topicNumber')) $('topicNumber').textContent = '★';
    if ($('topicTitle')) $('topicTitle').textContent = state.customTopic;
    if ($('topicPrompt')) $('topicPrompt').textContent = `Discuss ${state.customTopic} together.`;
    return;
  }
  const topics = window.PRACTICE_TOPICS || [];
  const topic = topics[state.topic];
  if (!topic) return;
  if ($('topicNumber')) $('topicNumber').textContent = String(state.topic + 1).padStart(2, '0');
  if ($('topicTitle')) $('topicTitle').textContent = topic.title;
  if ($('topicPrompt')) $('topicPrompt').textContent = topic.prompt;
}

async function getMedia() {
  if (state.stream) return state.stream;
  state.stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: { echoCancellation: true, noiseSuppression: true }
  });
  if ($('localVideo')) {
    $('localVideo').srcObject = state.stream;
    $('localVideo').style.display = 'block';
  }
  if ($('localFallback')) $('localFallback').style.display = 'none';
  if ($('cameraBtn')) $('cameraBtn').disabled = false;
  if ($('micBtn')) $('micBtn').disabled = false;
  if ($('recordBtn')) $('recordBtn').disabled = false;
  return state.stream;
}

function clearChatEmptyState() {
  $('chatMessages')?.querySelector('.chat-empty')?.remove();
}

function addChatMessage(text, sender, own = false) {
  const messages = $('chatMessages');
  if (!messages) return;
  clearChatEmptyState();
  const message = document.createElement('div');
  message.className = `chat-message${own ? ' own' : ''}`;
  const author = document.createElement('strong');
  author.textContent = own ? 'You' : sender;
  const content = document.createElement('span');
  content.textContent = text;
  message.append(author, content);
  messages.appendChild(message);
  messages.scrollTop = messages.scrollHeight;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function addChatFileMessage(file, sender, own = false) {
  const messages = $('chatMessages');
  if (!messages) return;
  clearChatEmptyState();
  const message = document.createElement('div');
  message.className = `chat-message${own ? ' own' : ''}`;
  const author = document.createElement('strong');
  author.textContent = own ? 'You' : sender;
  const link = document.createElement('a');
  link.className = 'chat-file-link';
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  link.textContent = `📎 ${file.name} (${formatFileSize(file.size)})`;
  message.append(author, link);
  messages.appendChild(message);
  messages.scrollTop = messages.scrollHeight;
}

function setChatControlsEnabled(enabled) {
  if ($('chatInput')) $('chatInput').disabled = !enabled;
  if ($('chatSendBtn')) $('chatSendBtn').disabled = !enabled;
  if ($('chatAttachBtn')) $('chatAttachBtn').disabled = !enabled;
}

function waitForChatBuffer(channel) {
  return new Promise(resolve => {
    const check = () => {
      if (channel.bufferedAmount <= CHAT_FILE_CHUNK_SIZE * 8) resolve();
      else setTimeout(check, 20);
    };
    check();
  });
}

function setupChatChannel(channel) {
  state.chatChannel = channel;
  channel.binaryType = 'arraybuffer';
  channel.onopen = () => {
    if ($('chatStatus')) $('chatStatus').textContent = 'Connected';
    setChatControlsEnabled(true);
  };
  channel.onclose = () => {
    if ($('chatStatus')) $('chatStatus').textContent = 'Disconnected';
    setChatControlsEnabled(false);
  };
  channel.onmessage = async (event) => {
    if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
      const transfer = state.fileTransfers.get(state.activeFileTransferId);
      if (!transfer) return;
      transfer.chunks.push(event.data instanceof Blob ? await event.data.arrayBuffer() : event.data);
      transfer.received += transfer.chunks.at(-1).byteLength;
      return;
    }
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'file-start') {
        if (message.size > CHAT_FILE_MAX_BYTES) return;
        state.activeFileTransferId = message.id;
        state.fileTransfers.set(message.id, {
          chunks: [],
          received: 0,
          name: message.name,
          size: message.size,
          mime: message.mime || 'application/octet-stream',
          sender: message.sender || 'Partner'
        });
      } else if (message.type === 'file-end') {
        const transfer = state.fileTransfers.get(message.id);
        if (!transfer || transfer.received !== transfer.size) return;
        const file = new File(transfer.chunks, transfer.name, { type: transfer.mime });
        addChatFileMessage(file, transfer.sender);
        state.fileTransfers.delete(message.id);
        state.activeFileTransferId = null;
      } else {
        addChatMessage(message.text, message.sender || 'Partner');
      }
    } catch (error) {
      console.warn('Chat message ignored', error);
    }
  };
}

function sendChatMessage() {
  const input = $('chatInput');
  const text = input?.value.trim();
  if (!text || !state.chatChannel || state.chatChannel.readyState !== 'open') return;
  state.chatChannel.send(JSON.stringify({ text, sender: state.name }));
  addChatMessage(text, state.name, true);
  input.value = '';
  input.focus();
}

async function sendChatFile(file) {
  const channel = state.chatChannel;
  if (!file || !channel || channel.readyState !== 'open') return;
  if (file.size > CHAT_FILE_MAX_BYTES) {
    showToast('Files must be 10 MB or smaller.', '⚠️');
    return;
  }
  const id = crypto.randomUUID();
  try {
    channel.send(JSON.stringify({
      type: 'file-start',
      id,
      name: file.name,
      size: file.size,
      mime: file.type,
      sender: state.name
    }));
    const data = await file.arrayBuffer();
    for (let offset = 0; offset < data.byteLength; offset += CHAT_FILE_CHUNK_SIZE) {
      await waitForChatBuffer(channel);
      channel.send(data.slice(offset, offset + CHAT_FILE_CHUNK_SIZE));
    }
    channel.send(JSON.stringify({ type: 'file-end', id }));
    addChatFileMessage(file, state.name, true);
  } catch (error) {
    console.warn('File transfer failed:', error);
    showToast('Could not send that file.', '⚠️');
  }
}

function makePeerConnection() {
  if (state.pc) return state.pc;
  const pc = new RTCPeerConnection(rtcConfig);
  state.pc = pc;
  pc.ondatachannel = ({ channel }) => setupChatChannel(channel);
  if (state.stream) {
    state.stream.getTracks().forEach(track => pc.addTrack(track, state.stream));
  }
  pc.onicecandidate = ({ candidate }) => {
    if (candidate && state.partner) {
      signal({ type: 'candidate', candidate: candidate.toJSON() });
    }
  };
  pc.ontrack = ({ streams }) => {
    if ($('remoteVideo')) {
      $('remoteVideo').srcObject = streams[0];
      $('remoteVideo').style.display = 'block';
    }
    if ($('remoteFallback')) $('remoteFallback').style.display = 'none';
    setCallStatus(`${state.partner?.name || 'Partner'} connected`, true);
  };
  pc.onconnectionstatechange = () => {
    if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
      setCallStatus('Partner disconnected', false);
      if ($('remoteFallback')) {
        $('remoteFallback').style.display = 'flex';
        $('remoteStatusMessage').textContent = 'Partner disconnected. Waiting to reconnect…';
      }
    }
  };
  return pc;
}

async function signal(message) {
  if (!state.room || !state.partner) return;
  await api('/api/rooms/signal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room: state.room, from: state.peerId, to: state.partner.id, message })
  });
}

async function offerPeer() {
  const pc = makePeerConnection();
  if (!state.chatChannel) setupChatChannel(pc.createDataChannel('speakspace-chat'));
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await signal({ type: 'offer', sdp: offer.sdp });
  setCallStatus('Calling partner…');
}

async function handleSignal(packet) {
  state.partner = { id: packet.from, name: state.partner?.name || 'Practice partner' };
  if ($('partnerLabel')) $('partnerLabel').textContent = state.partner.name;
  const pc = makePeerConnection();
  const msg = packet.message;
  if (msg.type === 'offer') {
    await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await signal({ type: 'answer', sdp: answer.sdp });
    setCallStatus('Connecting…');
  } else if (msg.type === 'answer') {
    await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
  } else if (msg.type === 'candidate' && msg.candidate) {
    try {
      await pc.addIceCandidate(msg.candidate);
    } catch (e) {
      console.warn('ICE candidate ignored', e);
    }
  }
}

function shouldCreateOffer() {
  return state.partner && state.peerId.localeCompare(state.partner.id) < 0;
}

async function poll() {
  if (!state.room) return;
  try {
    const data = await api(`/api/rooms/poll?room=${encodeURIComponent(state.room)}&peerId=${encodeURIComponent(state.peerId)}`);
    const peer = data.peers[0];
    if (peer && !state.partner) {
      state.partner = peer;
      if ($('partnerLabel')) $('partnerLabel').textContent = peer.name;
      if (shouldCreateOffer()) await offerPeer();
    }
    for (const packet of data.signals) {
      await handleSignal(packet);
    }
  } catch (err) {
    console.warn('Poll error:', err.message);
  }
}

function startPolling() {
  clearInterval(state.polling);
  poll();
  state.polling = setInterval(poll, 1800);
}

async function initRoomPage() {
  const roomCode = window.ROOM_CODE || '';
  if (!roomCode) {
    window.location.href = '/join';
    return;
  }
  state.room = roomCode;

  // Extract display name
  const urlParams = new URLSearchParams(window.location.search);
  const nameFromUrl = urlParams.get('name');
  state.customTopic = urlParams.get('topic')?.trim() || '';
  const storedName = localStorage.getItem('speakspace_name');
  state.name = (nameFromUrl || storedName || 'You').trim();
  if ($('localUserLabel')) $('localUserLabel').textContent = state.name;

  // Topic switcher
  showTopic();
  if ($('nextTopic')) {
    $('nextTopic').addEventListener('click', () => {
      const topics = window.PRACTICE_TOPICS || [];
      state.topic = (state.topic + 1) % (topics.length || 1);
      showTopic();
    });
  }

  // Copy buttons
  const copyInvite = () => {
    const joinUrl = `${window.location.origin}/join?code=${encodeURIComponent(state.room)}`;
    navigator.clipboard.writeText(joinUrl).then(() => {
      showToast('Invite link copied to clipboard!', '📋');
    }).catch(() => {
      navigator.clipboard.writeText(state.room).then(() => {
        showToast(`Room code ${state.room} copied!`, '📋');
      });
    });
  };
  if ($('copyInviteBtn')) $('copyInviteBtn').addEventListener('click', copyInvite);
  if ($('copyShareBtn')) $('copyShareBtn').addEventListener('click', copyInvite);

  // Initialize camera and join room
  try {
    setCallStatus('Connecting to room…');
    const data = await api('/api/rooms/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: state.name, room: state.room, peerId: state.peerId })
    });
    state.partner = data.peers[0] || null;
    if (state.partner && $('partnerLabel')) {
      $('partnerLabel').textContent = state.partner.name;
    }
  } catch (err) {
    setCallStatus(`Error: ${err.message}`);
    showToast(err.message, '⚠️');
  }

  // Device permissions should not prevent the peer from joining the room.
  try {
    setCallStatus(state.partner ? 'Starting camera & audio…' : 'Waiting for more people (1/5)');
    await getMedia();
  } catch (err) {
    console.warn('Media setup failed:', err);
    showToast('Joined without camera or microphone. Check browser permissions.', '⚠️');
  }
  setCallStatus(state.partner ? 'Connecting to partner…' : 'Waiting for more people (1/5)');
  startPolling();
  if (shouldCreateOffer()) await offerPeer();
  showToast(`Joined room ${state.room}`, '🎉');

  // Camera & Mic toggles
  if ($('cameraBtn')) $('cameraBtn').addEventListener('click', toggleCamera);
  if ($('micBtn')) $('micBtn').addEventListener('click', toggleMic);
  if ($('shareMediaBtn')) $('shareMediaBtn').addEventListener('click', toggleMediaShare);
  if ($('hangupBtn')) $('hangupBtn').addEventListener('click', leaveRoom);
  if ($('leaveBtn')) $('leaveBtn').addEventListener('click', leaveRoom);

  // Audio recording buttons
  if ($('recordBtn')) $('recordBtn').addEventListener('click', startBrowserRecording);
  if ($('stopBtn')) $('stopBtn').addEventListener('click', stopBrowserRecording);
  if ($('checkTextBtn')) $('checkTextBtn').addEventListener('click', () => {
    checkGrammar($('manualTranscript')?.value || '');
  });
  if ($('chatForm')) $('chatForm').addEventListener('submit', (event) => {
    event.preventDefault();
    sendChatMessage();
  });
  if ($('chatAttachBtn')) $('chatAttachBtn').addEventListener('click', () => $('chatFileInput')?.click());
  if ($('chatFileInput')) $('chatFileInput').addEventListener('change', async (event) => {
    await sendChatFile(event.target.files[0]);
    event.target.value = '';
  });
}

function leaveRoom() {
  if (state.room) {
    navigator.sendBeacon('/api/rooms/leave', new Blob([JSON.stringify({ room: state.room, peerId: state.peerId })], { type: 'application/json' }));
  }
  clearInterval(state.polling);
  if (state.screenTrack) stopMediaShare();
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
  }
  state.pc?.close();
  state.pc = null;
  window.location.href = '/';
}
window.addEventListener('beforeunload', leaveRoom);

async function toggleCamera() {
  const btn = $('cameraBtn');
  const videoTrack = state.stream?.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.stop();
    state.stream.removeTrack(videoTrack);
    const sender = state.pc?.getSenders().find(s => s.track === videoTrack || s.track?.kind === 'video');
    if (sender) {
      try { await sender.replaceTrack(null); } catch (e) { console.warn(e); }
    }
    if (btn) btn.classList.add('muted');
    if ($('localVideo')) $('localVideo').style.display = 'none';
    if ($('localFallback')) $('localFallback').style.display = 'flex';
  } else {
    try {
      if (btn) btn.disabled = true;
      const media = await navigator.mediaDevices.getUserMedia({ video: true });
      const newTrack = media.getVideoTracks()[0];
      if (!state.stream) state.stream = new MediaStream();
      state.stream.addTrack(newTrack);
      if ($('localVideo')) {
        $('localVideo').srcObject = state.stream;
        $('localVideo').style.display = 'block';
      }
      if ($('localFallback')) $('localFallback').style.display = 'none';
      const sender = state.pc?.getSenders().find(s => s.track === null || s.track?.kind === 'video');
      if (sender) {
        try { await sender.replaceTrack(newTrack); } catch (e) { console.warn(e); }
      } else if (state.pc) {
        state.pc.addTrack(newTrack, state.stream);
      }
      if (btn) btn.classList.remove('muted');
    } catch (err) {
      console.error('Could not restart camera:', err);
      showToast('Could not restart camera.', '⚠️');
    } finally {
      if (btn) btn.disabled = false;
    }
  }
}

function toggleMic() {
  const btn = $('micBtn');
  const track = state.stream?.getAudioTracks()[0];
  if (track) {
    track.enabled = !track.enabled;
    if (btn) btn.classList.toggle('muted', !track.enabled);
    const ind = $('localAudioIndicator');
    if (ind) ind.style.color = track.enabled ? 'var(--emerald-400)' : 'var(--rose-500)';
    showToast(track.enabled ? 'Microphone active' : 'Microphone muted', track.enabled ? '🎙️' : '🔇');
  }
}

async function toggleMediaShare() {
  const btn = $('shareMediaBtn');
  if (state.screenTrack) {
    stopMediaShare();
    return;
  }

  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const screenTrack = displayStream.getVideoTracks()[0];
    const sender = state.pc?.getSenders().find(item => item.track?.kind === 'video');
    if (!sender || !screenTrack) {
      displayStream.getTracks().forEach(track => track.stop());
      showToast('Join a connected room before sharing media.', '⚠️');
      return;
    }
    await sender.replaceTrack(screenTrack);
    state.screenTrack = screenTrack;
    if ($('localVideo')) {
      $('localVideo').srcObject = new MediaStream([screenTrack]);
      $('localVideo').style.display = 'block';
    }
    if ($('localFallback')) $('localFallback').style.display = 'none';
    if (btn) {
      btn.classList.add('active');
      btn.textContent = '⏹️';
      btn.title = 'Stop sharing media';
    }
    screenTrack.onended = stopMediaShare;
    showToast('Media sharing is on', '🖥️');
  } catch (err) {
    if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
      console.warn('Media sharing failed:', err);
      showToast('Could not start media sharing.', '⚠️');
    }
  }
}

async function stopMediaShare() {
  const screenTrack = state.screenTrack;
  if (!screenTrack) return;
  screenTrack.onended = null;
  screenTrack.stop();
  state.screenTrack = null;
  const cameraTrack = state.stream?.getVideoTracks()[0] || null;
  const sender = state.pc?.getSenders().find(item => item.track?.kind === 'video' || item.track === screenTrack);
  if (sender) await sender.replaceTrack(cameraTrack);
  if ($('localVideo')) {
    $('localVideo').srcObject = state.stream || null;
    $('localVideo').style.display = cameraTrack ? 'block' : 'none';
  }
  if ($('localFallback')) $('localFallback').style.display = cameraTrack ? 'none' : 'flex';
  const btn = $('shareMediaBtn');
  if (btn) {
    btn.classList.remove('active');
    btn.textContent = '🖥️';
    btn.title = 'Share screen or media';
  }
}

// --------------------------------------------------------------------------
// Browser Speech Recognition
// --------------------------------------------------------------------------
function startBrowserRecording() {
  if (!state.stream) return showToast('Microphone stream not available.', '⚠️');
  state.audioChunks = [];
  state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = state.audioContext.createMediaStreamSource(state.stream);
  state.recorderNode = state.audioContext.createScriptProcessor(4096, 1, 1);
  state.recorderNode.onaudioprocess = (e) => {
    state.audioChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };
  source.connect(state.recorderNode);
  state.recorderNode.connect(state.audioContext.destination);

  state.recording = true;
  if ($('recordBtn')) $('recordBtn').classList.add('recording');
  if ($('recordBtn')) $('recordBtn').disabled = true;
  if ($('stopBtn')) $('stopBtn').disabled = false;
  if ($('recordingState')) $('recordingState').textContent = 'Recording…';
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

async function stopBrowserRecording() {
  if (!state.recording) return;
  state.recording = false;
  state.recorderNode.disconnect();
  const sampleRate = state.audioContext.sampleRate;
  await state.audioContext.close();

  const length = state.audioChunks.reduce((n, c) => n + c.length, 0);
  const samples = new Float32Array(length);
  let offset = 0;
  state.audioChunks.forEach(c => { samples.set(c, offset); offset += c.length; });

  if ($('recordBtn')) $('recordBtn').classList.remove('recording');
  if ($('recordBtn')) $('recordBtn').disabled = false;
  if ($('stopBtn')) $('stopBtn').disabled = true;
  if ($('recordingState')) $('recordingState').textContent = 'Transcribing…';

  const form = new FormData();
  form.append('audio', encodeWav(samples, sampleRate), 'practice.wav');

  try {
    const data = await api('/api/transcribe', { method: 'POST', body: form });
    await useTranscript(data.transcript, 'Browser Mic STT');
  } catch (err) {
    if ($('transcript')) {
      $('transcript').textContent = err.message;
      $('transcript').classList.add('empty');
    }
    showToast(err.message, '⚠️');
  } finally {
    if ($('recordingState')) $('recordingState').textContent = 'Ready';
  }
}

async function useTranscript(transcript, source = '') {
  const transcriptEl = $('transcript');
  if (transcriptEl) {
    transcriptEl.textContent = transcript;
    transcriptEl.classList.remove('empty');
  }
  if ($('manualTranscript')) $('manualTranscript').value = transcript;
  if (source && $('recordingState')) $('recordingState').textContent = source;
  await checkGrammar(transcript);
}

// --------------------------------------------------------------------------
// SpeakSpace AI Grammar & Feedback
// --------------------------------------------------------------------------
function escapeHtml(value) {
  const el = document.createElement('div');
  el.textContent = value || '';
  return el.innerHTML;
}

async function checkGrammar(text) {
  const cleaned = text.trim();
  if (!cleaned) return showToast('Please provide speech or text to check.', 'ℹ️');

  const checkBtn = $('checkTextBtn');
  if (checkBtn) checkBtn.disabled = true;
  if ($('feedbackEmpty')) $('feedbackEmpty').hidden = true;
  if ($('feedbackContent')) $('feedbackContent').hidden = false;
  if ($('correctedText')) $('correctedText').textContent = 'Analyzing your sentence…';
  if ($('feedbackSummary')) $('feedbackSummary').textContent = '';
  if ($('issuesList')) $('issuesList').replaceChildren();

  try {
    const data = await api('/api/grammar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: cleaned })
    });
    const feedback = data.feedback;
    if ($('correctedText')) $('correctedText').textContent = feedback.corrected;
    if ($('feedbackSummary')) $('feedbackSummary').textContent = feedback.summary;

    const issuesList = $('issuesList');
    if (issuesList) {
      issuesList.replaceChildren();
      if (feedback.issues && feedback.issues.length > 0) {
        feedback.issues.forEach(issue => {
          const item = document.createElement('div');
          item.className = 'issue-item';

          const diffRow = document.createElement('div');
          diffRow.className = 'issue-diff';
          diffRow.innerHTML = `<del>${escapeHtml(issue.original)}</del> <span>→</span> <ins>${escapeHtml(issue.correction)}</ins>`;

          const exp = document.createElement('p');
          exp.textContent = issue.explanation;

          item.append(diffRow, exp);
          issuesList.append(item);
        });
      } else {
        const perfectMsg = document.createElement('div');
        perfectMsg.className = 'issue-item';
        perfectMsg.innerHTML = '<span style="color: var(--emerald-400); font-weight: 600;">✨ Great job! No grammatical errors found in this sentence.</span>';
        issuesList.append(perfectMsg);
      }
    }
    showToast('AI Feedback ready!', '✦');
  } catch (err) {
    if ($('correctedText')) $('correctedText').textContent = 'Feedback currently unavailable';
    if ($('feedbackSummary')) $('feedbackSummary').textContent = err.message;
    showToast(err.message, '⚠️');
  } finally {
    if (checkBtn) checkBtn.disabled = false;
  }
}
