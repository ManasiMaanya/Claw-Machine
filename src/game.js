//  CLAW MACHINE  –  fully self-contained, no CDN needed

// ── PLUSH DATA ───────────────────────────────────────────
const PLUSH_DATA = [
  { id:'peach',      name:'Peach Bun',       emoji:'🍑', color:'#fec69e', rarity:'common'     },
  { id:'penguin',    name:'Waddle Penguin',  emoji:'🐧', color:'#baddf5', rarity:'uncommon'   },
  { id:'chick',      name:'Baby Chick',      emoji:'🐥', color:'#f5e8a9', rarity:'common'     },
  { id:'panda',      name:'Panda Baby',      emoji:'🐼', color:'#cab4f8', rarity:'uncommon'   },
  { id:'bunny',      name:'Pink Bunny',      emoji:'🐰', color:'#ffd4e7', rarity:'common'     },
  { id:'bear',       name:'Teddy Bear',      emoji:'🧸', color:'#fbe2cb', rarity:'uncommon'   },
  { id:'ghost',      name:'Boo Ghost',       emoji:'👻', color:'#fcbfbf', rarity:'common'     },
  { id:'star',       name:'Twinkle Star',    emoji:'⭐', color:'#fff9c6', rarity:'common'     },
  { id:'parrot',     name:'Rainbow Parrot',  emoji:'🦜', color:'#ccf8d8', rarity:'ultra-rare' },
  { id:'penguin',    name:'Waddle Penguin',  emoji:'🐧', color:'#baddf5', rarity:'uncommon'   },
  { id:'hamster',    name:'Hammy',           emoji:'🐹', color:'#f8dbc5', rarity:'common'     },
  { id:'pig',        name:'Pinky Pig',       emoji:'🐷', color:'#feb9d7', rarity:'common'     },
  { id:'dog',        name:'Puppy',           emoji:'🐶', color:'#fff0db', rarity:'common'     },
  { id:'koala',      name:'Sleepy Koala',    emoji:'🐨', color:'#cacaca', rarity:'uncommon'   },
  { id:'frog',       name:'Hoppy Frog',      emoji:'🐸', color:'#c3fdc3', rarity:'common'     },
  { id:'cat',        name:'Kitty',           emoji:'🐱', color:'#fddd91', rarity:'common'     },
  { id:'fox',        name:'Foxy',            emoji:'🦊', color:'#f9c28c', rarity:'rare'       },
];

const RARITY_ODDS = { common:0.45, uncommon:0.30, rare:0.18, 'ultra-rare':0.07 };

// ── CANVAS / PHYSICS CONFIG ───────────────────────────────
const CW          = 468;
const CH          = 545;
const PLUSH_R     = 32;      // bigger!
const GRAVITY     = 0.38;
const BOUNCE      = 0.32;
const FRICTION    = 0.91;
const PLUSH_COUNT = 25;      // lots more!
const FLOOR_Y     = CH - 44;
const WALL_L      = 38;      // inside the wall graphics
const WALL_R      = CW - 38;

// ── STATE ────────────────────────────────────────────────
let plushies     = [];
let clawX        = CW / 2;
let clawTargetX  = CW / 2;
let clawY        = 0;
let isDropping   = false;
let grabbedPlush = null;    // the plush attached to claw
let frameId      = null;
let canvas, ctx;
let prevPage     = 'landing';
let saveData     = { collection:{}, totalWins:0, theme:1 };
let currentTheme = 1;
let riggedMode   = false;  // Secret hard mode

// ── PHYSICS BODY ─────────────────────────────────────────
function makeBody(x, y, data) {
  return {
    x, y,
    vx: (Math.random() - 0.5) * 1.5,
    vy: Math.random() * 1.5,
    data,
    r: PLUSH_R,
    angle: Math.random() * Math.PI * 2,
    spin:  (Math.random() - 0.5) * 0.04,
    grabbed: false,
  };
}

function stepPhysics() {
  plushies.forEach(p => {
    if (p.grabbed) return; // claw controls grabbed plush position

    p.vy += GRAVITY;
    p.x  += p.vx;
    p.y  += p.vy;
    p.angle += p.spin;

    // Slow spin when resting
    p.spin *= 0.995;

    // Floor
    if (p.y + p.r > FLOOR_Y) {
      p.y   = FLOOR_Y - p.r;
      p.vy *= -BOUNCE;
      p.vx *= FRICTION;
      if (Math.abs(p.vy) < 0.4) p.vy = 0;
      if (Math.abs(p.vx) < 0.05) p.vx = 0;
    }
    // Walls
    if (p.x - p.r < WALL_L) { p.x = WALL_L + p.r; p.vx = Math.abs(p.vx) * BOUNCE; }
    if (p.x + p.r > WALL_R) { p.x = WALL_R - p.r; p.vx = -Math.abs(p.vx) * BOUNCE; }
    // Ceiling
    if (p.y - p.r < 0) { p.y = p.r; p.vy = Math.abs(p.vy) * BOUNCE; }

    // Plush-plush collisions
    plushies.forEach(q => {
      if (q === p || q.grabbed) return;
      const dx   = q.x - p.x;
      const dy   = q.y - p.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const minD = p.r + q.r - 2;
      if (dist < minD && dist > 0.01) {
        const nx      = dx / dist;
        const ny      = dy / dist;
        const overlap = (minD - dist) / 2;
        p.x -= nx * overlap;
        p.y -= ny * overlap;
        q.x += nx * overlap;
        q.y += ny * overlap;
        const dvx = p.vx - q.vx;
        const dvy = p.vy - q.vy;
        const dot = dvx*nx + dvy*ny;
        if (dot > 0) {
          const impulse = dot * 0.6;
          p.vx -= impulse * nx;
          p.vy -= impulse * ny;
          q.vx += impulse * nx;
          q.vy += impulse * ny;
        }
      }
    });
  });
}

// ── SPAWN ────────────────────────────────────────────────
function spawnPlushies() {
  plushies = [];
  const shuffled = [...PLUSH_DATA].sort(() => Math.random() - 0.5);

  // Pack them in rows so they fill the bottom nicely
  const usableW = WALL_R - WALL_L;
  const cols    = Math.floor(usableW / (PLUSH_R * 2 + 4));

  for (let i = 0; i < PLUSH_COUNT; i++) {
    const data = shuffled[i % shuffled.length];
    const col  = i % cols;
    const row  = Math.floor(i / cols);
    // Slightly staggered so they drop and settle
    const x = WALL_L + PLUSH_R + 4 + col * (usableW / cols) + (Math.random() - 0.5) * 10;
    const y = CH * 0.45 + row * (PLUSH_R * 2 + 6) + Math.random() * 12;
    plushies.push(makeBody(x, y, data));
  }
}

// ── DRAW EVERYTHING ──────────────────────────────────────
function draw() {
  if (!ctx) return;
  const tc = getThemeColors();

  ctx.clearRect(0, 0, CW, CH);

  // ── Outer frame background (walls + floor zone)
  ctx.fillStyle = tc.wall;
  ctx.fillRect(0, 0, CW, CH);

  // ── Inner play area — transparent (no white bg)
  // Skip drawing inner bg - let theme background show through

  // ── Floor — solid stripe at bottom
  ctx.fillStyle = tc.floor;
  ctx.fillRect(WALL_L, FLOOR_Y, WALL_R - WALL_L, CH - FLOOR_Y);

  // ── Wall inner edge shadows (thin, only on edge pixels)
  const shadL = ctx.createLinearGradient(WALL_L, 0, WALL_L + 14, 0);
  shadL.addColorStop(0, 'rgba(0,0,0,0.10)');
  shadL.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadL;
  ctx.fillRect(WALL_L, 0, 14, CH);

  const shadR = ctx.createLinearGradient(WALL_R - 14, 0, WALL_R, 0);
  shadR.addColorStop(0, 'rgba(0,0,0,0)');
  shadR.addColorStop(1, 'rgba(0,0,0,0.10)');
  ctx.fillStyle = shadR;
  ctx.fillRect(WALL_R - 14, 0, 14, CH);

  // ── Floor top highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(WALL_L, FLOOR_Y);
  ctx.lineTo(WALL_R, FLOOR_Y);
  ctx.stroke();

  // ── Top rail bar
  ctx.fillStyle = tc.wallDark;
  ctx.fillRect(WALL_L, 0, WALL_R - WALL_L, 8);

  // ── Physics step
  stepPhysics();

  // ── Move grabbed plush with claw
  if (grabbedPlush) {
    grabbedPlush.x = clawX;
    grabbedPlush.y = clawY + PLUSH_R + 26;
    grabbedPlush.vx = 0;
    grabbedPlush.vy = 0;
    grabbedPlush.angle += 0.015;
  }

  // ── Draw plushies (non-grabbed first, grabbed on top)
  plushies.filter(p => !p.grabbed).forEach(p => drawPlush(p));
  if (grabbedPlush) drawPlush(grabbedPlush);

  // ── Smooth claw X
  if (!isDropping) {
    clawX += (clawTargetX - clawX) * 0.14;
  }

  // ── Claw string
  ctx.strokeStyle = 'rgba(60,60,60,0.7)';
  ctx.lineWidth   = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(clawX, 0);
  ctx.lineTo(clawX, clawY + 4);
  ctx.stroke();

  // ── Claw mechanism
  drawClaw(clawX, clawY);
}

function drawPlush(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);

  // Soft drop shadow
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 3;

  // Pastel circle - covers 95% of emoji
  const circleR = p.r * 0.95;
  ctx.beginPath();
  ctx.arc(0, 0, circleR, 0, Math.PI * 2);
  ctx.fillStyle = p.data.color;
  ctx.fill();

  // Thin white border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Clear shadow for emoji
  ctx.shadowColor = 'transparent';

  // Large emoji on top - slightly bigger than circle so parts peek out
  ctx.font = `${p.r * 1.8}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.data.emoji, 0, 0);

  ctx.restore();
}


function drawClaw(x, y) {
  ctx.save();

  // Pulley/connector block
  const grad = ctx.createLinearGradient(x - 18, y - 14, x + 18, y + 6);
  grad.addColorStop(0, '#d0d0d0');
  grad.addColorStop(1, '#a0a0a0');
  ctx.fillStyle   = grad;
  ctx.strokeStyle = '#888';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - 18, y - 14, 36, 18, 6);
  ctx.fill();
  ctx.stroke();

  // Bolt detail
  ctx.beginPath();
  ctx.arc(x, y - 5, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#bbb';
  ctx.fill();
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Prongs — open wide by default, close tight when grabbed
  const open = grabbedPlush ? 4 : 18;
  ctx.lineCap   = 'round';
  ctx.lineWidth = 5;

  const prongs = [
    { topX: x - 8, botX: x - open,       botY: y + 34 },
    { topX: x,     botX: x,               botY: y + 38 },
    { topX: x + 8, botX: x + open,        botY: y + 34 },
  ];

  prongs.forEach(pr => {
    // Shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.moveTo(pr.topX + 1, y + 5);
    ctx.lineTo(pr.botX + 1, pr.botY + 1);
    ctx.stroke();

    // Prong
    const pGrad = ctx.createLinearGradient(pr.topX, y, pr.botX, pr.botY);
    pGrad.addColorStop(0, '#c0c0c0');
    pGrad.addColorStop(1, '#888');
    ctx.strokeStyle = pGrad;
    ctx.beginPath();
    ctx.moveTo(pr.topX, y + 5);
    ctx.lineTo(pr.botX, pr.botY);
    ctx.stroke();

    // Tip dot
    ctx.beginPath();
    ctx.arc(pr.botX, pr.botY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#999';
    ctx.fill();
  });

  ctx.restore();
}

// ── GAME LOOP ────────────────────────────────────────────
function gameLoop() {
  draw();
  frameId = requestAnimationFrame(gameLoop);
}

// ── DROP CLAW ─────────────────────────────────────────────
async function dropClaw() {
  if (isDropping) return;
  isDropping   = true;
  grabbedPlush = null;
  const lockedX = clawX;

  // 1 ── Drop down to random height (top/middle/bottom of plush layer)
  const dropChoices = [
    FLOOR_Y - 180,  // top of plushies
    FLOOR_Y - 120,  // middle layer
    FLOOR_Y - 58    // near floor
  ];
  const targetDrop = dropChoices[Math.floor(Math.random() * dropChoices.length)];
  
  while (clawY < targetDrop) {
    clawY += 10;
    await tick(14);
  }

  // 2 ── Find the NEAREST plush to where the claw tip actually landed
  //       Claw tip is at (lockedX, clawY + 38)
  const clawTipX = lockedX;
  const clawTipY = clawY + 38;
  let nearest  = null;
  let nearestD = Infinity;
  for (const p of plushies) {
    const dx = p.x - clawTipX;
    const dy = p.y - clawTipY;
    const d  = Math.sqrt(dx*dx + dy*dy);
    if (d < PLUSH_R + 30 && d < nearestD) {
      nearest  = p;
      nearestD = d;
    }
  }

  if (nearest) {
    nearest.grabbed = true;
    grabbedPlush    = nearest;
  }

  await tick(160);

  // 3 ── Lift — grabbed plush follows claw position via draw()
  const successRate = riggedMode ? 0.05 : 0.65;  // 5% when rigged, 65% normal
  const willSucceed = grabbedPlush !== null && Math.random() < successRate;
  let didDrop = false;

  while (clawY > 0) {
    clawY -= 9;
    if (clawY < 0) clawY = 0;

    // Drop mid-lift on failure
    if (grabbedPlush && !willSucceed && !didDrop && clawY < CH * 0.40) {
      grabbedPlush.grabbed = false;
      grabbedPlush.vy      = 3;
      grabbedPlush.vx      = (Math.random() - 0.5) * 5;
      grabbedPlush.spin    = (Math.random() - 0.5) * 0.14;
      grabbedPlush         = null;
      didDrop              = true;
    }

    await tick(14);
  }

  clawY      = 0;
  isDropping = false;

  // 4 ── Resolve — WIN shows the EXACT plush that was caught
  if (willSucceed && grabbedPlush) {
    const wonPlush = grabbedPlush;  // THIS plush, not a random one
    wonPlush.grabbed = false;
    grabbedPlush     = null;
    plushies         = plushies.filter(p => p !== wonPlush);

    // Add to collection using the actual caught plush data
    addToCollection(wonPlush.data);

    // Respawn a replacement
    setTimeout(() => {
      if (!canvas) return;
      const pd = PLUSH_DATA[Math.floor(Math.random() * PLUSH_DATA.length)];
      plushies.push(makeBody(
        WALL_L + PLUSH_R + Math.random() * (WALL_R - WALL_L - PLUSH_R * 2),
        PLUSH_R + 5, pd
      ));
    }, 600);

    stopGame();
    showWinPage(wonPlush.data);  // show the ACTUAL plush caught

  } else {
    if (grabbedPlush) {
      grabbedPlush.grabbed = false;
      grabbedPlush.vy      = 2;
      grabbedPlush         = null;
    }
    stopGame();
    showPage('lose');
  }
}

// ── WIN / LOSE ────────────────────────────────────────────
function showWinPage(plush) {
  document.getElementById('win-plush-display').textContent = plush.emoji;
  document.getElementById('win-plush-name').textContent    = plush.name;
  const el = document.getElementById('win-plush-rarity');
  el.textContent = plush.rarity.replace('-',' ').toUpperCase();
  el.className   = 'result-rarity rarity-' + plush.rarity;
  showPage('win');
}

// ── RARITY ROLL ───────────────────────────────────────────
function rollRarity() {
  let acc = 0;
  const r = Math.random();
  for (const [rar, chance] of Object.entries(RARITY_ODDS)) {
    acc += chance;
    if (r < acc) {
      const pool = PLUSH_DATA.filter(p => p.rarity === rar);
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }
  return PLUSH_DATA[0];
}

// ── COLLECTION ────────────────────────────────────────────
function addToCollection(plush) {
  if (!saveData.collection[plush.id]) {
    saveData.collection[plush.id] = { ...plush, count: 0 };
  }
  saveData.collection[plush.id].count++;
  saveData.totalWins++;
  writeSave();
}

function buildInventory() {
  const grid = document.getElementById('inventory-grid');
  grid.innerHTML = '';
  const owned = Object.keys(saveData.collection).length;
  document.getElementById('inv-progress').textContent =
    `${owned} / ${PLUSH_DATA.length}  (${Math.round(owned / PLUSH_DATA.length * 100)}%)`;

  PLUSH_DATA.forEach(plush => {
    const entry = saveData.collection[plush.id];
    const card  = document.createElement('div');
    card.className = 'inv-card';
    card.innerHTML = `
      <span class="inv-card-emoji ${entry ? '' : 'locked'}">${entry ? plush.emoji : '❓'}</span>
      <span class="inv-card-name">${entry ? plush.name : '???'}</span>
      <span class="inv-card-rarity rarity-${plush.rarity}">${plush.rarity.replace('-',' ')}</span>
      <span class="inv-card-count">${entry ? '×' + entry.count : '×0'}</span>
    `;
    grid.appendChild(card);
  });
}

// ── THEME ─────────────────────────────────────────────────
const THEMES = ['theme-pink', 'theme-lavender', 'theme-blue'];

function getThemeColors() {
  if (currentTheme === 1) return {
    inner:    '#fff0f7',   // clean white-pink play area — no cast
    wall:     '#f8b8d7',   // solid pink walls
    wallDark: '#f472b6',   // darker pink for rail/edges
    floor:    '#f9a8d4',   // pink floor
  };
  if (currentTheme === 2) return {
    inner:    '#f5f0ff',   // clean white-lavender play area
    wall:     '#d2a7fe',   // solid lavender walls
    wallDark: '#a855f7',   // darker purple rail
    floor:    '#c4b5fd',   // lavender floor
  };
  return {
    inner:    '#f0f8ff',   // clean white-blue play area
    wall:     '#94c2fb',   // solid blue walls
    wallDark: '#3b82f6',   // darker blue rail
    floor:    '#93c5fd',   // blue floor
  };
}

function cycleTheme() {
  currentTheme = (currentTheme % 3) + 1;
  document.body.className = THEMES[currentTheme - 1];
  saveData.theme = currentTheme;
  writeSave();
}

// ── PAGE SWITCH ───────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
}

// ── START / STOP ──────────────────────────────────────────
function startGame() {
  stopGame();
  canvas = document.getElementById('canvas');
  canvas.width  = CW;
  canvas.height = CH;
  canvas.style.width  = CW + "px";
  canvas.style.height = CH + "px";
  ctx = canvas.getContext('2d');

  clawX        = CW / 2;
  clawTargetX  = CW / 2;
  clawY        = 0;
  isDropping   = false;
  grabbedPlush = null;

  canvas.onmousemove = e => {
    if (isDropping) return;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = CW / rect.width;
    clawTargetX  = Math.max(WALL_L + 20, Math.min(WALL_R - 20,
      (e.clientX - rect.left) * scaleX));
  };
  canvas.onclick = () => { if (!isDropping) dropClaw(); };

  spawnPlushies();
  document.getElementById('win-count').textContent = saveData.totalWins;
  frameId = requestAnimationFrame(gameLoop);
}

function stopGame() {
  if (frameId) { cancelAnimationFrame(frameId); frameId = null; }
  if (canvas)  { canvas.onmousemove = null; canvas.onclick = null; }
  grabbedPlush = null;
}

// ── SAVE / LOAD ───────────────────────────────────────────
function writeSave() {
  try { localStorage.setItem('clawSave3', JSON.stringify(saveData)); } catch(e) {}
}
function loadSave() {
  try {
    const s = localStorage.getItem('clawSave3');
    if (s) { saveData = JSON.parse(s); currentTheme = saveData.theme || 1; }
  } catch(e) {}
}

// ── UTILITY ───────────────────────────────────────────────
function tick(ms) { return new Promise(r => setTimeout(r, ms)); }

// ════════════════════════════════════════════════════════
//  BOOT — wire ALL buttons before anything else can fail
// ════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  loadSave();
  document.body.className = THEMES[currentTheme - 1];

  // Secret rigged mode - single click title
  const titleText = document.querySelector('.title-text');
  if (titleText) {
    titleText.style.cursor = 'pointer';
    titleText.addEventListener('click', (e) => {
      e.stopPropagation();
      riggedMode = !riggedMode;
      const msg = riggedMode ? '😈 RIGGED MODE ON (5% win)' : '😊 Normal mode (65% win)';
      console.log(msg);
      alert(msg);  // Make it super obvious
      
      const orig = titleText.textContent;
      titleText.textContent = riggedMode ? '😈 RIGGED' : '😊 Fair';
      titleText.style.color = riggedMode ? '#ff0000' : '#000';
      titleText.style.fontWeight = riggedMode ? '900' : '';
      
      // Keep showing mode indicator
      setTimeout(() => {
        titleText.textContent = orig;
        if (riggedMode) {
          titleText.style.color = '#cc0000';
          titleText.style.fontWeight = '900';
        } else {
          titleText.style.color = '';
          titleText.style.fontWeight = '';
        }
      }, 1500);
    });
    console.log(' Secret mode ready: Click "Claw Machine" title to toggle');
  }

  // Title bar
  document.getElementById('btn-close').onclick    = () => window.close();
  document.getElementById('btn-minimize').onclick = () => {
    try { require('electron').getCurrentWindow().minimize(); } catch(e) {}
  };
  document.getElementById('btn-theme').onclick     = cycleTheme;
  document.getElementById('btn-inventory').onclick = () => {
    prevPage = document.querySelector('.page.active').id.replace('page-', '');
    stopGame();
    buildInventory();
    showPage('inventory');
  };

  // Landing
  document.getElementById('btn-play').onclick = () => {
    showPage('game');
    startGame();
  };

  // Game
  document.getElementById('btn-back-game').onclick = () => {
    stopGame();
    showPage('landing');
  };

  // Win
  document.getElementById('btn-play-again-win').onclick = () => {
    showPage('game');
    startGame();
  };

  // Lose
  document.getElementById('btn-play-again-lose').onclick = () => {
    showPage('game');
    startGame();
  };

  // Inventory
  document.getElementById('btn-back-inv').onclick = () => {
    showPage(prevPage);
    if (prevPage === 'game') startGame();
  };

  showPage('landing');
  console.log('Claw Machine ready!');
});

