const socket = io();
const app = document.getElementById('app');
const toast = document.getElementById('toast');
let mode = null, roomCode = null, playerId = null, room = null, submittedLocal = false;

const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function notify(message) { toast.textContent = message; toast.classList.add('show'); clearTimeout(notify.t); notify.t = setTimeout(() => toast.classList.remove('show'), 2800); }
function shell(content, cls='') { app.innerHTML = `<div class="page ${cls}">${content}</div>`; }
function logo() { return `<div class="brand"><span class="brand-mark">S</span><span>SUSTAINI<span class="brand-dash">-</span>FEUD</span></div>`; }
function home() {
  mode = null; room = null; roomCode = null; submittedLocal = false;
  shell(`<section class="hero"><div class="eyebrow">SUSTAINICITY / LIVE GAME</div>${logo()}<h1>Think green.<br><em>Think fast.</em><br>Take the board.</h1><p class="hero-copy">A fast, sustainability-themed showdown where every answer counts.</p><div class="home-actions"><button class="btn btn-primary" onclick="hostGame()">HOST A GAME <span>↗</span></button><button class="btn btn-secondary" onclick="showJoin()">JOIN A GAME <span>→</span></button></div><div class="rules"><span>6 ANSWERS</span><i></i><span>50 / 40 / 30 / 20 / 10 / 5</span><i></i><span>1 ATTEMPT EACH</span></div></section>`);
}
function showJoin() {
  shell(`<section class="form-page"><div class="form-card">${logo()}<div class="eyebrow">PLAYER ENTRY</div><h2>Join the room.</h2><p>Enter the code on the host screen, then choose your name.</p><form onsubmit="joinGame(event)"><label>ROOM CODE<input id="join-code" maxlength="5" autocomplete="off" placeholder="A7K92" required /></label><label>NAME<input id="join-name" maxlength="18" autocomplete="off" placeholder="Preet" required /></label><button class="btn btn-primary full">JOIN GAME <span>→</span></button></form><button class="text-btn" onclick="home()">← Back</button></div></section>`);
}
function hostGame() { socket.emit('host:create'); }
function joinGame(e) { e.preventDefault(); roomCode = document.getElementById('join-code').value.trim().toUpperCase(); const name = document.getElementById('join-name').value.trim(); socket.emit('player:join', { code: roomCode, name }); }
function hostLobby() {
  shell(`<section class="dashboard"><header>${logo()}<div class="room-chip">ROOM <strong>${esc(roomCode)}</strong></div></header><div class="lobby-grid"><div class="lobby-main"><div class="eyebrow">HOST CONTROL</div><h1>Your room is live.</h1><p class="muted">Share this five-character code with your players.</p><div class="code-card"><span>ROOM CODE</span><strong>${esc(roomCode)}</strong><button onclick="navigator.clipboard?.writeText('${esc(roomCode)}');notify('Room code copied')">COPY CODE</button></div><button class="btn btn-primary start-btn" onclick="startRound()">START ROUND <span>→</span></button></div><aside class="players-panel"><div class="panel-head"><span>PLAYERS</span><b>${room?.players?.length || 0}</b></div><div class="player-list">${(room?.players || []).map(p => `<div class="player-row"><span class="avatar">${esc(p.name.slice(0,1).toUpperCase())}</span><strong>${esc(p.name)}</strong><span class="live-dot"></span></div>`).join('') || `<div class="empty-state">Waiting for players…<small>They will appear here instantly.</small></div>`}</div></aside></div></section>`);
}
function startRound() { socket.emit('host:start', { code: roomCode }); }
function answerBoardHost() {
  const q = room.question;
  return `<div class="answer-board">${[...Array(6)].map((_,i) => { const a=q?.answers?.[i]; const rev=room.revealed?.includes(i); const disabled=rev || !room.submittedAnswer || room.resolved; return `<button class="answer-card ${rev?'revealed':''} ${i===0?'top-answer':''}" ${disabled?'disabled':''} onclick="award(${i})"><span class="answer-num">${String(i+1).padStart(2,'0')}</span><span class="answer-text">${rev?esc(a.text):'<span class="hidden-answer">████████████</span>'}</span><span class="answer-points">${a.points}</span></button>`; }).join('')}</div>`;
}
function hostGameScreen() {
  const current = room.players?.find(p => p.id === room.currentPlayerId);
  const canResolve = !!room.submittedAnswer && !room.resolved;
  shell(`<section class="dashboard game-dashboard"><header>${logo()}<div class="room-chip">ROOM <strong>${esc(roomCode)}</strong></div></header><div class="game-grid"><main class="game-main"><div class="question-top"><div><div class="eyebrow">ROUND IN PLAY</div><h1>${esc(room.question.question)}</h1></div><div class="round-status">${room.revealed.length}/6 REVEALED</div></div>${answerBoardHost()}<div class="turn-panel"><div class="turn-meta"><span>CURRENT PLAYER</span><strong>${esc(current?.name || '—')}</strong></div><div class="submission"><span>PLAYER ANSWER</span><div class="submitted-answer">${room.submittedAnswer ? `“${esc(room.submittedAnswer)}”` : '<span class="waiting-answer">Waiting for answer…</span>'}</div></div><div class="host-actions"><button class="btn btn-wrong" ${canResolve?'':'disabled'} onclick="wrong()">WRONG / 0</button><button class="btn btn-primary" ${room.resolved?'':'disabled'} onclick="nextPlayer()">NEXT PLAYER <span>→</span></button></div></div></main><aside class="scores"><div class="panel-head"><span>LIVE SCORES</span><b>${room.players?.length || 0}</b></div>${(room.players||[]).map((p,i)=>`<div class="score-row ${p.id===room.currentPlayerId?'active':''}"><span class="rank">${String(i+1).padStart(2,'0')}</span><strong>${esc(p.name)}</strong><b>${p.score}</b></div>`).join('')}<div class="score-note">Scores update live for the host.</div></aside></div></section>`);
}
function award(index) { socket.emit('host:resolve', { code: roomCode, answerIndex:index }); }
function wrong() { socket.emit('host:wrong', { code: roomCode }); }
function nextPlayer() { socket.emit('host:next', { code: roomCode }); }
function playerView() {
  const me = room?.players?.find(p => p.id === playerId);
  const myTurn = room?.currentPlayerId === playerId && room.status === 'playing';
  const ended = room?.status === 'ended';
  shell(`<section class="player-page"><div class="player-card">${logo()}${ended?`<div class="eyebrow">ROUND COMPLETE</div><h1>Nice run, ${esc(me?.name || '')}.</h1><div class="final-score"><span>YOUR SCORE</span><strong>${me?.score ?? 0}</strong></div><p>Watch the host screen for the final board.</p><button class="text-btn" onclick="home()">Leave game</button>`:room?.status==='host-disconnected'?`<div class="eyebrow">CONNECTION ENDED</div><h1>Host disconnected.</h1><p>The host ended their connection. You can safely leave this room.</p><button class="text-btn" onclick="home()">Back to home</button>`:myTurn?`<div class="turn-badge">YOUR TURN</div><div class="player-question">${esc(room.question.question)}</div><form onsubmit="submitAnswer(event)" class="answer-form"><input id="player-answer" maxlength="100" autocomplete="off" placeholder="Type your answer..." ${submittedLocal?'disabled':''} required /><button class="btn btn-primary full" ${submittedLocal?'disabled':''}>${submittedLocal?'ANSWER LOCKED ✓':'LOCK IN ANSWER'}</button></form><div class="player-score">YOUR SCORE <strong>${me?.score ?? 0}</strong></div>`:`<div class="waiting-orb"><span></span></div><div class="eyebrow">${room?.status==='lobby'?'ROOM READY':'STAND BY'}</div><h1>Waiting for host…</h1><p>${room?.status==='lobby'?'The host will start the round soon.':'Your turn will appear here.'}</p><div class="player-score">YOUR SCORE <strong>${me?.score ?? 0}</strong></div>`}</div></section>`);
}
function submitAnswer(e) { e.preventDefault(); if (submittedLocal) return; const answer=document.getElementById('player-answer').value.trim(); if(!answer)return; submittedLocal=true; socket.emit('player:submit',{code:roomCode,answer}); playerView(); }
function render() { if(!mode)return; if(mode==='host') room?.status==='lobby'?hostLobby():hostGameScreen(); else playerView(); }

socket.on('host:created', d => { mode='host'; roomCode=d.code; });
socket.on('player:joined', d => { mode='player'; roomCode=d.code; playerId=d.playerId; submittedLocal=false; });
socket.on('room:update', data => { room=data; if(room.status==='host-disconnected' && mode==='player') { playerView(); return; } if(mode==='player' && room.currentPlayerId!==playerId) submittedLocal = false; render(); });
socket.on('host:disconnected', () => { if(mode==='player') { room={...(room||{}),status:'host-disconnected'}; render(); } });
socket.on('game:error', d => notify(d.message));
socket.on('connect', () => { if(!mode) home(); });

home();
