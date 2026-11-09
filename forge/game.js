// 곡괭이 장인 — 체험판 (docs/forge-pick-gdd.md 10장)
// 제작(재료 3칸 + 모양 + 액션 A 따라 긋기 / B 두 번 절삭 → 등급 판정) → 자동 전투 3스테이지 → 강화 or 재제작
(() => {
  const Q = new URLSearchParams(location.search);
  const MODE = Q.get('mode') === 'b' ? 'b' : 'a';
  const W = 720;
  const BOX = document.getElementById('game').getBoundingClientRect();
  const H = Math.max(1100, Math.round(W * BOX.height / Math.max(1, BOX.width)));
  const FONT = '"Black Han Sans", sans-serif';
  const $ = id => document.getElementById(id);

  // ---------- 규칙 ----------
  const MATS = {
    iron: { name: '철', ico: '⬛', col: 0x9aa3ad, desc: '공격력 +4' },
    crystal: { name: '수정', ico: '💎', col: 0x5fe0ff, desc: '파편 (타격의 35%)' },
    fire: { name: '화염석', ico: '🔥', col: 0xff8a3c, desc: '화상 (타격의 30%)' },
  };
  const SHAPES = {
    fast: { name: '연타형', desc: '빠르게 여러 번 (초당 2.8회)<br>한 방은 약함', every: 0.36, mult: 0.5, picks: 2 },
    heavy: { name: '강타형', desc: '느리지만 묵직한 한 방<br>(초당 0.9회)', every: 1.15, mult: 1.6, picks: 1 },
  };
  const GRADES = [
    { name: '일반', col: '#d0d0d0', hex: 0xd0d0d0, mult: 1.0, tex: 'pick1' },
    { name: '희귀', col: '#4aa3ff', hex: 0x4aa3ff, mult: 1.35, tex: 'pick4' },
    { name: '전설', col: '#ffb020', hex: 0xffb020, mult: 1.8, tex: 'pick8' },
  ];
  const ODDS = acc => acc >= 95 ? [15, 55, 30] : acc >= 80 ? [35, 50, 15] : acc >= 50 ? [60, 35, 5] : [85, 14, 1];
  const UPG = 0.2;
  const STAGES = [
    { name: '무른 광석 무리', ico: '🟠', time: 12, type: 'count', need: 10,
      txt: '작은 광석이 쉬지 않고 나와요 (체력 18).<br><b>12초 안에 10개</b> 깨기', short: '작은 광석이 쉬지 않고 나옴' },
    { name: '철갑 광맥', ico: '🛡️', time: 12, type: 'main', main: { tex: 'armor', hp: 260, armor: 9 },
      txt: '한 번 칠 때마다 <b class="warn">피해 9를 막아요</b>.<br>약한 연타는 거의 안 들어가요. <b>12초 안에</b> 파괴', short: '한 방에 피해 9씩 막음' },
    { name: '수호자', ico: '👁️', time: 24, type: 'boss', main: { tex: 'guardian', hp: 640, armor: 3 },
      txt: '체력이 아주 많아요. 절반이 되면 <b class="warn">보호막</b>을 치고 작은 광석 2개를 불러요 (그걸 깨야 보호막이 풀려요).<br><b>24초 안에</b> 쓰러뜨리기', short: '체력 많음 · 절반에서 보호막 + 작은 광석' },
  ];

  const G = { stage: 0, upg: 0, pick: null, cand: null, recraft: false, tries: [0, 0, 0], log: [] };
  function stats(p, upg = G.upg) {
    const n = k => p.mats.filter(m => m === k).length;
    const base = 8 + 4 * n('iron') + 2 * (n('crystal') + n('fire'));
    const S = SHAPES[p.shape];
    const hit = base * (1 + UPG * upg) * GRADES[p.grade].mult * S.mult;
    return { hit, every: S.every, dps: hit / S.every, shards: n('crystal'), fire: n('fire'), iron: n('iron') };
  }
  const r1 = x => (Math.round(x * 10) / 10).toString();

  // ---------- 효과음 ----------
  let AC = null, muted = false;
  const ac = () => { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { } } if (AC && AC.state === 'suspended') AC.resume(); return AC; };
  function noise(dur, freq, vol, type = 'lowpass') {
    const a = ac(); if (!a || muted) return;
    const n = a.createBufferSource(), b = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    n.buffer = b; const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = a.createGain(); g.gain.value = vol; n.connect(f); f.connect(g); g.connect(a.destination); n.start();
  }
  function tone(f0, f1, dur, vol, type = 'sine', delay = 0) {
    const a = ac(); if (!a || muted) return;
    const t0 = a.currentTime + delay, o = a.createOscillator(), g = a.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur);
  }
  const SFX = {
    hit: k => { noise(0.07, 1800 + 800 * k, 0.3 + 0.25 * k); tone(170 - 40 * k, 60, 0.12 + 0.08 * k, 0.35 + 0.3 * k); },
    armor: () => { tone(900, 700, 0.08, 0.1, 'square'); noise(0.05, 4000, 0.18, 'highpass'); },
    clink: () => tone(1800, 1200, 0.05, 0.06, 'triangle'),
    brk: big => { noise(big ? 0.45 : 0.22, 900, big ? 0.6 : 0.4); tone(big ? 110 : 160, 40, big ? 0.4 : 0.2, 0.5); },
    scrape: () => noise(0.05, 5000 + Math.random() * 2000, 0.05, 'highpass'),
    cut: () => { noise(0.25, 3000, 0.35, 'highpass'); tone(500, 200, 0.2, 0.15, 'sawtooth'); },
    sizzle: () => noise(0.6, 6000, 0.12, 'highpass'),
    tick: k => tone(500 + 300 * k, 600 + 300 * k, 0.05, 0.12, 'triangle'),
    fanfare: g => [0, 4, 7, 12].slice(0, 2 + g).forEach((s, i) => tone(523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), 0.25, 0.15, 'triangle', i * 0.09)),
    burn: () => noise(0.04, 1200, 0.06),
    win: () => [0, 4, 7, 12].forEach((s, i) => tone(392 * Math.pow(2, s / 12), 392 * Math.pow(2, s / 12), 0.2, 0.15, 'square', i * 0.1)),
    lose: () => [0, -3, -7].forEach((s, i) => tone(300 * Math.pow(2, s / 12), 280 * Math.pow(2, s / 12), 0.25, 0.12, 'triangle', i * 0.15)),
  };

  // ---------- 화면 패널 ----------
  const PANELS = ['pStart', 'pMat', 'pShape', 'pAct', 'pOdds', 'pPick', 'pStage', 'pWork', 'pEnd'];
  const show = (...ids) => PANELS.forEach(p => $(p).classList.toggle('hide', !ids.includes(p)));
  const sceneF = () => game.scene.getScene('forge'), sceneM = () => game.scene.getScene('mine');
  function toForge() { if (game.scene.isActive('mine')) game.scene.stop('mine'); if (!game.scene.isActive('forge')) game.scene.start('forge'); }
  function toMine() { if (game.scene.isActive('forge')) game.scene.stop('forge'); game.scene.start('mine'); }

  // ===== 제작 흐름 =====
  let draft = null;
  function startCraft(recraft) {
    G.recraft = recraft; draft = { mats: [], shape: null };
    toForge(); show('pMat'); renderMats();
  }
  function renderMats() {
    $('slots').innerHTML = [0, 1, 2].map(i => {
      const m = draft.mats[i];
      return `<div class="slot ${m ? 'f' : ''}" data-i="${i}" style="${m ? `border-color:#${MATS[m].col.toString(16)}` : ''}">${m ? MATS[m].ico : ''}</div>`;
    }).join('');
    $('slots').querySelectorAll('.slot').forEach(el => el.onclick = () => { draft.mats.splice(+el.dataset.i, 1); renderMats(); });
    $('mats').innerHTML = Object.entries(MATS).map(([k, m]) => `<button class="mat" data-k="${k}"><b>${m.ico}</b><span>${m.name}</span><small>${m.desc}</small></button>`).join('');
    $('mats').querySelectorAll('.mat').forEach(el => el.onclick = () => { ac(); if (draft.mats.length < 3) { draft.mats.push(el.dataset.k); SFX.clink(); renderMats(); } });
    if (draft.mats.length === 3) {
      const s1 = stats({ mats: draft.mats, shape: 'fast', grade: 0 }), s2 = stats({ mats: draft.mats, shape: 'heavy', grade: 0 });
      const extra = [s1.shards ? `파편 ${s1.shards}개` : '', s1.fire ? `화상 ×${s1.fire}` : ''].filter(Boolean).join(' · ');
      $('matPrev').innerHTML = `예상 한 방: 연타형 <b>${r1(s1.hit)}</b> · 강타형 <b>${r1(s2.hit)}</b>${extra ? ' · ' + extra : ''}`;
    } else $('matPrev').textContent = `${3 - draft.mats.length}칸 남음`;
    $('bMatNext').disabled = draft.mats.length < 3;
    sceneF()?.setFurnace(draft.mats);
  }
  $('bMatNext').onclick = () => { show('pShape'); renderShapes(); };
  function renderShapes() {
    $('shapes').innerHTML = Object.entries(SHAPES).map(([k, s]) => {
      const st = stats({ mats: draft.mats, shape: k, grade: 0 });
      const img = k === 'fast' ? '<span class="two"><img src="img/pick1.webp"><img src="img/pick1.webp" style="transform:scaleX(-1)"></span>' : '<img src="img/pick1.webp" style="height:80px">';
      return `<button class="shape" data-k="${k}">${img}<b>${s.name}</b><small>${s.desc}<br>한 방 ${r1(st.hit)} · 초당 ${r1(st.dps)}</small></button>`;
    }).join('');
    $('shapes').querySelectorAll('.shape').forEach(el => el.onclick = () => { ac(); draft.shape = el.dataset.k; startAction(); });
  }
  function startAction() {
    show('pAct');
    $('actTitle').textContent = MODE === 'a' ? '③ 날 새기기' : '③ 날 깎기';
    $('actTxt').innerHTML = MODE === 'a'
      ? '달군 금속 위의 <b>빛나는 선</b>을 손가락으로 <b>한 번에</b> 따라 그어요. 정확할수록 좋은 등급이 나올 확률 ↑'
      : '달군 금속의 <b>점선</b>을 따라 <b>쭉 그어서</b> 잘라 내요 (2번). 정확할수록 좋은 등급이 나올 확률 ↑';
    sceneF().beginAction(MODE, draft.shape, acc => reveal(acc));
  }
  function reveal(acc) {
    const odds = ODDS(acc);
    show('pOdds');
    $('accTxt').innerHTML = `정확도 <span style="color:${acc >= 80 ? '#ffd54a' : '#fff'}">${Math.round(acc)}%</span>`;
    $('odds').innerHTML = GRADES.map((g, i) => `<span style="color:${g.col}">${g.name} ${odds[i]}%</span>`).join('');
    let r = Math.random() * 100, grade = 0;
    if (r < odds[2]) grade = 2; else if (r < odds[2] + odds[1]) grade = 1;
    const p = { mats: draft.mats.slice(), shape: draft.shape, grade, acc: Math.round(acc) };
    G.log.push({ stage: G.stage, acc: p.acc, grade, shape: p.shape, mats: p.mats.join(''), recraft: G.recraft });
    setTimeout(() => sceneF().spinGrade(grade, () => pickCard(p)), 700);
  }
  function pickCard(p) {
    show('pPick');
    const g = GRADES[p.grade], st = stats(p);
    $('pkName').innerHTML = `<span style="color:${g.col}">${g.name}</span> ${SHAPES[p.shape].name} 곡괭이`;
    $('pkTags').innerHTML = p.mats.map(m => `<span class="tag t-${m}">${MATS[m].ico} ${MATS[m].name}</span>`).join('') + (G.upg ? ` <span class="tag" style="background:#3d6b2a">강화 +${G.upg}</span>` : '');
    const old = G.recraft && G.pick ? stats(G.pick) : null;
    const cmp = (v, o) => o == null ? '' : `<small style="color:${v >= o ? '#5be37d' : '#ff5a5f'};font-size:11px"> (${v >= o ? '+' : ''}${r1(v - o)})</small>`;
    $('pkStats').innerHTML = `<div>한 방<b>${r1(st.hit)}${cmp(st.hit, old?.hit)}</b></div><div>초당 피해<b>${r1(st.dps)}${cmp(st.dps, old?.dps)}</b></div><div>특수<b style="font-size:14px">${[st.shards ? `파편 ${st.shards}` : '', st.fire ? `화상 ${st.fire}` : ''].filter(Boolean).join(' · ') || '-'}</b></div>`;
    if (G.recraft && G.pick) {
      $('pkBtns').innerHTML = `<div class="row"><button class="btn" id="bUseNew">새 곡괭이 쓰기</button><button class="btn alt" id="bKeep">기존 유지</button></div>`;
      $('bUseNew').onclick = () => { G.pick = p; stageIntro(); };
      $('bKeep').onclick = () => stageIntro();
    } else {
      $('pkBtns').innerHTML = `<button class="btn" id="bToMine">광산으로!</button>`;
      $('bToMine').onclick = () => { G.pick = p; stageIntro(); };
    }
  }

  // ===== 스테이지 =====
  function stageIntro() {
    const S = STAGES[G.stage];
    toMine();
    show('pStage');
    $('stIco').textContent = S.ico;
    $('stName').textContent = `스테이지 ${G.stage + 1} · ${S.name}`;
    $('stTxt').innerHTML = S.txt;
  }
  $('bGo').onclick = () => { ac(); show(); G.tries[G.stage]++; sceneM().startStage(G.stage, G.pick, G.upg, win => afterStage(win)); };
  function afterStage(win) {
    if (win && G.stage === STAGES.length - 1) return endGame();
    if (win) G.stage++;
    show('pWork');
    const S = STAGES[G.stage];
    $('wkTitle').innerHTML = win ? `스테이지 ${G.stage} 성공!` : `<span style="color:#ff5a5f">시간 초과…</span>`;
    $('wkTxt').innerHTML = win ? '다음 광산 전에 <b>작업을 1번</b> 할 수 있어요.' : '곡괭이는 그대로예요. <b>작업을 1번</b> 하고 다시 도전해요.';
    const cur = stats(G.pick), up = stats(G.pick, G.upg + 1);
    $('bUp').innerHTML = `🔨 강화<br><small style="font-weight:400">한 방 ${r1(cur.hit)} → <b>${r1(up.hit)}</b></small>`;
    $('bRe').innerHTML = `🔥 녹여서 다시 만들기<br><small style="font-weight:400">재료·모양 바꾸기 (강화 유지)</small>`;
    $('wkNext').innerHTML = `${win ? '다음' : '다시'}: <b>${S.ico} ${S.name}</b> — ${S.short}`;
  }
  $('bUp').onclick = () => { ac(); G.upg++; SFX.fanfare(0); stageIntro(); };
  $('bRe').onclick = () => { ac(); startCraft(true); };
  function endGame() {
    SFX.win(); show('pEnd');
    const g = GRADES[G.pick.grade];
    $('endTxt').innerHTML = `마지막 곡괭이: <b style="color:${g.col}">${g.name}</b> ${SHAPES[G.pick.shape].name} (${G.pick.mats.map(m => MATS[m].ico).join('')}) 강화 +${G.upg}<br>` +
      `도전 횟수: ${G.tries.map((t, i) => `${i + 1}스테이지 ${t}번`).join(' · ')}<br>` +
      `제작 기록: ${G.log.map(l => `${l.acc}%→<span style="color:${GRADES[l.grade].col}">${GRADES[l.grade].name}</span>`).join(', ')}`;
    const q = new URLSearchParams(location.search); q.set('mode', MODE === 'a' ? 'b' : 'a');
    $('bOther').href = '?' + q; $('bOther').textContent = `${MODE === 'a' ? 'B(두 번 절삭)' : 'A(따라 긋기)'} 버전도 해 보기 →`;
  }
  $('bAgain').onclick = () => location.reload();
  $('bStart').onclick = () => { ac(); startCraft(false); };
  $('startMode').textContent = MODE === 'a' ? 'A 버전 · 따라 긋기' : 'B 버전 · 두 번 절삭';
  $('modeTag').textContent = MODE.toUpperCase() + ' 버전';

  // ---------- 공용 텍스처 ----------
  function makeTextures(sc) {
    if (sc.textures.exists('chip')) return;
    const g = sc.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff); g.fillPoints([{ x: 4, y: 0 }, { x: 14, y: 3 }, { x: 16, y: 12 }, { x: 7, y: 16 }, { x: 0, y: 9 }], true); g.generateTexture('chip', 16, 16); g.clear();
    g.fillStyle(0xffffff); g.fillCircle(32, 32, 32); g.generateTexture('flash', 64, 64); g.clear();
    g.fillStyle(0xffffff); g.fillCircle(4, 4, 4); g.generateTexture('dot', 8, 8); g.clear();
    g.fillStyle(0x9ff7ff); g.fillPoints([{ x: 8, y: 0 }, { x: 16, y: 10 }, { x: 8, y: 26 }, { x: 0, y: 10 }], true);
    g.fillStyle(0xffffff); g.fillPoints([{ x: 8, y: 2 }, { x: 11, y: 10 }, { x: 8, y: 14 }], true); g.generateTexture('shard', 16, 26); g.clear();
    g.fillStyle(0xffd27a); g.fillPoints([{ x: 6, y: 0 }, { x: 12, y: 9 }, { x: 9, y: 16 }, { x: 3, y: 16 }, { x: 0, y: 9 }], true); g.generateTexture('flame', 12, 16); g.destroy();
    const cv = sc.textures.createCanvas('glow', 64, 64), cx = cv.getContext(), rg = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = rg; cx.fillRect(0, 0, 64, 64); cv.refresh();
  }
  function preloadAll(sc) {
    sc.load.image('forge_bg', 'img/forge_bg.jpg');
    for (const t of ['soft', 'armor', 'guardian', 'cursed']) sc.load.image(t, `img/${t}.png`);
    for (const t of ['pick1', 'pick4', 'pick8']) sc.load.image(t, `img/${t}.webp`);
  }

  // ===================================================================
  // 대장간 장면: 재료가 화로에 · 액션(A 따라 긋기 / B 두 번 절삭) · 등급 판정
  // ===================================================================
  class Forge extends Phaser.Scene {
    constructor() { super('forge'); }
    preload() { preloadAll(this); }
    create() {
      makeTextures(this);
      const bg = this.add.image(W / 2, H / 2, 'forge_bg');
      const s = Math.max(W / bg.width, H / bg.height); bg.setScale(s);
      this.bgS = s;
      const P = (ix, iy) => ({ x: W / 2 + (ix - bg.width / 2) * s, y: H / 2 + (iy - bg.height / 2) * s });
      this.anvil = P(470, 870); this.furnace = P(150, 760);
      this.cx = this.anvil.x - 15; this.cy = this.anvil.y + 5;   // 작업물 중심 (모루 윗면에 올려 둠)
      // 화로 불빛
      this.fireGlow = this.add.image(this.furnace.x, this.furnace.y, 'glow').setScale(5).setTint(0xff8a3c).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: this.fireGlow, alpha: 0.55, scale: 5.6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.add.particles(0, 0, 'dot', { x: { min: this.furnace.x - 60, max: this.furnace.x + 60 }, y: this.furnace.y - 20, speedY: { min: -120, max: -40 }, speedX: { min: -20, max: 30 }, lifespan: 1600, scale: { start: 0.7, end: 0 }, tint: [0xffb04a, 0xff7a1a, 0xffe08a], frequency: 90, blendMode: 'ADD' });
      this.matIcons = this.add.container(0, 0);
      this.layer = this.add.container(0, 0);
      this.spark = this.add.particles(0, 0, 'dot', { emitting: false, speed: { min: 120, max: 380 }, angle: { min: 0, max: 360 }, gravityY: 900, lifespan: 500, scale: { start: 0.9, end: 0 }, tint: [0xffe08a, 0xffb04a, 0xffffff], blendMode: 'ADD' }).setDepth(20);
      this.input.on('pointerdown', () => ac());
      if (draft) this.setFurnace(draft.mats);
    }
    setFurnace(mats) {
      if (!this.matIcons) return;
      this.matIcons.removeAll(true);
      mats.forEach((m, i) => {
        const t = this.add.text(this.furnace.x - 50 + i * 50, this.furnace.y + 40, MATS[m].ico, { fontSize: '40px' }).setOrigin(0.5);
        this.matIcons.add(t);
        this.tweens.add({ targets: t, y: t.y - 8, duration: 500 + i * 80, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      });
    }

    // ---- 달군 금속 (작업물) ----
    hotPoly(g, pts, a = 1) {
      g.clear();
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      const inset = t => pts.map(p => ({ x: cx + (p.x - cx) * t, y: cy + (p.y - cy) * t }));
      // 두께(아래쪽 어두운 면)
      g.fillStyle(0x4a1404, a); g.fillPoints(pts.map(p => ({ x: p.x, y: p.y + 14 })), true);
      // 가장자리 → 가운데로 갈수록 뜨거운 색 (여러 겹으로 부드럽게)
      const C = [0x8a2406, 0xb8380a, 0xe0540e, 0xff6f14, 0xff8a22, 0xffa338, 0xffbd55, 0xffd47a, 0xffe7a8, 0xfff4d6];
      C.forEach((col, i) => { g.fillStyle(col, a); g.fillPoints(inset(1 - i * 0.085), true); });
      // 표면 얼룩(쇠 비늘)
      g.fillStyle(0x7a2a08, 0.25 * a);
      for (let i = 0; i < 9; i++) { const p = pts[i % pts.length], t = 0.25 + ((i * 37) % 50) / 100; g.fillEllipse(cx + (p.x - cx) * t + ((i * 53) % 40 - 20), cy + (p.y - cy) * t * 0.6, 18 + (i * 7) % 14, 8 + (i * 5) % 6); }
      g.lineStyle(4, 0x2a0a02, a); g.strokePoints(pts, true, true);
      g.lineStyle(2, 0xffe2a0, 0.5 * a); g.strokePoints(inset(0.97).map(p => ({ x: p.x, y: p.y - 2 })), true, true);
    }
    beginAction(mode, shape, done) {
      this.layer.removeAll(true);
      this.done = done; this.shape = shape;
      this.glowBack = this.add.image(this.cx, this.cy, 'glow').setScale(9, 5).setTint(0xff7a1a).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
      this.layer.add(this.glowBack);
      this.slab = [{ x: -205, y: -88 }, { x: 205, y: -88 }, { x: 214, y: -70 }, { x: 214, y: 70 }, { x: 205, y: 84 }, { x: -205, y: 84 }, { x: -214, y: 70 }, { x: -214, y: -70 }];
      this.metal = this.add.graphics().setPosition(this.cx, this.cy); this.layer.add(this.metal);
      this.hotPoly(this.metal, this.slab);
      this.tweens.add({ targets: this.glowBack, alpha: 0.75, duration: 600, yoyo: true, repeat: -1 });
      SFX.sizzle();
      if (mode === 'a') this.beginTrace(); else this.beginCut();
    }
    local(p) { return { x: p.x - this.cx, y: p.y - this.cy }; }
    sampleGuide(shape) {
      const pts = [];
      if (shape === 'heavy') { // 넓은 곡선
        for (let i = 0; i <= 60; i++) { const t = i / 60, x = -185 + 370 * t, y = 45 - 4 * 120 * t * (1 - t); pts.push({ x, y }); }
      } else {                 // 짧고 뾰족한 날
        const A = { x: -130, y: 50 }, B = { x: 0, y: -80 }, C = { x: 130, y: 50 };
        for (let i = 0; i <= 30; i++) pts.push({ x: A.x + (B.x - A.x) * i / 30, y: A.y + (B.y - A.y) * i / 30 });
        for (let i = 1; i <= 30; i++) pts.push({ x: B.x + (C.x - B.x) * i / 30, y: B.y + (C.y - B.y) * i / 30 });
      }
      return pts;
    }
    // ---------- A: 따라 긋기 ----------
    beginTrace() {
      const guide = this.sampleGuide(this.shape);
      const gG = this.add.graphics().setPosition(this.cx, this.cy); this.layer.add(gG);
      const trail = this.add.graphics().setPosition(this.cx, this.cy); this.layer.add(trail); this.trailG = trail;
      const covered = guide.map(() => false);
      const drawGuide = () => {
        gG.clear();
        for (let i = 0; i < guide.length; i++) {
          const p = guide[i];
          gG.fillStyle(covered[i] ? 0xffffff : 0xfff3c0, covered[i] ? 1 : 0.45 + 0.25 * Math.sin(this.time.now / 150 + i * 0.3));
          gG.fillCircle(p.x, p.y, covered[i] ? 5 : 4);
        }
        // 시작점 표시
        gG.lineStyle(4, 0xffffff, 0.9); gG.strokeCircle(guide[0].x, guide[0].y, 14 + 4 * Math.sin(this.time.now / 120));
        gG.strokeCircle(guide[guide.length - 1].x, guide[guide.length - 1].y, 10);
      };
      this.guideTimer = this.time.addEvent({ delay: 50, loop: true, callback: drawGuide });
      drawGuide();
      const hint = this.add.text(this.cx, this.cy + 150, '○ 에서 시작해 선을 따라 쭉!', { fontFamily: 'sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#ffffff', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
      this.layer.add(hint);
      let stroke = null, last = 0;
      const distTo = (p, arr) => arr.reduce((m, q) => Math.min(m, Math.hypot(p.x - q.x, p.y - q.y)), 1e9);
      const onDown = ptr => { stroke = [this.local(ptr)]; trail.clear(); covered.fill(false); hint.setVisible(false); };
      const onMove = ptr => {
        if (!stroke || !ptr.isDown) return;
        const p = this.local(ptr), q = stroke[stroke.length - 1];
        if (Math.hypot(p.x - q.x, p.y - q.y) < 4) return;
        stroke.push(p);
        const d = distTo(p, guide), on = d < 22;
        // 홈 파기: 어두운 홈 + 빛
        trail.lineStyle(14, on ? 0x5a1800 : 0x2a0800, 0.9); trail.lineBetween(q.x, q.y, p.x, p.y);
        trail.lineStyle(5, on ? 0xfff1b0 : 0xff4a3a, 1); trail.lineBetween(q.x, q.y, p.x, p.y);
        guide.forEach((g, i) => { if (!covered[i] && Math.hypot(g.x - p.x, g.y - p.y) < 26) covered[i] = true; });
        if (on) { this.spark.explode(3, ptr.x, ptr.y); if (this.time.now - last > 45) { SFX.scrape(); last = this.time.now; } }
        else if (this.time.now - last > 120) { tone(180, 160, 0.06, 0.05, 'square'); last = this.time.now; }
      };
      const onUp = () => {
        if (!stroke) return;
        const cov = covered.filter(Boolean).length / covered.length;
        if (stroke.length < 8 || cov < 0.55) { stroke = null; trail.clear(); covered.fill(false); hint.setText('끝까지 이어서 그어 주세요!').setVisible(true); return; }
        const d1 = guide.reduce((s, g) => s + Math.min(60, distTo(g, stroke)), 0) / guide.length;
        const d2 = stroke.reduce((s, p) => s + Math.min(60, distTo(p, guide)), 0) / stroke.length;
        const acc = Phaser.Math.Clamp(100 - 2.2 * (0.6 * d1 + 0.4 * d2) - (1 - cov) * 60, 0, 100);
        this.input.off('pointerdown', onDown); this.input.off('pointermove', onMove); this.input.off('pointerup', onUp);
        this.guideTimer.remove(); gG.clear();
        this.finishWork(acc);
      };
      this.input.on('pointerdown', onDown); this.input.on('pointermove', onMove); this.input.on('pointerup', onUp);
    }
    // ---------- B: 두 번 절삭 ----------
    beginCut() {
      const CUTS = this.shape === 'heavy'
        ? [{ a: { x: -225, y: 10 }, b: { x: -70, y: -110 } }, { a: { x: 70, y: -110 }, b: { x: 225, y: 10 } }]
        : [{ a: { x: -225, y: 95 }, b: { x: -10, y: -110 } }, { a: { x: 10, y: -110 }, b: { x: 225, y: 95 } }];
      const keep = { x: 0, y: 70 };
      const scores = []; let k = 0;
      const gL = this.add.graphics().setPosition(this.cx, this.cy); this.layer.add(gL);
      const trail = this.add.graphics().setPosition(this.cx, this.cy); this.layer.add(trail); this.trailG = trail;
      const hint = this.add.text(this.cx, this.cy + 150, '', { fontFamily: 'sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#ffffff', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
      this.layer.add(hint);
      const drawLine = () => {
        gL.clear(); if (k >= CUTS.length) return;
        const { a, b } = CUTS[k], L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.floor(L / 18), ph = (this.time.now / 40) % 18;
        gL.lineStyle(5, 0xffffff, 0.95);
        for (let i = 0; i < n; i++) {
          const t0 = (i * 18 + ph) / L, t1 = Math.min(1, (i * 18 + ph + 9) / L); if (t0 > 1) break;
          gL.lineBetween(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0, a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
        }
        gL.fillStyle(0xffffff, 1); gL.fillCircle(a.x, a.y, 9); gL.fillCircle(b.x, b.y, 9);
      };
      this.guideTimer = this.time.addEvent({ delay: 40, loop: true, callback: drawLine });
      hint.setText(`점선을 따라 쭉 그어 자르기 (${k + 1}/2)`);
      let st = null, path = [];
      const onDown = ptr => { st = this.local(ptr); path = [st]; trail.clear(); };
      const onMove = ptr => {
        if (!st || !ptr.isDown) return;
        const p = this.local(ptr), q = path[path.length - 1]; if (Math.hypot(p.x - q.x, p.y - q.y) < 5) return;
        path.push(p);
        trail.lineStyle(6, 0xffffff, 0.9); trail.lineBetween(q.x, q.y, p.x, p.y);
        this.spark.explode(2, ptr.x, ptr.y);
        if (Math.random() < 0.4) SFX.scrape();
      };
      const onUp = () => {
        if (!st || k >= CUTS.length) return;
        const en = path[path.length - 1], { a, b } = CUTS[k];
        const GL = Math.hypot(b.x - a.x, b.y - a.y), PL = Math.hypot(en.x - st.x, en.y - st.y);
        trail.clear();
        if (PL < GL * 0.55) { hint.setText('더 길게, 끝까지 그어 주세요!'); st = null; return; }
        // 각도 차이 · 위치 차이
        let ang = Math.abs(Math.atan2(b.y - a.y, b.x - a.x) - Math.atan2(en.y - st.y, en.x - st.x)) * 180 / Math.PI;
        ang = ang % 180; if (ang > 90) ang = 180 - ang;
        const lineDist = (p) => Math.abs((en.x - st.x) * (st.y - p.y) - (st.x - p.x) * (en.y - st.y)) / PL;
        const off = (lineDist(a) + lineDist(b)) / 2;
        const sc = Phaser.Math.Clamp(100 - ang * 2.2 - off * 0.9, 0, 100);
        scores.push(sc);
        // 플레이어가 그은 선으로 실제로 자름
        const side = v => Math.sign((en.x - st.x) * (v.y - st.y) - (en.y - st.y) * (v.x - st.x));
        const ks = side(keep) || 1;
        const kept = clip(this.slab, st, en, ks), waste = clip(this.slab, st, en, -ks);
        if (kept.length >= 3) this.slab = kept;
        this.hotPoly(this.metal, this.slab);
        SFX.cut(); this.cameras.main.shake(90, 0.006);
        // 잘린 조각 떨어지기
        if (waste.length >= 3) {
          const wg = this.add.graphics().setPosition(this.cx, this.cy); this.layer.add(wg);
          this.hotPoly(wg, waste);
          const dir = Math.sign(waste.reduce((s, v) => s + v.x, 0)) || 1;
          this.tweens.add({ targets: wg, x: this.cx + dir * 160, y: this.cy + 420, angle: dir * 70, alpha: 0, duration: 750, ease: 'Quad.In', onComplete: () => wg.destroy() });
        }
        // 절단선 불꽃
        for (let i = 0; i <= 10; i++) this.spark.explode(3, this.cx + st.x + (en.x - st.x) * i / 10, this.cy + st.y + (en.y - st.y) * i / 10);
        const t = this.add.text(this.cx, this.cy - 150, `${Math.round(sc)}%`, { fontFamily: FONT, fontSize: '44px', color: sc >= 80 ? '#ffd54a' : '#ffffff', stroke: '#000', strokeThickness: 8 }).setOrigin(0.5);
        this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, duration: 900, onComplete: () => t.destroy() });
        k++; st = null;
        if (k < CUTS.length) { hint.setText(`한 번 더! (${k + 1}/2)`); return; }
        hint.setVisible(false);
        this.input.off('pointerdown', onDown); this.input.off('pointermove', onMove); this.input.off('pointerup', onUp);
        this.guideTimer.remove(); gL.clear();
        this.time.delayedCall(500, () => this.finishWork(scores.reduce((x, y) => x + y, 0) / scores.length));
      };
      this.input.on('pointerdown', onDown); this.input.on('pointermove', onMove); this.input.on('pointerup', onUp);
    }
    finishWork(acc) {
      // 담금질: 치익 + 김
      SFX.sizzle();
      const steam = this.add.particles(this.cx, this.cy - 30, 'glow', { speedY: { min: -160, max: -60 }, speedX: { min: -40, max: 40 }, lifespan: 1200, scale: { start: 0.6, end: 2.2 }, alpha: { start: 0.35, end: 0 }, tint: 0xffffff, quantity: 2, frequency: 30 });
      this.layer.add(steam);
      this.time.delayedCall(500, () => steam.stop());
      this.done(acc);
    }
    // ---------- 등급 판정 연출 ----------
    spinGrade(grade, cb) {
      const ring = this.add.image(this.cx, this.cy, 'glow').setScale(4).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9); this.layer.add(ring);
      const label = this.add.text(this.cx, this.cy - 170, '', { fontFamily: FONT, fontSize: '54px', color: '#fff', stroke: '#000', strokeThickness: 10 }).setOrigin(0.5); this.layer.add(label);
      const seq = []; const total = 14 + grade + 3 * Math.floor(Math.random() * 2);
      for (let i = 0; i < total; i++) seq.push(i % 3);
      while (seq[seq.length - 1] !== grade) seq.push(seq.length % 3);
      let i = 0;
      const step = () => {
        const g = GRADES[seq[i]];
        ring.setTint(g.hex).setScale(4 + 0.4 * seq[i]); label.setText(g.name).setColor(g.col);
        SFX.tick(seq[i]);
        i++;
        if (i < seq.length) this.time.delayedCall(60 + Math.pow(i / seq.length, 3) * 420, step);
        else this.time.delayedCall(350, () => this.landGrade(grade, ring, label, cb));
      };
      step();
    }
    landGrade(grade, ring, label, cb) {
      const g = GRADES[grade];
      const c = Phaser.Display.Color.IntegerToRGB(g.hex); this.cameras.main.flash(200, c.r, c.g, c.b);
      SFX.fanfare(grade);
      if (grade >= 1) this.cameras.main.shake(200 + grade * 150, 0.006 * (grade + 1));
      this.metal.setVisible(false); this.glowBack.setVisible(false); this.trailG?.setVisible(false);
      // 완성 곡괭이
      const pk = this.add.container(this.cx, this.cy - 20); this.layer.add(pk);
      const tex = g.tex;
      if (draft.shape === 'fast') {
        pk.add(this.add.image(-60, 0, tex).setScale(0.7).setAngle(-20));
        pk.add(this.add.image(60, 0, tex).setScale(0.7).setFlipX(true).setAngle(20));
      } else pk.add(this.add.image(0, 0, tex).setScale(1.15));
      pk.setScale(0.2);
      this.tweens.add({ targets: pk, scale: 1, duration: 450, ease: 'Back.Out' });
      this.tweens.add({ targets: ring, scale: 9 + grade * 3, alpha: 0.35, duration: 500 });
      label.setText(g.name);
      this.tweens.add({ targets: label, scale: { from: 1.6, to: 1 }, duration: 300, ease: 'Back.Out' });
      const burst = this.add.particles(this.cx, this.cy, 'dot', { emitting: false, speed: { min: 200, max: 600 }, lifespan: 900, scale: { start: 1.2, end: 0 }, tint: [g.hex, 0xffffff], blendMode: 'ADD' }); this.layer.add(burst);
      burst.explode(30 + grade * 40);
      // 재료 효과 (곡괭이 머리 주변)
      if (draft.mats.includes('fire')) { const f = this.add.particles(this.cx, this.cy - 80, 'flame', { x: { min: -90, max: 90 }, speedY: { min: -90, max: -40 }, lifespan: 700, scale: { start: 1.6, end: 0 }, tint: [0xff8a3c, 0xffd27a], frequency: 60, blendMode: 'ADD' }); this.layer.add(f); }
      if (draft.mats.includes('crystal')) { const c = this.add.particles(this.cx, this.cy - 60, 'shard', { x: { min: -100, max: 100 }, y: { min: -40, max: 40 }, lifespan: 900, scale: { start: 0.8, end: 0 }, alpha: { start: 1, end: 0 }, frequency: 120, blendMode: 'ADD' }); this.layer.add(c); }
      this.time.delayedCall(700, cb);
    }
  }
  // 반평면 자르기 (볼록 다각형)
  function clip(poly, p, q, keepSign) {
    const side = v => (q.x - p.x) * (v.y - p.y) - (q.y - p.y) * (v.x - p.x);
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const A = poly[i], B = poly[(i + 1) % poly.length], sa = side(A) * keepSign, sb = side(B) * keepSign;
      if (sa >= 0) out.push(A);
      if ((sa >= 0) !== (sb >= 0)) { const t = sa / (sa - sb); out.push({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t }); }
    }
    return out;
  }

  // ===================================================================
  // 광산 장면: 자동 전투 (제한 시간)
  // ===================================================================
  const OY = Math.round((H - 1000) * 0.45);
  const POS = { C: { x: 360, y: 520 + OY, size: 300 }, L: { x: 132, y: 800 + OY, size: 170 }, R: { x: 588, y: 800 + OY, size: 170 } };
  const COLOR = { soft: 0xc0702c, armor: 0x5d636c, guardian: 0x8a6aa8, cursed: 0x6b4a8a };
  class Mine extends Phaser.Scene {
    constructor() { super('mine'); }
    preload() { preloadAll(this); }
    create() {
      makeTextures(this);
      const g = this.add.graphics().setDepth(-10);
      for (let i = 0; i < 40; i++) { const t = i / 39; g.fillStyle(Phaser.Display.Color.GetColor(22 + 20 * t, 16 + 12 * t, 26 + 12 * t)); g.fillRect(0, H * t, W, H / 39 + 1); }
      g.fillStyle(0x0d0a10, 1);
      g.fillPoints([{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 70, y: 180 + OY }, { x: 95, y: 360 + OY }, { x: 40, y: 560 + OY }, { x: 0, y: 620 + OY }], true);
      g.fillPoints([{ x: W, y: 0 }, { x: 590, y: 0 }, { x: 650, y: 200 + OY }, { x: 615, y: 380 + OY }, { x: 680, y: 560 + OY }, { x: W, y: 640 + OY }], true);
      const fy = 875 + OY;
      g.fillStyle(0x2a1d22, 1); g.fillPoints([{ x: 0, y: fy + 25 }, { x: 180, y: fy }, { x: 360, y: fy + 15 }, { x: 540, y: fy - 3 }, { x: W, y: fy + 23 }, { x: W, y: H }, { x: 0, y: H }], true);
      this.add.image(W / 2, 520 + OY, 'glow').setScale(12).setAlpha(0.18).setTint(0xffa860).setDepth(-9);
      this.ores = {}; this.picks = []; this.running = false;
      this.chips = {};
      this.flameFx = this.add.particles(0, 0, 'flame', { emitting: false, speedY: { min: -140, max: -60 }, speedX: { min: -30, max: 30 }, lifespan: 600, scale: { start: 1.6, end: 0 }, tint: [0xff8a3c, 0xffd27a, 0xff5a1a], blendMode: 'ADD' }).setDepth(7);
      this.hud = this.add.text(W / 2, 40, '', { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#000', strokeThickness: 7 }).setOrigin(0.5, 0).setDepth(10);
      this.bar = this.add.graphics().setDepth(10);
      this.input.on('pointerdown', () => ac());
    }
    startStage(idx, pick, upg, done) {
      this.S = STAGES[idx]; this.done = done; this.st = stats(pick, upg); this.pick = pick;
      Object.keys(this.ores).forEach(k => this.removeOre(k));
      this.picks.forEach(p => p.img.destroy()); this.picks = [];
      this.count = 0; this.left = this.S.time; this.burns = []; this.shield = false; this.halfDone = false;
      if (this.S.type === 'count') { ['C', 'L', 'R'].forEach(k => this.spawn(k, { tex: 'soft', hp: 18, armor: 0 }, 0.6)); }
      else this.spawn('C', this.S.main, 1);
      const sh = SHAPES[pick.shape], tex = GRADES[pick.grade].tex;
      for (let i = 0; i < sh.picks; i++) this.picks.push({ img: this.add.image(0, 0, tex).setDepth(5), scale: sh.picks === 2 ? 0.62 : 0.95, side: i === 0 ? 1 : -1, busy: false });
      // 재료 효과: 곡괭이에 불꽃·수정 빛
      this.auras?.forEach(a => a.destroy()); this.auras = [];
      this.picks.forEach(p => {
        if (pick.mats.includes('fire')) this.auras.push(this.add.particles(0, 0, 'flame', { follow: p.img, followOffset: { x: 0, y: -40 }, speedY: { min: -60, max: -20 }, lifespan: 400, scale: { start: 1.1, end: 0 }, tint: [0xff8a3c, 0xffd27a], frequency: 70, blendMode: 'ADD' }).setDepth(6));
        if (pick.mats.includes('crystal')) this.auras.push(this.add.particles(0, 0, 'dot', { follow: p.img, lifespan: 500, scale: { start: 0.8, end: 0 }, tint: 0x9ff7ff, frequency: 110, blendMode: 'ADD', speed: 30 }).setDepth(6));
      });
      this.nextSwing = 0.5; this.pickTurn = 0;
      this.picks.forEach(p => this.restPose(p, this.target()));
      this.running = true; this.drawHud();
      const go = this.add.text(W / 2, H * 0.3, '시작!', { fontFamily: FONT, fontSize: '80px', color: '#ffd54a', stroke: '#000', strokeThickness: 12 }).setOrigin(0.5).setDepth(12);
      this.tweens.add({ targets: go, scale: { from: 1.6, to: 1 }, alpha: { from: 1, to: 0 }, duration: 900, onComplete: () => go.destroy() });
    }
    spawn(slot, d, sizeK) {
      const p = POS[slot], size = (slot === 'C' ? p.size : p.size) * sizeK * (slot === 'C' && this.S.type !== 'count' ? 1 : 1);
      const img = this.add.image(p.x, p.y, d.tex).setDepth(2); const s = size / 256; img.setScale(0);
      this.tweens.add({ targets: img, scale: s, duration: 260, ease: 'Back.Out' });
      if (d.tex === 'guardian') this.tweens.add({ targets: img, scaleX: s * 1.04, scaleY: s * 0.97, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: 300 });
      const bar = this.add.graphics().setDepth(4);
      const o = { slot, d, img, s, size, bar, hp: d.hp, max: d.hp, alive: true, x: p.x, y: p.y };
      this.ores[slot] = o; this.drawBar(o); return o;
    }
    removeOre(k) { const o = this.ores[k]; if (!o) return; o.alive = false; o.img.destroy(); o.bar.destroy(); o.shieldG?.destroy(); delete this.ores[k]; }
    drawBar(o) {
      const w = o.size * 0.75, y = o.y - o.size * 0.58;
      o.bar.clear(); o.bar.fillStyle(0x000000, 0.6); o.bar.fillRoundedRect(o.x - w / 2 - 3, y - 3, w + 6, 16, 8);
      o.bar.fillStyle(o.d.armor >= 5 ? 0x9db3c8 : 0x5be37d, 1); o.bar.fillRoundedRect(o.x - w / 2, y, Math.max(0, w * o.hp / o.max), 10, 5);
    }
    target() {
      const alive = Object.values(this.ores).filter(o => o.alive);
      if (!alive.length) return null;
      if (this.S.type === 'count') return alive.sort((a, b) => a.hp - b.hp)[0];
      if (this.shield) return alive.find(o => o.slot !== 'C') || alive[0];
      return this.ores.C?.alive ? this.ores.C : alive[0];
    }
    geom(p, o) {
      let side = p.side; if (this.picks.length === 1) side = o.x > W / 2 + 10 ? -1 : 1;
      const flip = side === 1, dist = o.size * 0.5 + 120 * p.scale;
      const px = o.x + side * dist, py = o.y + 40, tw = p.img.width, th = p.img.height;
      const ox = flip ? 0.88 : 0.12, hx = flip ? 0.4 : 0.6;
      const vx = (hx - ox) * tw, vy = (0.15 - 0.95) * th;
      const aimX = o.x + side * o.size * 0.12, aimY = o.y - o.size * 0.05;
      const strike = Math.atan2(aimY - py, aimX - px) - Math.atan2(vy, vx);
      const reach = Math.hypot(aimX - px, aimY - py) / Math.hypot(vx, vy);
      return { px, py, flip, ox, strike, sc: Phaser.Math.Clamp(reach, p.scale * 0.8, p.scale * 1.15), side, aimX, aimY };
    }
    restPose(p, o) {
      if (!o) return; const g = this.geom(p, o);
      p.img.setFlipX(g.flip).setOrigin(g.ox, 0.95).setScale(g.sc).setPosition(g.px, g.py).setRotation(g.strike + g.side * 0.55);
    }
    swing() {
      const o = this.target(); if (!o) return;
      const p = this.picks[this.pickTurn % this.picks.length]; this.pickTurn++;
      if (p.busy) return; p.busy = true;
      const heavy = this.pick.shape === 'heavy', g = this.geom(p, o);
      p.img.setFlipX(g.flip).setOrigin(g.ox, 0.95).setScale(g.sc).setPosition(g.px, g.py);
      this.tweens.chain({ targets: p.img, tweens: [
        { rotation: g.strike + g.side * (heavy ? 1.15 : 0.9), y: g.py - (heavy ? 28 : 10), duration: heavy ? 520 : 110, ease: 'Sine.Out' },
        { rotation: g.strike, y: g.py, duration: heavy ? 100 : 70, ease: 'Quad.In', onComplete: () => this.impact(o, g) },
        { rotation: g.strike + g.side * 0.55, duration: heavy ? 260 : 120, ease: 'Sine.Out', onComplete: () => { p.busy = false; } },
      ] });
    }
    impact(o, g) {
      if (!this.running || !o.alive) return;
      const heavy = this.pick.shape === 'heavy', k = heavy ? 0.85 : 0.2;
      const hx = g.aimX + Phaser.Math.Between(-16, 16), hy = g.aimY + Phaser.Math.Between(-16, 16);
      this.hitStop(heavy ? 90 : 25); this.cameras.main.shake(heavy ? 130 : 50, heavy ? 0.01 : 0.003);
      const dealt = this.damage(o, this.st.hit, hx, hy, k, true);
      // 화상: 실제 들어간 피해에 비례 (방어 다시 적용 안 함)
      if (this.st.fire && dealt > 0 && !(o.slot === 'C' && this.shield)) this.burns.push({ o, left: dealt * 0.3 * this.st.fire, rate: dealt * 0.3 * this.st.fire / 2 });
      // 파편: 타격의 35% (방어 적용)
      for (let i = 0; i < this.st.shards; i++) this.fireShard(o, hx, hy, this.st.hit * 0.35, i);
    }
    hitStop(ms) { this.tweens.timeScale = 0.03; clearTimeout(this._hs); this._hs = setTimeout(() => { this.tweens.timeScale = 1; }, ms); }
    damage(o, raw, x, y, k, main, isBurn) {
      if (!o.alive || !this.running) return 0;
      if (o.slot === 'C' && this.shield) { this.num(x, y - 20, '막힘', 0.3, '#9fc4ff'); if (main) SFX.armor(); return 0; }
      const dealt = isBurn ? raw : Math.max(1, raw - o.d.armor), blocked = !isBurn && o.d.armor > 0 && raw < o.d.armor * 2;
      o.hp -= dealt;
      if (!isBurn) {
        o.img.setTintFill(0xffffff); this.time.delayedCall(40, () => o.img.active && o.img.clearTint());
        const f = this.add.image(x, y, 'flash').setDepth(7).setScale(0.3 + 0.5 * k).setAlpha(0.9).setBlendMode(Phaser.BlendModes.ADD).setTint(blocked ? 0x9fc4ff : 0xfff1c0);
        this.tweens.add({ targets: f, scale: 0.9 + 1.3 * k, alpha: 0, duration: 150, onComplete: () => f.destroy() });
        this.chipFx(o, x, y, Math.round(4 + 10 * k));
        if (main) blocked ? SFX.armor() : SFX.hit(k); else SFX.clink();
      }
      this.num(x, y - 20, isBurn ? r1(dealt) : Math.round(dealt), isBurn ? 0.05 : k, isBurn ? '#ff9a4a' : blocked ? '#9fc4ff' : k > 0.6 ? '#ffd54a' : '#ffffff');
      this.drawBar(o);
      if (o.slot === 'C' && this.S.type === 'boss' && !this.halfDone && o.hp <= o.max / 2) this.raiseShield(o);
      if (o.hp <= 0) this.shatter(o);
      return dealt;
    }
    raiseShield(o) {
      this.halfDone = true; this.shield = true;
      o.shieldG = this.add.circle(o.x, o.y, o.size * 0.6).setStrokeStyle(8, 0x7fd8ff, 0.9).setFillStyle(0x7fd8ff, 0.12).setDepth(3);
      this.tweens.add({ targets: o.shieldG, alpha: 0.6, duration: 400, yoyo: true, repeat: -1 });
      this.banner('보호막!', '#7fd8ff');
      ['L', 'R'].forEach(k => this.spawn(k, { tex: 'cursed', hp: 34, armor: 0 }, 0.85));
    }
    chipFx(o, x, y, n) {
      const col = COLOR[o.d.tex] || 0x888888;
      if (!this.chips[col]) this.chips[col] = this.add.particles(0, 0, 'chip', { emitting: false, tint: [col, 0x3a3440], speed: { min: 160, max: 440 }, angle: { min: 190, max: 350 }, gravityY: 1300, lifespan: 700, scale: { min: 0.5, max: 1.3 }, rotate: { min: 0, max: 360 } }).setDepth(6);
      this.chips[col].explode(n, x, y);
    }
    num(x, y, n, k, col) {
      const t = this.add.text(x + Phaser.Math.Between(-24, 24), y, String(n), { fontFamily: FONT, fontSize: `${Math.round(26 + 34 * k)}px`, color: col, stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(9);
      this.tweens.add({ targets: t, y: y - 60 - 40 * k, alpha: { from: 1, to: 0 }, duration: 700, ease: 'Cubic.Out', onComplete: () => t.destroy() });
    }
    fireShard(from, x, y, dmg, i) {
      const cands = Object.values(this.ores).filter(o => o.alive && o !== from);
      const t = cands.length ? Phaser.Utils.Array.GetRandom(cands) : from;
      const tx = t.x + Phaser.Math.Between(-30, 30), ty = t.y + Phaser.Math.Between(-30, 20);
      const sh = this.add.image(x, y, 'shard').setDepth(8).setScale(1.4).setBlendMode(Phaser.BlendModes.ADD);
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x, y), new Phaser.Math.Vector2((x + tx) / 2 + Phaser.Math.Between(-80, 80), Math.min(y, ty) - Phaser.Math.Between(100, 200)), new Phaser.Math.Vector2(tx, ty));
      const s = { t: 0 };
      this.tweens.add({ targets: s, t: 1, duration: 280 + i * 40, delay: i * 40, ease: 'Sine.In',
        onUpdate: () => { const q = curve.getPoint(s.t), q2 = curve.getPoint(Math.min(1, s.t + 0.05)); sh.setPosition(q.x, q.y).setRotation(Math.atan2(q2.y - q.y, q2.x - q.x) + Math.PI / 2); },
        onComplete: () => { sh.destroy(); if (t.alive) this.damage(t, dmg, tx, ty, 0.1, false); } });
    }
    shatter(o) {
      o.alive = false;
      const big = o.slot === 'C' && this.S.type !== 'count';
      [[0, 0, -1, -1], [128, 0, 1, -1], [0, 128, -1, 1], [128, 128, 1, 1]].forEach(([cx, cy, dx, dy]) => {
        const pc = this.add.image(o.x, o.y, o.d.tex).setScale(o.s).setCrop(cx, cy, 128, 128).setDepth(6);
        this.tweens.add({ targets: pc, x: o.x + dx * Phaser.Math.Between(70, 150) * (big ? 1.4 : 0.8), y: o.y + dy * 40 + Phaser.Math.Between(40, 150), angle: dx * Phaser.Math.Between(25, 70), alpha: 0, duration: 600, ease: 'Cubic.Out', onComplete: () => pc.destroy() });
      });
      const f = this.add.image(o.x, o.y, 'flash').setDepth(7).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe9a8);
      this.tweens.add({ targets: f, scale: big ? 7 : 3, alpha: 0, duration: 280, onComplete: () => f.destroy() });
      this.chipFx(o, o.x, o.y, big ? 40 : 14);
      this.hitStop(big ? 160 : 40); this.cameras.main.shake(big ? 260 : 90, big ? 0.016 : 0.006); SFX.brk(big);
      this.removeOre(o.slot);
      if (this.S.type === 'count') {
        this.count++; this.drawHud();
        if (this.count >= this.S.need) return this.finish(true);
        this.time.delayedCall(350, () => { if (this.running && !this.ores[o.slot]) this.spawn(o.slot, { tex: 'soft', hp: 18, armor: 0 }, 0.6); });
      } else if (o.slot === 'C') return this.finish(true);
      else if (this.shield && !Object.values(this.ores).some(x => x.alive && x.slot !== 'C')) {
        this.shield = false; const c = this.ores.C; c?.shieldG?.destroy(); this.banner('보호막 해제!', '#ffd54a');
      }
    }
    banner(text, color) {
      const t = this.add.text(W / 2, H * 0.24, text, { fontFamily: FONT, fontSize: '60px', color, stroke: '#000', strokeThickness: 10 }).setOrigin(0.5).setDepth(11).setScale(0.5);
      this.tweens.chain({ targets: t, tweens: [{ scale: 1.1, duration: 140, ease: 'Back.Out' }, { scale: 1, duration: 80 }, { alpha: 0, delay: 600, duration: 300, onComplete: () => t.destroy() }] });
    }
    drawHud() {
      const S = this.S;
      const goal = S.type === 'count' ? `작은 광석 ${this.count} / ${S.need}` : S.type === 'boss' ? '수호자 쓰러뜨리기' : '철갑 광맥 파괴';
      this.hud.setText(goal);
      const w = W - 120, x = 60, y = 100, f = Math.max(0, this.left / S.time);
      this.bar.clear(); this.bar.fillStyle(0x000000, 0.6); this.bar.fillRoundedRect(x - 4, y - 4, w + 8, 26, 13);
      this.bar.fillStyle(f > 0.3 ? 0xffd54a : 0xff5a5f, 1); this.bar.fillRoundedRect(x, y, w * f, 18, 9);
    }
    finish(win) {
      if (!this.running) return; this.running = false;
      this.burns = [];
      this.time.delayedCall(win ? 500 : 200, () => {
        win ? SFX.win() : SFX.lose();
        this.banner(win ? '성공!' : '시간 초과…', win ? '#5be37d' : '#ff5a5f');
        this.time.delayedCall(1300, () => this.done(win));
      });
    }
    update(time, delta) {
      if (!this.running) return;
      const dt = Math.min(0.05, delta / 1000);
      this.left -= dt; if ((this._hudT = (this._hudT || 0) + dt) > 0.1) { this._hudT = 0; this.drawHud(); }
      if (this.left <= 0) return this.finish(false);
      this.nextSwing -= dt * this.tweens.timeScale;
      if (this.nextSwing <= 0) { this.nextSwing += this.st.every; this.swing(); }
      // 화상 (0.25초마다)
      this._burnT = (this._burnT || 0) + dt;
      if (this._burnT >= 0.25 && this.burns.length) {
        this._burnT = 0;
        const per = new Map();
        this.burns.forEach(b => { if (!b.o.alive) { b.left = 0; return; } const d = Math.min(b.left, b.rate * 0.25); b.left -= d; per.set(b.o, (per.get(b.o) || 0) + d); });
        this.burns = this.burns.filter(b => b.left > 0.01);
        per.forEach((d, o) => { if (d > 0) { this.damage(o, d, o.x + Phaser.Math.Between(-40, 40), o.y - 30, 0, false, true); this.flameFx.explode(4, o.x + Phaser.Math.Between(-o.size * 0.3, o.size * 0.3), o.y - o.size * 0.1); } });
        if (per.size) SFX.burn();
      }
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', backgroundColor: '#120e14',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY, width: W, height: H },
    scene: [Forge, Mine],
  });
  window.__forge = { G, game, stats, STAGES, startCraft, stageIntro, afterStage };
})();
