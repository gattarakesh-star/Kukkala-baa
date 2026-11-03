(() => {
  // ====== EASY SETTINGS ======
  const TITLE = 'Bone Dash';
  const PLAYER_SRC = 'assets/player.png';   // rename your pic to this (or change here)
  const MUSIC_SRC = 'assets/music.mp3';
  const GAMEOVER_SRC = 'assets/gameover.mp3';
  const PLAYER_HEIGHT = 70;   // drawn size of your pic
  const GRAVITY = 1500;       // higher = falls faster
  const FLAP = -430;          // jump strength
  const SPEED = 170;          // bone speed
  const GAP = 185;            // space between top and bottom bone
  const SPACING = 235;        // distance between bone pairs
  // ===========================

  const W = 400, H = 640, GROUND = 90, BONE_W = 40;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const FONT = "'Fredoka', 'Trebuchet MS', sans-serif";

  // ---------- assets ----------
  const img = new Image();
  let imgOk = false;
  img.onload = () => { imgOk = true; };
  img.src = PLAYER_SRC;

  const music = new Audio(MUSIC_SRC);
  music.loop = true;
  music.volume = 0.5;
  const overSnd = new Audio(GAMEOVER_SRC);
  overSnd.volume = 0.9;

  let actx = null;
  let muted = false;

  function initAudio() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) actx = new AC();
    }
    if (actx && actx.state === 'suspended') actx.resume();
  }

  function blip(type, f0, f1, dur, vol, delay = 0) {
    if (muted || !actx) return;
    const t = actx.currentTime + delay;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(actx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  const sfxFlap = () => blip('triangle', 380, 760, 0.13, 0.25);
  const sfxScore = () => { blip('square', 880, 880, 0.08, 0.12); blip('square', 1320, 1320, 0.12, 0.12, 0.08); };

  function playMusic() {
    if (muted) return;
    const p = music.play();
    if (p && p.catch) p.catch(() => {});
  }
  function stopMusic() { music.pause(); music.currentTime = 0; }

  const muteBtn = document.getElementById('mute');
  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    muted = !muted;
    muteBtn.textContent = muted ? '🔇' : '🔊';
    music.muted = muted;
    overSnd.muted = muted;
    if (!muted && state === 'playing') playMusic();
  });

  // ---------- state ----------
  let state = 'ready'; // ready | playing | over
  let score = 0;
  let best = 0;
  try { best = parseInt(localStorage.getItem('bonedash_best') || '0', 10) || 0; } catch (e) {}
  let overAt = 0;
  let groundX = 0;
  let t0 = 0;

  const player = { x: 110, y: H / 2 - 40, vy: 0, w: PLAYER_HEIGHT, h: PLAYER_HEIGHT };
  let bones = [];
  const clouds = [
    { x: 40, y: 90, s: 1 }, { x: 250, y: 160, s: 0.7 },
    { x: 360, y: 60, s: 0.85 }, { x: 150, y: 260, s: 0.6 },
  ];

  function reset() {
    score = 0;
    bones = [];
    player.y = H / 2 - 40;
    player.vy = 0;
  }

  function spawnBone() {
    const margin = 90;
    const minTop = margin;
    const maxTop = H - GROUND - GAP - margin;
    bones.push({ x: W + BONE_W, gapY: minTop + Math.random() * (maxTop - minTop), passed: false });
  }

  function flap() {
    player.vy = FLAP;
    sfxFlap();
  }

  function startGame() {
    reset();
    state = 'playing';
    stopMusic();
    playMusic();
    flap();
  }

  function gameOver() {
    state = 'over';
    overAt = performance.now();
    stopMusic();
    overSnd.currentTime = 0;
    if (!muted) { const p = overSnd.play(); if (p && p.catch) p.catch(() => {}); }
    if (score > best) {
      best = score;
      try { localStorage.setItem('bonedash_best', String(best)); } catch (e) {}
    }
  }

  function onInput(e) {
    if (e && e.target && e.target.closest && e.target.closest('#mute')) return;
    initAudio();
    if (state === 'ready') startGame();
    else if (state === 'playing') flap();
    else if (state === 'over' && performance.now() - overAt > 600) startGame();
  }

  document.addEventListener('pointerdown', (e) => { onInput(e); });
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      if (!e.repeat) onInput(null);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) music.pause();
    else if (state === 'playing') playMusic();
  });

  // ---------- update ----------
  function hitbox() {
    const bw = player.w * 0.55, bh = player.h * 0.6;
    return { x: player.x - bw / 2, y: player.y - bh / 2, w: bw, h: bh };
  }
  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function update(dt) {
    clouds.forEach((c) => { c.x -= 12 * c.s * dt; if (c.x < -90) c.x = W + 60; });

    if (state === 'ready') {
      player.y = H / 2 - 40 + Math.sin(performance.now() / 280) * 8;
      groundX = (groundX + SPEED * 0.5 * dt) % 40;
      return;
    }
    if (state === 'over') {
      // dog falls to the ground
      player.vy += GRAVITY * dt;
      player.y = Math.min(player.y + player.vy * dt, H - GROUND - player.h * 0.3);
      return;
    }

    groundX = (groundX + SPEED * dt) % 40;
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;

    const hb = hitbox();
    if (hb.y < 0) { player.y += -hb.y; player.vy = 0; }

    const last = bones[bones.length - 1];
    if (!last || last.x < W + BONE_W - SPACING) spawnBone();

    for (const b of bones) {
      b.x -= SPEED * dt;
      if (!b.passed && b.x < player.x - 10) {
        b.passed = true;
        score++;
        sfxScore();
      }
    }
    bones = bones.filter((b) => b.x > -BONE_W * 2);

    const h2 = hitbox();
    if (h2.y + h2.h > H - GROUND) return gameOver();
    for (const b of bones) {
      const top = { x: b.x - BONE_W / 2, y: -100, w: BONE_W, h: b.gapY + 4 + 100 };
      const botY = b.gapY + GAP - 4;
      const bot = { x: b.x - BONE_W / 2, y: botY, w: BONE_W, h: H - botY };
      if (overlap(h2, top) || overlap(h2, bot)) return gameOver();
    }
  }

  // ---------- draw ----------
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H - GROUND);
    g.addColorStop(0, '#6ec3f0');
    g.addColorStop(1, '#d4f1ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    clouds.forEach((c) => {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 38 * c.s, 16 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x - 22 * c.s, c.y + 5 * c.s, 24 * c.s, 12 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + 24 * c.s, c.y + 4 * c.s, 26 * c.s, 13 * c.s, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawGround() {
    const y = H - GROUND;
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(0, y, W, GROUND);
    ctx.fillStyle = '#5fb04a';
    ctx.fillRect(0, y, W, 22);
    ctx.fillStyle = '#4a9238';
    for (let x = -groundX; x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, y + 22);
      ctx.lineTo(x + 10, y + 22);
      ctx.lineTo(x + 5, y + 8);
      ctx.fill();
    }
    ctx.fillStyle = '#6a4526';
    for (let x = -groundX * 1; x < W; x += 40) ctx.fillRect(x + 12, y + 44, 14, 6);
  }

  // one bone, vertical. endY = the end next to the gap; dir = -1 (bone above gap) or +1 (bone below gap)
  function drawBone(cx, endY, dir) {
    const kr = 12;        // knob radius
    const kx = 8;         // knob offset from center
    const knobY = endY - dir * 8;
    const farY = dir === -1 ? -60 : H;      // offscreen end
    const shaftFrom = knobY;
    ctx.beginPath();
    // shaft
    const y1 = Math.min(shaftFrom, farY), y2 = Math.max(shaftFrom, farY);
    ctx.rect(cx - 12, y1, 24, y2 - y1);
    // knobs at gap end
    ctx.moveTo(cx - kx + kr, knobY);
    ctx.arc(cx - kx, knobY, kr, 0, Math.PI * 2);
    ctx.moveTo(cx + kx + kr, knobY);
    ctx.arc(cx + kx, knobY, kr, 0, Math.PI * 2);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#8a7a58';
    ctx.stroke();
    ctx.fillStyle = '#f7f1df';
    ctx.fill();
  }

  function drawBones() {
    for (const b of bones) {
      drawBone(b.x, b.gapY, -1);
      drawBone(b.x, b.gapY + GAP, +1);
    }
  }

  function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    const tilt = state === 'over' ? 0.9 : Math.max(-0.4, Math.min(0.7, player.vy / 900));
    ctx.rotate(tilt);
    if (imgOk) {
      const ar = img.naturalWidth / img.naturalHeight;
      const h = PLAYER_HEIGHT, w = h * ar;
      player.w = w;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else {
      ctx.fillStyle = '#b5773c';
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function text(str, x, y, size, fill = '#fff', stroke = '#2a3b4d', weight = 700, align = 'center') {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size / 6);
    ctx.strokeStyle = stroke;
    ctx.strokeText(str, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y);
  }

  function drawUI() {
    if (state === 'ready') {
      text(TITLE, W / 2, 150, 54);
      text('Tap to start', W / 2, 400, 28, '#fff3b0');
      text('Dodge the bones', W / 2, 438, 20, '#ffffff', '#2a3b4d', 500);
      if (best) text('Best: ' + best, W / 2, 478, 20, '#ffffff', '#2a3b4d', 500);
    } else if (state === 'playing') {
      text(String(score), W / 2, 70, 60);
    } else {
      ctx.fillStyle = 'rgba(20,30,45,0.55)';
      ctx.fillRect(0, 0, W, H);
      text('Game over', W / 2, 170, 48);
      ctx.fillStyle = '#fff8e6';
      ctx.strokeStyle = '#8a7a58';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(W / 2 - 120, 230, 240, 130, 18);
      ctx.fill();
      ctx.stroke();
      text('Score', W / 2 - 60, 262, 20, '#5a4a30', 'rgba(0,0,0,0)', 500);
      text('Best', W / 2 + 60, 262, 20, '#5a4a30', 'rgba(0,0,0,0)', 500);
      text(String(score), W / 2 - 60, 315, 52, '#2a3b4d', 'rgba(0,0,0,0)');
      text(String(best), W / 2 + 60, 315, 52, '#2a3b4d', 'rgba(0,0,0,0)');
      if (performance.now() - overAt > 600) text('Tap to retry', W / 2, 430, 28, '#fff3b0');
    }
  }

  function render() {
    drawBackground();
    drawBones();
    drawGround();
    drawPlayer();
    drawUI();
  }

  // ---------- loop ----------
  function frame(ts) {
    if (!t0) t0 = ts;
    const dt = Math.min((ts - t0) / 1000, 0.05);
    t0 = ts;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
