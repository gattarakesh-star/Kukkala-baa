(() => {
  // ====== EASY SETTINGS ======
  const TITLE = 'Bone Dash';
  const PLAYER_SRC = 'assets/player.png';
  const MUSIC_SRC = 'assets/music.mp3';
  const GAMEOVER_SRC = 'assets/gameover.mp3';
  const GAMEOVER_IMG_SRC = 'assets/gameover.png';   // NEW: pic shown on game over screen
  const GAMEOVER2_SRC = 'assets/gameover2.mp3';     // NEW: second game over sound
  const GAMEOVER2_DELAY_MS = 800;                   // wait before the 2nd sound (0 = together)
  const VIEW_H = 540;         // smaller = more zoomed in, bigger = more zoomed out
  const PLAYER_HEIGHT = 68;   // drawn size of your pic
  const GRAVITY = 1400;       // higher = falls faster
  const FLAP = -400;          // jump strength
  const SPEED = 160;          // bone speed
  const GAP = 220;            // space between top and bottom bone
  const SPACING = 220;        // distance between bone pairs
  // ===========================

  const H = VIEW_H, GROUND = 80, BONE_W = 40;
  let W = 360;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const FONT = "'Fredoka', 'Trebuchet MS', sans-serif";

  const player = { x: 100, y: H / 2 - 40, vy: 0, w: PLAYER_HEIGHT, h: PLAYER_HEIGHT };

  // ---------- full screen sizing ----------
  function resize() {
const vw = window.innerWidth;
const vh = window.innerHeight;
const dpr = Math.min(window.devicePixelRatio || 1, 2);

// Match the game canvas to the screen aspect ratio
W = Math.round(H * vw / vh);

// Fill the entire available screen
canvas.style.width = vw + 'px';
canvas.style.height = vh + 'px';

canvas.width = Math.round(vw * dpr);
canvas.height = Math.round(vh * dpr);

// Scale the game drawing coordinates
const scaleX = canvas.width / W;
const scaleY = canvas.height / H;

ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

player.x = Math.round(W * 0.27);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();

  // ---------- assets ----------
  const img = new Image();
  let imgOk = false;
  img.onload = () => { imgOk = true; };
  img.src = PLAYER_SRC;

  const overImg = new Image();
  let overImgOk = false;
  overImg.onload = () => { overImgOk = true; };
  overImg.src = GAMEOVER_IMG_SRC;

  const music = new Audio(MUSIC_SRC);
  music.loop = true;
  music.volume = 0.5;
  const overSnd = new Audio(GAMEOVER_SRC);
  overSnd.volume = 0.9;
  const overSnd2 = new Audio(GAMEOVER2_SRC);
  overSnd2.volume = 0.9;
  let over2Timer = null;

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

  function safePlay(a) {
    if (muted) return;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  }
  function playMusic() { safePlay(music); }
  function stopMusic() { music.pause(); music.currentTime = 0; }
  function stopOverSounds() {
    clearTimeout(over2Timer);
    overSnd.pause(); overSnd.currentTime = 0;
    overSnd2.pause(); overSnd2.currentTime = 0;
  }

  const muteBtn = document.getElementById('mute');
  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    muted = !muted;
    muteBtn.textContent = muted ? '🔇' : '🔊';
    music.muted = muted;
    overSnd.muted = muted;
    overSnd2.muted = muted;
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

  let bones = [];
  const clouds = [
    { x: 40, y: 90, s: 1 }, { x: 250, y: 150, s: 0.7 },
    { x: 330, y: 60, s: 0.85 }, { x: 150, y: 230, s: 0.6 },
  ];

  function reset() {
    score = 0;
    bones = [];
    player.y = H / 2 - 40;
    player.vy = 0;
  }

  function spawnBone() {
    const minTop = 80;
    const maxTop = H - GROUND - GAP - 70;
    bones.push({ x: W + BONE_W, gapY: minTop + Math.random() * (maxTop - minTop), passed: false });
  }

  function flap() {
    player.vy = FLAP;
    sfxFlap();
  }

  function startGame() {
    stopOverSounds();
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
    stopOverSounds();
    safePlay(overSnd);
    over2Timer = setTimeout(() => safePlay(overSnd2), GAMEOVER2_DELAY_MS);
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
    else if (state === 'over' && performance.now() - overAt > 800) startGame();
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
    for (let x = -groundX; x < W; x += 40) ctx.fillRect(x + 12, y + 44, 14, 6);
  }

  // dir = -1: bone hangs from the top; dir = +1: bone rises from the bottom
  function drawBone(cx, endY, dir) {
    const kr = 12, kx = 8;
    const knobY = endY - dir * 8;
    const farY = dir === -1 ? -60 : H;
    const y1 = Math.min(knobY, farY), y2 = Math.max(knobY, farY);
    ctx.beginPath();
    ctx.rect(cx - 12, y1, 24, y2 - y1);
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

  function text(str, x, y, size, fill = '#fff', stroke = '#2a3b4d', weight = 700) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (stroke) {
      ctx.lineWidth = Math.max(4, size / 6);
      ctx.strokeStyle = stroke;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y);
  }

  // extra pic, drawn inside the score card
  function drawScoreCardPic(cx, top, bw, bh) {
    const s = Math.min(bw / overImg.naturalWidth, bh / overImg.naturalHeight);
    const w = overImg.naturalWidth * s, h = overImg.naturalHeight * s;
    const x = cx - w / 2, y = top + (bh - h) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.clip();
    ctx.drawImage(overImg, x, y, w, h);
    ctx.restore();
  }

  function drawUI() {
    if (state === 'ready') {
      text(TITLE, W / 2, 130, 52);
      text('Tap to start', W / 2, 340, 28, '#fff3b0');
      text('Dodge the bones', W / 2, 376, 20, '#ffffff', '#2a3b4d', 500);
      if (best) text('Best: ' + best, W / 2, 414, 20, '#ffffff', '#2a3b4d', 500);
    } else if (state === 'playing') {
      text(String(score), W / 2, 64, 58);
    } else {
      ctx.fillStyle = 'rgba(20,30,45,0.6)';
      ctx.fillRect(0, 0, W, H);
      text('Game over', W / 2, 56, 46);

      // score card: extra pic on top, score + best below
      const top = 95, cardW = 240;
      const picH = overImgOk ? 160 : 0;
      const rowTop = top + 14 + (overImgOk ? picH + 12 : 0);
      const cardH = rowTop + 92 - top;
      ctx.fillStyle = '#fff8e6';
      ctx.strokeStyle = '#8a7a58';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(W / 2 - cardW / 2, top, cardW, cardH, 16);
      ctx.fill();
      ctx.stroke();
      if (overImgOk) drawScoreCardPic(W / 2, top + 14, cardW - 28, picH);
      text('Score', W / 2 - 55, rowTop + 14, 18, '#5a4a30', null, 500);
      text('Best', W / 2 + 55, rowTop + 14, 18, '#5a4a30', null, 500);
      text(String(score), W / 2 - 55, rowTop + 56, 46, '#2a3b4d', null);
      text(String(best), W / 2 + 55, rowTop + 56, 46, '#2a3b4d', null);
      if (performance.now() - overAt > 800) text('Tap to retry', W / 2, top + cardH + 50, 28, '#fff3b0');
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
