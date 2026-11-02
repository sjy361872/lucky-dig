// =====================================================
//  곡괭이 키우기 — 화면 (자동 사냥 · 슬롯 연출 · 강화 · 보스전 · 오프라인 보상)
//   계산은 js/idle.js (Idle), 카드 목록은 js/config.js, 소리는 js/sound.js
// =====================================================
(function () {
  const C = window.CONFIG, I = window.Idle, Sound = window.Sound;
  const $ = s => document.querySelector(s);
  const SAVE_KEY = 'pickidle_v1';
  const rnd = Math.random;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // ---------- 숫자: 만 · 억 · 조 · 경 ----------
  const UNITS = [[1e16, '경'], [1e12, '조'], [1e8, '억'], [1e4, '만']];
  function fmt(n) {
    n = Math.floor(n);
    for (const [v, u] of UNITS) if (n >= v) { const x = n / v; return (x >= 100 ? Math.floor(x) : Math.floor(x * 10) / 10).toLocaleString('ko-KR') + u; }
    return n.toLocaleString('ko-KR');
  }
  const f2 = n => (Math.round(n * 100) / 100).toString();

  // ---------- 저장 ----------
  let st;
  function load() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.lv) { st = Object.assign(I.newState(), s); st.lv = Object.assign(I.newState().lv, s.lv); return; } } catch (e) { /* 새로 시작 */ }
    st = I.newState();
  }
  function save() { st.lastSeen = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(st)); } catch (e) { /* 저장 불가 */ } }

  // ---------- 화면 크기: 440×900 앱을 창에 맞춤 ----------
  function fit() {
    const s = Math.min(window.innerWidth / 440, window.innerHeight / 900);
    $('#app').style.transform = `scale(${s})`;
    $('#vp').style.width = 440 * s + 'px'; $('#vp').style.height = 900 * s + 'px';
  }
  window.addEventListener('resize', fit);

  // ---------- 그림 ----------
  const ICON = {
    pick: 'assets/items/pick2.png', tnt: 'assets/items/tnt.png', gem: 'assets/blocks/diamond.png',
    coin: 'assets/ui/coin.png', chest: 'assets/chests/c5.png', slot: 'assets/ui/cell_slot.png',
    pick3: 'assets/items/pick3.png', spin: 'assets/items/spin.png',
    rainbow: 'assets/syms/rainbow.webp', mimic: 'assets/syms/mimic.webp', egg: 'assets/syms/egg.webp',
    wrench: 'assets/syms/wrench.webp', glass: 'assets/syms/glass.webp', gold: 'assets/syms/gold.webp',
  };
  // ---------- 곡괭이 진화: 공격력 25레벨마다(= 대미지 2배 되는 순간) 다음 곡괭이 ----------
  const PICKS = [
    { name: '나무 곡괭이', c: '#e8d2a8' }, { name: '구리 곡괭이', c: '#ffb27a' }, { name: '철 곡괭이', c: '#cfe3ff' },
    { name: '황금 곡괭이', c: '#ffd34a' }, { name: '크리스탈 곡괭이', c: '#6fd8ff' }, { name: '용암 곡괭이', c: '#ff6a2a' },
    { name: '번개 곡괭이', c: '#c08aff' }, { name: '무지개 곡괭이', c: '#ff8af0' },
  ];
  const EVOLVE = 25;
  const tierOf = lv => Math.min(PICKS.length - 1, Math.floor(lv / EVOLVE));
  const pickSrc = t => `assets/picks/pick${t + 1}.webp`;
  function showPick() {
    const t = tierOf(st.lv.atk), el = $('#pick');
    el.dataset.t = t; el.style.setProperty('--pc', PICKS[t].c);
    el.querySelector('img').src = pickSrc(t);
    $('#pickName').textContent = PICKS[t].name;
  }
  // 진화 연출: 번쩍 → 새 곡괭이가 커졌다 돌아옴 → 배너
  async function evolve() {
    const t = tierOf(st.lv.atk), el = $('#pick');
    evolving = true; setTimeout(() => evolving = false, 600);
    Sound.play('drumroll');
    el.querySelector('img').animate([{ filter: 'brightness(1)' }, { filter: 'brightness(6) saturate(0)' }], { duration: 500, fill: 'forwards' });
    await wait(500);
    showPick();
    flash('#fff', .9, 500);
    const [x, y] = arenaXY(el);
    emit({ t: 'ring', x, y, r0: 20, r1: 230, w: 14, color: PICKS[t].c, life: .6 });
    for (let i = 0; i < 40; i++) { const a = rnd() * 6.28, sp = 200 + rnd() * 500; emit({ t: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: .9, w: 4, color: rnd() < .5 ? PICKS[t].c : '#fff', life: .5 + rnd() * .3 }); }
    el.querySelector('img').getAnimations().forEach(a => a.cancel());
    el.animate([{ transform: 'scale(1.6)' }, { transform: 'scale(.95)', offset: .6 }, { transform: 'scale(1)' }], { duration: 600, easing: 'ease-out' });
    banner(`${PICKS[t].name}로 진화!`, `대미지 ×2 · ${t + 1}단계`, PICKS[t].c, 2000);
    Sound.play('fanfare');
    shake($('#arena'), 10, 400);
  }
  const img = (k, cls = '') => `<img class="${cls}" src="${ICON[k]}" alt="" draggable="false">`;

  // ---------- 토스트 ----------
  let toastT;
  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1800); }

  // ---------- 팝업 ----------
  function modal(html, btn = '확인') {
    return new Promise(done => {
      const m = $('#modal');
      m.innerHTML = `<div class="box">${html}<button class="mbtn">${btn}</button></div>`;
      m.hidden = false;
      m.querySelector('.mbtn').onclick = () => { Sound.play('click'); m.hidden = true; m.innerHTML = ''; done(); };
    });
  }

  // ---------- 효과 ----------
  // 숫자 팝업: 크게 튀어나왔다가(punch) 옆으로 휘며 위로 사라짐
  function floatAt(x, y, text, cls = '', ms = 900, o = {}) {
    const d = document.createElement('div');
    d.className = 'fl ' + cls; d.textContent = text;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    $('#fx').appendChild(d);
    const dx = o.dx || 0, p = o.punch || 1.15;
    d.animate([
      { transform: `translate(-50%,0) scale(${p * 1.3})`, opacity: 0 },
      { transform: `translate(-50%,-10px) scale(${p})`, opacity: 1, offset: .1 },
      { transform: `translate(calc(-50% + ${dx * .4}px),-26px) scale(1)`, opacity: 1, offset: .3 },
      { transform: `translate(calc(-50% + ${dx}px),-60px) scale(.85)`, opacity: 0 },
    ], { duration: ms, easing: 'cubic-bezier(.2,.8,.3,1)' });
    setTimeout(() => d.remove(), ms);
  }
  // 요소 중심의 전투 화면(440×330) 좌표
  function arenaXY(el) {
    const a = $('#arena').getBoundingClientRect(), r = el.getBoundingClientRect(), sc = a.width / 440;
    return [(r.left + r.width / 2 - a.left) / sc, (r.top + r.height / 2 - a.top) / sc];
  }
  // 화면 번쩍
  function flash(color, a = .5, ms = 260) {
    const f = $('#flash'); f.style.background = color;
    f.animate([{ opacity: a }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
  }
  // 큰 글씨 배너(잭팟 등): 뒤에서 빛줄기가 돌아감
  function banner(text, sub, color = '#ffd34a', ms = 1500) {
    const d = document.createElement('div');
    d.className = 'banner' + (text.length > 7 ? ' long' : ''); d.style.setProperty('--c', color);
    d.innerHTML = `<i class="rays"></i><b>${text}</b>${sub ? `<small>${sub}</small>` : ''}`;
    $('#fx').appendChild(d);
    d.animate([
      { transform: 'translate(-50%,-50%) scale(2.8)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(.95)', opacity: 1, offset: .12 },
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: .2 },
      { transform: 'translate(-50%,-50%) scale(1.04)', opacity: 1, offset: .8 },
      { transform: 'translate(-50%,-50%) scale(.8)', opacity: 0 },
    ], { duration: ms, easing: 'ease-out' });
    setTimeout(() => d.remove(), ms);
  }

  // ---------- 입자(캔버스): 파편 · 불꽃 · 충격파 · 베기 궤적 · 코인 ----------
  const P = { list: [], cx: null, run: false, last: 0 };
  const coinImg = new Image(); coinImg.src = ICON.coin;
  function emit(p) {
    p.max = p.life; P.list.push(p);
    if (!P.run) { P.run = true; P.last = 0; requestAnimationFrame(pTick); }
  }
  function pTick(t) {
    const dt = Math.min(.05, P.last ? (t - P.last) / 1000 : .016); P.last = t;
    const c = P.cx; c.clearRect(0, 0, 440, 330);
    P.list = P.list.filter(p => {
      p.life -= dt; if (p.life <= 0) return false;
      const k = p.life / p.max;               // 1 → 0
      p.vy += (p.g || 0) * dt; p.vx *= p.drag || 1; p.vy *= p.drag || 1;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.floor && p.y > p.floor) { p.y = p.floor; p.vy *= -.45; p.vx *= .7; }
      c.save(); c.globalAlpha = Math.min(1, k * 1.6);
      if (p.t === 'shard') {
        p.rot += p.vr * dt; c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.color;
        c.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .66);
      } else if (p.t === 'spark') {
        c.globalCompositeOperation = 'lighter'; c.strokeStyle = p.color; c.lineWidth = p.w * k + .5; c.lineCap = 'round';
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * .04, p.y - p.vy * .04); c.stroke();
      } else if (p.t === 'ring') {
        const r = p.r1 - (p.r1 - p.r0) * k * k;
        c.strokeStyle = p.color; c.lineWidth = p.w * k; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.stroke();
      } else if (p.t === 'slash') {
        const prog = 1 - k, a0 = p.a - p.sweep / 2, a1 = a0 + p.sweep * Math.min(1, prog * 3);
        c.globalCompositeOperation = 'lighter'; c.shadowColor = p.color; c.shadowBlur = 16;
        c.strokeStyle = '#fff'; c.lineWidth = p.w * k; c.lineCap = 'round';
        c.beginPath(); c.arc(p.x, p.y, p.r, a0, a1); c.stroke();
      } else if (p.t === 'coin') {
        p.rot += dt * 12; c.translate(p.x, p.y); c.scale(Math.abs(Math.cos(p.rot)) * .8 + .2, 1);
        c.drawImage(coinImg, -p.s / 2, -p.s / 2, p.s, p.s);
      }
      c.restore();
      return true;
    });
    if (P.list.length) requestAnimationFrame(pTick); else { P.run = false; c.clearRect(0, 0, 440, 330); }
  }
  const ROCK = ['#8a6a4a', '#c9a26a', '#5a4030', '#e2c393', '#6b5040'];
  const HOT = ['#fff6c0', '#ffd34a', '#ff9a3a'];
  const hot = () => rnd() < .4 ? PICKS[tierOf(st.lv.atk)].c : pick(HOT);
  const pick = a => a[Math.floor(rnd() * a.length)];
  // 한 대 때릴 때: 베기 궤적 + 불꽃 + 돌 파편 (+크리티컬이면 충격파)
  function hitBurst(x, y, crit, huge) {
    const a = -0.6 + (rnd() - .5) * .8;
    emit({ t: 'slash', x: x - 10, y, r: crit ? 70 : 55, a, sweep: 2.2, w: crit ? 12 : 8, color: crit ? '#ffd34a' : PICKS[tierOf(st.lv.atk)].c, life: .22 });
    const n = huge ? 26 : crit ? 16 : 8;
    for (let i = 0; i < n; i++) {
      const ang = rnd() * Math.PI * 2, sp = 250 + rnd() * (crit ? 520 : 300);
      emit({ t: 'spark', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, drag: .9, w: 3, color: hot(), life: .25 + rnd() * .2 });
    }
    for (let i = 0; i < (crit ? 10 : 5); i++) {
      emit({ t: 'shard', x, y, vx: 80 + rnd() * 260, vy: -150 - rnd() * 260, g: 1100, rot: rnd() * 6, vr: (rnd() - .5) * 20, s: 4 + rnd() * 6, color: pick(ROCK), floor: 300, life: .7 + rnd() * .4 });
    }
    if (crit) emit({ t: 'ring', x, y, r0: 10, r1: huge ? 150 : 90, w: huge ? 10 : 6, color: huge ? '#ffd34a' : '#fff', life: .35 });
  }
  // 처치: 몬스터가 터지며 파편이 사방으로
  function killBurst(x, y, big) {
    emit({ t: 'ring', x, y, r0: 20, r1: big ? 220 : 120, w: 12, color: '#fff', life: .4 });
    for (let i = 0; i < (big ? 50 : 24); i++) {
      const ang = rnd() * Math.PI * 2, sp = 150 + rnd() * (big ? 600 : 380);
      emit({ t: 'shard', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 200, g: 1000, rot: rnd() * 6, vr: (rnd() - .5) * 24, s: 5 + rnd() * 8, color: pick(rnd() < .5 ? ROCK : HOT), floor: 300, life: .8 + rnd() * .5 });
    }
    for (let i = 0; i < (big ? 30 : 12); i++) {
      const ang = rnd() * Math.PI * 2, sp = 300 + rnd() * 500;
      emit({ t: 'spark', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, drag: .88, w: 4, color: pick(HOT), life: .35 + rnd() * .2 });
    }
  }
  // 코인 비: 화면 위에서 코인이 쏟아져 바닥에 튕김
  function coinShower(n) {
    for (let i = 0; i < n; i++) setTimeout(() => emit({ t: 'coin', x: 30 + rnd() * 380, y: -20, vx: (rnd() - .5) * 80, vy: 100 + rnd() * 200, g: 900, rot: rnd() * 6, s: 22 + rnd() * 10, floor: 290 + rnd() * 20, life: 1.4 + rnd() * .5 }), i * 35);
  }

  // ---------- 광석 숫자: 바로 바뀌지 않고 촤르륵 올라감 ----------
  let goldShown = 0;
  function goldTick() {
    const target = st.gold, d = target - goldShown;
    if (Math.abs(d) < 1) goldShown = target; else goldShown += d * .2;
    const t = fmt(goldShown);
    if ($('#gold').textContent !== t) $('#gold').textContent = t;
    requestAnimationFrame(goldTick);
  }
  function goldBump() { $('#hud .gold').animate([{ transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' }); }
  function coinFly(n) {
    const from = $('#mob .mimg').getBoundingClientRect(), to = $('#hud .gold img').getBoundingClientRect(), app = $('#app').getBoundingClientRect();
    const sc = app.width / 440;
    for (let i = 0; i < Math.min(6, n); i++) {
      const c = document.createElement('img');
      c.src = ICON.coin; c.className = 'coinfly';
      const x0 = (from.left + from.width / 2 - app.left) / sc + (rnd() - .5) * 60, y0 = (from.top + from.height / 2 - app.top) / sc + (rnd() - .5) * 40;
      const x1 = (to.left - app.left) / sc, y1 = (to.top - app.top) / sc;
      c.style.left = x0 + 'px'; c.style.top = y0 + 'px';
      $('#app').appendChild(c);
      c.animate([{ transform: 'translate(0,0) scale(.6)' }, { transform: `translate(${(x1 - x0) * .3}px,${-40 + (y1 - y0) * .1}px) scale(1)`, offset: .35 }, { transform: `translate(${x1 - x0}px,${y1 - y0}px) scale(.5)` }], { duration: 650 + i * 60, easing: 'ease-in' });
      setTimeout(() => { c.remove(); goldBump(); }, 650 + i * 60);
    }
  }
  // 흔들림: 무작위 방향으로, 점점 약해지게
  function shake(el, amp = 5, ms = 220) {
    amp = Math.min(16, amp);
    const k = [], n = 7;
    for (let i = 0; i < n; i++) { const d = amp * (1 - i / n); k.push({ translate: `${(rnd() - .5) * 2 * d}px ${(rnd() - .5) * 2 * d}px` }); }
    k.push({ translate: '0 0' });
    el.animate(k, { duration: ms });
  }

  // ---------- 슬롯 ----------
  let cellEls = [], held = [];
  function buildCells() {
    const n = I.stat.cells(st.lv.cells), box = $('#cells');
    box.innerHTML = '';
    cellEls = [];
    for (let i = 0; i < 5; i++) {
      const d = document.createElement('div');
      d.className = 'cell' + (i >= n ? ' locked' : '');
      d.innerHTML = i >= n ? `<span>🔒</span>` : '';
      d.dataset.i = i;
      box.appendChild(d);
      if (i < n) cellEls.push(d);
    }
  }
  function showSyms(syms, r) {
    let n = 0;
    syms.forEach((s, i) => {
      const el = cellEls[i]; if (!el) return;
      const to = r ? r.res[i] : s;
      el.innerHTML = img(s) + (r && s === 'rainbow' ? `<em class="wildto">${img(to)}</em>` : '') + (r && r.boosted[i] ? '<b class="x2">×2</b>' : '');
      const on = !!(r && r.comboSym && to === r.comboSym);
      el.classList.toggle('combo', on);
      el.classList.toggle('chest', s === 'chest' || s === 'mimic');
      el.classList.toggle('boost', !!(r && r.boosted[i]));
      el.classList.toggle('jack', !!(r && r.jackpot && to === 'gold'));
      // 콤보 칸은 왼쪽부터 차례로 통통 튐
      if (on || s === 'chest' || s === 'mimic' || (r && r.boosted[i])) el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.22) translateY(-8px)' }, { transform: 'scale(1)' }], { duration: 260, delay: (n++) * 55, easing: 'ease-out' });
    });
  }
  const popCell = el => el.animate([{ transform: 'scale(1.18) translateY(-5px)' }, { transform: 'scale(.96)', offset: .6 }, { transform: 'scale(1)' }], { duration: 170, easing: 'ease-out' });
  // 릴 연출: 고정 안 한 칸은 잠깐 섞였다가 왼쪽부터 멈춤
  async function spinAnim(syms, ms, keep) {
    const keys = I.unlocked(st), n = syms.length, t0 = performance.now();
    $('#calc').classList.add('dim');
    cellEls.forEach((el, i) => { el.classList.remove('combo', 'chest', 'boost', 'jack'); if (!(keep && keep[i])) el.classList.add('spinning'); });
    while (true) {
      const el = performance.now() - t0;
      let left = 0;
      for (let i = 0; i < n; i++) {
        if (keep && keep[i]) continue;
        const stopAt = ms * (0.55 + 0.45 * (i + 1) / n);
        if (el < stopAt) { left++; cellEls[i].innerHTML = img(keys[Math.floor(rnd() * keys.length)]); }
        else if (cellEls[i].classList.contains('spinning')) { cellEls[i].classList.remove('spinning'); cellEls[i].innerHTML = img(syms[i]); popCell(cellEls[i]); if (ms > 300) Sound.play('stop'); }
      }
      if (!left) break;
      await wait(ms > 300 ? 60 : 40);
    }
    showSyms(syms);
  }
  function setCalc(html) { const c = $('#calc'); c.innerHTML = html; c.classList.remove('dim'); }
  function calcText(r, syms) {
    const parts = [`${f2(r.hits)}타`, `공격력 ${fmt(r.atk)}`];
    if (r.combo > 1) parts.push(`콤보 ×${r.combo}`);
    if (r.chests) parts.push(`상자 ×${f2(r.chestMult)}`);
    if (r.mimics) parts.push(r.mimicOk === null ? '미믹 ?' : r.mimicOk ? `미믹 ×${fmt(r.mimicMult)}` : '미믹 꽝');
    if (r.dragon) parts.push(`🐲 ×${I.DRAGON_X}`);
    if (r.jackpot) parts[parts.indexOf(`콤보 ×${r.combo}`)] = `잭팟 ×${r.combo}`;
    return `${parts.join(' × ')} = <b>${fmt(r.dmg)}</b>`;
  }

  // ---------- 몬스터 ----------
  let mob = null, mobHp = 0, mobMax = 1, mode = 'auto', alive = true;
  // 몬스터 그림 미리 받아 두기: 지금 광산 + 다음 광산
  const sprOf = card => C.cardImg(card).replace('assets/cards/', 'assets/mobs/').replace('.jpg', '.webp');
  const imgCache = {};
  function preload(src) { return imgCache[src] || (imgCache[src] = Object.assign(new Image(), { src })); }
  let preMine = null;
  function preloadMines() {
    const t = I.mineOf(C, st.floor); if (t === preMine) return; preMine = t;
    [t, I.mineOf(C, st.floor + I.FLOORS_PER_MINE)].forEach(k => { for (const g of 'SABCDEF') (C.TIERS[k].cards[g] || []).forEach((c, idx) => preload(sprOf({ ...c, tier: k, grade: g, idx }))); });
  }
  function setMob(card, hp, boss) {
    mob = card; mobHp = mobMax = hp;
    // 전투 화면에선 흰 배경을 잘라낸 스프라이트(assets/mobs/*.webp) → 배경 위에 서 있는 것처럼
    const spr = sprOf(card);
    // 그림이 아직 안 받아졌으면(휴대폰 데이터 등) 받아진 뒤에 바꿈 → 빈칸으로 보이는 순간 없게
    const show = () => { if (mob !== card) return; $('#mobImg').src = spr; const cr = $('#mob .crack'); cr.style.webkitMaskImage = cr.style.maskImage = `url(${spr})`; };
    const pre = preload(spr);
    if (pre.complete && pre.naturalWidth) show(); else { pre.addEventListener('load', show, { once: true }); setTimeout(show, 1500); }
    // 이전 처치·보스 격파 연출(끝난 뒤에도 '사라진 상태'로 남는 애니메이션)을 확실히 지움
    $('#mob').getAnimations().forEach(a => a.cancel());
    $('#mobName').textContent = (boss ? '👑 ' : '') + card.name;
    $('#mob').className = boss ? 'boss' : '';
    $('#mob').animate([{ transform: 'translateX(120px)', opacity: 0 }, { transform: 'translateX(-8px)', opacity: 1, offset: .7 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'ease-out' });
    setHp(true);
  }
  function setHp(reset) {
    const w = Math.max(0, mobHp / mobMax * 100) + '%', g = $('#hpGhost');
    $('#hpFill').style.width = w;
    // 흰 잔상 바: 잠깐 남았다가 따라 줄어듦 → 얼마나 깎였는지 보임
    if (reset) { g.style.transition = 'none'; g.style.width = w; void g.offsetWidth; g.style.transition = ''; } else g.style.width = w;
    $('#hpText').textContent = `${fmt(Math.max(0, mobHp))} / ${fmt(mobMax)}`;
    hurtLook();
  }
  // ---------- 맞은 모습: 몬스터별 그림 없이 코드로 ----------
  //  금 간 무늬를 몬스터 실루엣(투명 배경 그림)대로만 덧씌움 → 체력이 줄수록 금이 늘어남
  //  체력 30% 아래면 붉어지고 부들부들 떨림
  const CRACKS = [];
  function makeCracks() {
    let seed = 7; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let prev = null;
    for (let stage = 0; stage < 3; stage++) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 256;
      const c = cv.getContext('2d');
      if (prev) c.drawImage(prev, 0, 0);                     // 앞 단계 금 위에 더 그림
      const line = (x, y, ang, len, w, depth) => {
        let px = x, py = y;
        for (let i = 0; i < len; i++) {
          ang += (r() - .5) * .9;
          const nx = px + Math.cos(ang) * 9, ny = py + Math.sin(ang) * 9;
          c.lineCap = 'round';
          c.strokeStyle = 'rgba(35,15,5,.95)'; c.lineWidth = w; c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny); c.stroke();
          c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = w * .4; c.beginPath(); c.moveTo(px + 1.2, py + 1.2); c.lineTo(nx + 1.2, ny + 1.2); c.stroke();
          px = nx; py = ny; w *= .93;
          if (depth < 2 && r() < .18) line(px, py, ang + (r() < .5 ? 1 : -1) * (.6 + r() * .6), len * .5, w * .8, depth + 1);
        }
      };
      for (let k = 0; k < 2 + stage; k++) { const a = r() * 6.28; line(128 + Math.cos(a) * 20, 120 + Math.sin(a) * 20, a, 10 + stage * 2, 7, 0); }
      CRACKS.push(cv.toDataURL()); prev = cv;
    }
  }
  function hurtLook() {
    const f = Math.max(0, mobHp / mobMax), m = $('#mob');
    const stage = f > .75 ? -1 : f > .5 ? 0 : f > .25 ? 1 : 2;
    const cr = $('#mob .crack');
    if (cr.dataset.s != stage) { cr.dataset.s = stage; cr.style.backgroundImage = stage < 0 ? 'none' : `url(${CRACKS[stage]})`; }
    m.classList.toggle('weak', f > 0 && f <= .3);
  }
  // 크리티컬: 머리 위로 별이 빙글빙글 (기절)
  function dizzy() {
    const s = $('#mob .stars'); s.innerHTML = '<i>⭐</i><i>💫</i><i>⭐</i>';
    s.classList.remove('on'); void s.offsetWidth; s.classList.add('on');
    clearTimeout(dizzy.t); dizzy.t = setTimeout(() => { s.classList.remove('on'); s.innerHTML = ''; }, 1000);
  }
  function newMob() { setMob(I.mobCard(C, st.floor, rnd, false), I.mobHp(st.floor), false); alive = true; }

  // 공격 한 번: 광부 휘두름 → 몬스터 맞음
  async function hit(r, big) {
    const mi = $('#pick');
    mi.classList.remove('swing'); void mi.offsetWidth; mi.classList.add('swing');
    await wait(125);                                    // 곡괭이가 내려꽂히는 순간에 맞춤
    const m = $('#mob .mimg'), [x, y] = arenaXY(m);
    const crit = r.combo > 1 || r.chests > 0 || r.mimicOk;
    const huge = r.jackpot || r.comboN >= 4 || r.chests >= 2 || (r.combo > 1 && r.chests > 0) || (r.mimicOk && r.combo > 1);
    if (r.dragon) dragonFire(x, y);
    const frac = Math.min(1, r.dmg / mobMax);           // 체력의 몇 %를 깎았나 → 흔들림 크기
    mobHp -= r.dmg;
    m.classList.remove('hurt'); void m.offsetWidth;
    // 히트스톱: 큰 한 방은 화면이 아주 잠깐 멈춤 → '묵직하다'는 느낌
    if (crit) {
      m.style.filter = 'brightness(4) saturate(0)'; mi.firstElementChild.style.animationPlayState = 'paused';
      hitBurst(x, y, true, huge);
      await wait(huge ? 150 : 75);
      m.style.filter = ''; mi.firstElementChild.style.animationPlayState = '';
    } else hitBurst(x, y, false, false);
    m.classList.add(crit ? 'hurtbig' : 'hurt');
    if (crit) dizzy();
    setTimeout(() => m.classList.remove('hurtbig'), 350);
    floatAt(x + (rnd() - .5) * 40, y - 70, fmt(r.dmg), crit ? 'crit' : '', crit ? 1300 : 800, { dx: (rnd() - .5) * 70, punch: crit ? 1.9 : 1.3 });
    Sound.play('hit', { type: crit ? 'diamond' : 'stone', ratio: .5 });
    if (r.jackpot) jackpotFx(r);
    else if (huge) {
      const t = r.comboN >= 5 ? '잭팟!!' : r.chests >= 2 ? '보물 대박!' : r.combo > 1 && r.chests ? '콤보 + 상자!' : `${r.comboN}콤보!`;
      banner(t, `대미지 ×${fmt(r.combo * r.chestMult)}`, r.chests ? '#ffd34a' : '#7ff7ff');
      flash('#fff', .7, 320);
      if (r.comboN >= 5 || r.chests >= 2) coinShower(16);
      Sound.play('chestBig');
    } else {
      if (r.combo > 1) { floatAt(220, 150, `${I.SYMS[r.comboSym].name} ${r.comboN}개 콤보! ×${r.combo}`, 'combo', 1300, { punch: 1.5 }); Sound.play('big'); flash('#7ff7ff', .25); }
      if (r.chests) { floatAt(220, 120, `📦 상자 ×${f2(r.chestMult)}!`, 'chestf', 1300, { punch: 1.6 }); Sound.play('chestBig'); flash('#ffd34a', .35); }
      if (r.mimicOk) { floatAt(220, 95, `👅 미믹 ×${fmt(r.mimicMult)}!`, 'chestf', 1300, { punch: 1.7 }); Sound.play('chestBig'); flash('#ff7ad9', .35); }
    }
    if (r.boosted.some(Boolean)) { cellEls.forEach((el, i) => { if (r.boosted[i]) el.animate([{ filter: 'brightness(2.5)' }, { filter: 'brightness(1)' }], { duration: 300 }); }); }
    // 효과: 수리 · 미믹 물기 · 알 · 용 · 잭팟 광석
    const fx = I.applySpin(st, r);
    const [px, py] = arenaXY($('#pick'));
    if (r.repair) { floatAt(px, py - 50, `🔧 +${fmt(I.maxDur(st) * r.repair)}`, 'repf', 900, { dx: 10 }); setDur(); }
    if (fx.bite) {
      $('#pick').animate([{ transform: 'translateX(-14px) rotate(-10deg)', filter: 'sepia(1) saturate(6) hue-rotate(-40deg)' }, { transform: 'none', filter: 'none' }], { duration: 320 });
      floatAt(px, py - 40, `👅 깨물! -${fmt(fx.bite)}`, 'dmgf', 1100, { punch: 1.5 });
      flash('#ff2a2a', .3, 260); Sound.play('last'); setDur();
    }
    if (r.respins) floatAt(220, 70, `⏳ 한 번 더!${r.respins > 1 ? ' ×' + r.respins : ''}`, 'glassf', 1000, { punch: 1.5 });
    if (r.cracks || r.dragon || fx.hatched) setEgg(fx.hatched, r.cracks);
    if (fx.hatched) hatchFx();
    r.fx = fx;
    if (r.coins) { const g = I.coinGold(st, r.coins); st.gold += g; floatAt(110, 150, `+${fmt(g)}`, 'goldf', 900, { dx: -20 }); goldBump(); }
    setHp();
    shake($('#arena'), 1.5 + frac * 10 + (crit ? 4 : 0) + (huge ? 8 : 0) + (big ? 2 : 0));
  }
  async function killMob(big) {
    alive = false;
    const g = I.onKill(st);
    Sound.play('coin');
    const m = $('#mob'), [x, y] = arenaXY($('#mob .mimg'));
    killBurst(x, y, big);
    floatAt(x, y - 110, `+${fmt(g)}`, 'goldf big', 1000, { punch: 1.6 });
    coinFly(big ? 6 : 4);
    m.animate([{ opacity: 1, transform: 'scale(1)', filter: 'brightness(1)' }, { opacity: 1, transform: 'scale(1.18)', filter: 'brightness(4)', offset: .3 }, { opacity: 0, transform: 'scale(.2)', filter: 'brightness(4)' }], { duration: 260, fill: 'forwards' });
    refresh();
    await wait(I.IDLE.RESPAWN * 1000);
    m.getAnimations().forEach(a => a.cancel());
    if (mode === 'auto') newMob();          // 그 사이 보스전이 시작됐으면 보스를 일반 몬스터로 덮어쓰지 않음
  }

  // ---------- 자동 사냥 루프 ----------
  let freeSpins = 0;
  async function autoLoop() {
    while (true) {
      if (mode !== 'auto' || document.hidden) { await wait(200); continue; }
      const aps = I.stat.aps(st.lv.spd), period = 1000 / aps;
      const t0 = performance.now();
      const syms = I.roll(st, rnd), r = I.evalSpin(st, syms, rnd);
      await spinAnim(syms, Math.min(260, period * 0.5));
      if (mode !== 'auto' || !alive) continue;
      showSyms(syms, r);
      setCalc(calcText(r, syms));
      await hit(r);
      if (st.dur <= 0 && mode === 'auto' && !breaking) { await breakPick(); continue; }
      if (r.fx && r.fx.jackGold) await wait([600, 1800, 3000][Math.min(5, r.comboN) - 3]);
      if (mobHp <= 0 && alive && mode === 'auto') await killMob();
      if (r.respins && mode === 'auto') { freeSpins += r.respins; }
      refreshTop();
      // 자동 도전: 켜져 있거나, 이미 깬 스테이지로 되돌아온 경우(파손 뒤 복귀)엔 보스도 자동
      if (mode === 'auto' && I.bossReady(st) && (st.auto || st.floor < st.best)) { await bossFight(true); continue; }
      if (freeSpins > 0) { freeSpins--; await wait(120); continue; }
      const rest = period - (performance.now() - t0);
      if (rest > 0) await wait(rest);
    }
  }

  // ---------- 보스전 (직접 플레이) ----------
  function bossDecision(syms, rer) {
    return new Promise(done => {
      $('#bossCtl').hidden = false;
      const paint = () => {
        cellEls.forEach((el, i) => el.classList.toggle('held', !!held[i]));
        const b = $('#bReroll');
        b.disabled = rer <= 0;
        b.innerHTML = `🔄 다시 돌리기<small>${rer > 0 ? `${rer}번 남음` : '다 썼어요'}</small>`;
        const r = I.evalSpin(st, syms);
        setCalc(`이대로 공격하면 ${calcText(r, syms)}`);
      };
      const onCell = e => {
        const el = e.target.closest('.cell'); if (!el || el.classList.contains('locked') || rer <= 0) return;
        const i = +el.dataset.i; held[i] = !held[i]; Sound.play('click'); paint();
      };
      $('#cells').addEventListener('click', onCell);
      paint();
      const end = v => { $('#cells').removeEventListener('click', onCell); $('#bossCtl').hidden = true; done(v); };
      $('#bReroll').onclick = () => { if (rer <= 0) return; if (held.slice(0, syms.length).every(Boolean)) return toast('전부 고정하면 다시 돌릴 게 없어요'); Sound.play('click'); end('reroll'); };
      $('#bAttack').onclick = () => { Sound.play('click'); end('attack'); };
      $('#bossQuit').onclick = () => { end('quit'); };
    });
  }
  // ---------- 곡괭이 내구도(= 체력) ----------
  function setDur() {
    const mx = I.maxDur(st), v = Math.max(0, st.dur);
    $('#durFill').style.width = (v / mx * 100) + '%';
    $('#durText').textContent = `${fmt(v)} / ${fmt(mx)}`;
    $('#durBar').classList.toggle('low', v / mx <= .3);
  }
  // 반격: 몬스터가 앞으로 튀어나와 곡괭이를 침 → 내구도 감소. 0이 되면 true
  async function mobStrike(dmg) {
    $('#mob').animate([{ transform: 'none' }, { transform: 'translateX(-70px) scale(1.08)', offset: .4 }, { transform: 'none' }], { duration: 320, easing: 'ease-in-out' });
    await wait(130);
    st.dur -= dmg;
    const pk = $('#pick'), [x, y] = arenaXY(pk);
    pk.animate([{ transform: 'translateX(-12px) rotate(-6deg)', filter: 'sepia(1) saturate(6) hue-rotate(-40deg)' }, { transform: 'none', filter: 'none' }], { duration: 280 });
    floatAt(x + 10, y - 30, `-${fmt(dmg)}`, 'dmgf', 800, { dx: -30, punch: 1.3 });
    flash('#ff2a2a', .16, 200);
    Sound.play('hit', { type: 'stone', ratio: .3 });
    setDur();
    return st.dur <= 0;
  }
  // 일반 몬스터는 일정 간격으로 반격
  let breaking = false;
  async function mobLoop() {
    while (true) {
      await wait(I.IDLE.MOB_HIT * 1000);
      if (mode !== 'auto' || document.hidden || !alive || breaking) continue;
      if (await mobStrike(I.mobAtk(st.floor))) await breakPick();
    }
  }
  // 곡괭이 파손 → 산산조각 → 챕터 첫 스테이지(x-1)로 돌아가 다시 사냥
  async function breakPick() {
    breaking = true; mode = 'break';
    const pk = $('#pick'), pim = pk.querySelector('img'), [x, y] = arenaXY(pk);
    const c = PICKS[tierOf(st.lv.atk)].c;
    pim.animate([{ transform: 'rotate(-22deg)', opacity: 1 }, { transform: 'rotate(60deg) translate(20px,80px)', opacity: 0 }], { duration: 650, fill: 'forwards', easing: 'ease-in' });
    for (let i = 0; i < 34; i++) { const a = rnd() * 6.28, sp = 120 + rnd() * 420; emit({ t: 'shard', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 150, g: 1000, rot: rnd() * 6, vr: (rnd() - .5) * 24, s: 5 + rnd() * 8, color: rnd() < .5 ? c : '#8a6a4a', floor: 300, life: .9 + rnd() * .4 }); }
    shake($('#arena'), 14, 450); flash('#000', .4, 450);
    Sound.play('last');
    I.breakPick(st);
    banner('곡괭이가 부러졌어요!', `${I.stageNo(st.floor)}부터 다시 · 내구도를 강화해 보세요`, '#ff7a6a', 2200);
    await wait(2000);
    pim.getAnimations().forEach(a => a.cancel());
    pk.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    toast('🔧 곡괭이 수리 완료!');
    recalc(); setDur(); newMob(); refresh(); save();
    mode = 'auto'; breaking = false;
  }

  // ---------- 보스전: 한 번 공격할 때마다 보스가 반격 · 내구도가 다 닳으면 패배 ----------
  //  auto=true 면 자동 도전(칸 고정·다시 돌리기도 알아서)
  async function autoDecision(syms, rer) {
    const r = I.evalSpin(st, syms);
    if (rer <= 0 || r.combo > 1 || r.chests > 0 || r.jackpot) return 'attack';

    const cnt = {}; syms.forEach(x => cnt[x] = (cnt[x] || 0) + 1);
    const top = Object.entries(cnt).filter(([k]) => !['coin', 'rainbow', 'mimic', 'wrench', 'egg'].includes(k)).sort((a, b) => b[1] - a[1])[0];
    held = syms.map(x => (top && x === top[0] && top[1] >= 2) || ['gem', 'chest', 'gold', 'rainbow', 'glass'].includes(x));
    cellEls.forEach((el, i) => el.classList.toggle('held', !!held[i]));
    await wait(320);
    return 'reroll';
  }
  let quitReq = false;
  async function bossFight(auto) {
    if (mode !== 'auto' || !I.bossReady(st)) return;
    mode = 'boss'; quitReq = false;
    await wait(300);
    document.body.classList.add('bossmode');
    document.body.classList.toggle('autoboss', !!auto);
    $('#bossBar').hidden = false;
    $('#bossQuit').onclick = () => { quitReq = true; };
    const card = I.mobCard(C, st.floor, rnd, true);
    $('#bossBar b').textContent = (I.isSBoss(st.floor) ? '💀 강적 보스' : '👑 보스전') + (auto ? ' · 자동' : '');
    setMob(card, I.bossHp(st.floor), true);
    st.dur = I.maxDur(st); setDur();                       // 보스전 시작 전 곡괭이 수리
    refreshTop();
    Sound.play('drumroll');
    floatAt(220, 120, 'BOSS!', 'bossf', 1400);
    await wait(auto ? 700 : 900);
    let rer = I.IDLE.BOSS_REROLLS, quit = false, turn = 0;
    while (mobHp > 0 && st.dur > 0 && !quit) {
      turn++;
      $('#bossTurns').textContent = `${turn}턴 · 다시 돌리기 ${rer}`;
      held = [];
      let syms = I.roll(st, rnd);
      await spinAnim(syms, auto ? 380 : 650);
      for (;;) {
        if (quitReq) { quit = true; break; }
        const v = auto ? await autoDecision(syms, rer) : await bossDecision(syms, rer);
        if (v === 'quit' || quitReq) { quit = true; break; }
        if (v === 'attack') break;
        rer--;
        $('#bossTurns').textContent = `${turn}턴 · 다시 돌리기 ${rer}`;
        const keep = held.slice();
        syms = I.roll(st, rnd, syms, keep);
        await spinAnim(syms, auto ? 350 : 550, keep);
      }
      cellEls.forEach(el => el.classList.remove('held'));
      if (quit) break;
      const r = I.evalSpin(st, syms, rnd);
      showSyms(syms, r);
      setCalc(calcText(r, syms));
      await hit(r, true);
      if (r.fx && r.fx.jackGold) await wait([600, 1800, 3000][Math.min(5, r.comboN) - 3]);
      // ⏳ 모래시계가 나오면 이번 턴은 보스가 반격 못 함
      if (mobHp > 0 && st.dur > 0) {
        if (r.respins) { floatAt(330, 60, '보스 반격 봉인!', 'glassf', 1000); await wait(300); }
        else { await wait(280); await mobStrike(I.bossAtk(st.floor)); }
      }
      await wait(auto ? 250 : 400);
    }
    $('#bossBar').hidden = true;
    document.body.classList.remove('bossmode', 'autoboss');
    if (mobHp <= 0) {
      // 보스 격파 연출: 크게 터지고 → 코인 비 → 배너 → (직접 도전이면) 카드 팝업
      const [bx, by] = arenaXY($('#mob .mimg'));
      killBurst(bx, by, true); flash('#fff', .9, 450); shake($('#arena'), 16, 450);
      $('#mob').animate([{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(1.25)', filter: 'brightness(5)', offset: .3 }, { transform: 'scale(0)', opacity: 0 }], { duration: 420, fill: 'forwards' });
      coinShower(auto ? 14 : 30);
      banner('보스 격파!', '다음 → ' + I.stageNo(st.floor + 1), '#ffd34a', 1600);
      Sound.play('fanfare');
      const key = C.cardKey(card), isNew = !st.dex[key];
      st.dex[key] = (st.dex[key] || 0) + 1;
      const before = I.unlocked(st);
      const g = I.bossWin(st);
      const fresh = I.unlocked(st).filter(k => !before.includes(k));
      save();
      if (auto) { await wait(1300); if (isNew) toast(`✨ 새 카드: ${card.name} (도감 등록)`); }
      else {
        await wait(1500);
        await modal(`<h3>보스 격파!</h3><div class="capture"><img src="${C.cardImg(card)}" alt=""><b>${card.name}</b><small>${card.grade}상 ${isNew ? '· ✨ 새 카드! 도감 등록' : '· 이미 있는 카드'}</small></div>
          <p>광석 <b>+${fmt(g)}</b><br>다음 스테이지 → <b>${floorName(st.floor)}</b></p>`, '계속');
      }
      buildCells();
      for (const k of fresh) await unlockFx(k, auto);
      if (fresh.length) setEgg();
    } else {
      I.bossLose(st);
      Sound.play('last');
      if (auto) { banner('보스에게 졌어요', '10마리 더 잡고 다시 도전해요', '#ff8a8a', 1800); await wait(1600); }
      else await modal(`<h3>${quit ? '도전 포기' : '아깝다!'}</h3><p>${quit ? '도전을 그만뒀어요' : '곡괭이가 버티지 못했어요'}. 보스 체력이 <b>${fmt(mobHp)}</b> 남았어요.<br>몬스터 10마리를 더 잡고 강화한 뒤 다시 도전하세요.</p>`, '돌아가기');
    }
    $('#calc').innerHTML = '';
    mode = 'auto';
    $('#mob').getAnimations().forEach(a => a.cancel());
    newMob(); setDur();
    refresh();
  }

  // ---------- 🥚 용의 알 · 🐲 새끼 용 ----------
  function setEgg(hatched, cracks) {
    const on = I.unlocked(st).includes('egg'), el = $('#eggBar');
    el.hidden = !on; if (!on) return;
    const d = st.dragon || 0;
    el.className = d > 0 ? 'dragon' : '';
    el.innerHTML = d > 0 ? `<span>🐲</span><b>새끼 용 · 대미지 ×${I.DRAGON_X}</b><small>${d}번 남음</small>`
      : `<span>🥚</span><b>용의 알</b><small>${st.egg || 0} / ${I.EGG_N}</small><i style="width:${(st.egg || 0) / I.EGG_N * 100}%"></i>`;
    $('#dragon').hidden = !(d > 0);
    if (cracks && !hatched && !d) el.animate([{ transform: 'scale(1.15) rotate(-4deg)' }, { transform: 'none' }], { duration: 300 });
  }
  async function hatchFx() {
    const [x, y] = arenaXY($('#pick'));
    flash('#ffb347', .8, 500); shake($('#arena'), 12, 400);
    for (let i = 0; i < 30; i++) { const a = rnd() * 6.28, sp = 150 + rnd() * 380; emit({ t: 'shard', x, y: y - 60, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 900, rot: rnd() * 6, vr: (rnd() - .5) * 20, s: 5 + rnd() * 7, color: rnd() < .5 ? '#f3e6c4' : '#a46ad0', floor: 300, life: .8 + rnd() * .4 }); }
    banner('새끼 용 부화!', `${I.DRAGON_T}번 동안 불을 뿜어요 · 대미지 ×${I.DRAGON_X}`, '#ff9a3a', 1800);
    Sound.play('fanfare');
    $('#dragon').animate([{ transform: 'scale(0) rotate(-40deg)' }, { transform: 'scale(1.5)', offset: .6 }, { transform: 'scale(1)' }], { duration: 600, easing: 'ease-out' });
  }
  // 용이 몬스터에게 불을 뿜음
  function dragonFire(tx, ty) {
    const [x, y] = arenaXY($('#dragon'));
    for (let i = 0; i < 14; i++) {
      const dx = tx - x, dy = ty - y, k = .9 + rnd() * .5;
      emit({ t: 'spark', x, y, vx: dx * 2.6 * k + (rnd() - .5) * 120, vy: dy * 2.6 * k + (rnd() - .5) * 120, drag: .96, w: 6, color: pick(['#fff3a0', '#ffb347', '#ff5a1f']), life: .35 + rnd() * .15 });
    }
  }
  // 💰 잭팟: 화면이 금빛으로 몇 번 번쩍 → 코인 폭포 → 광석 대량
  function jackpotFx(r) {
    // 3개 = 잭팟(자주) · 4개 = 메가(가끔) · 5개 = 그랜드(아주 드물게) → 등급이 높을수록 연출이 길고 화려함
    const lv = Math.min(5, r.comboN) - 3, ms = [1500, 2600, 3800][lv];
    const name = ['JACKPOT!', 'MEGA JACKPOT!!', 'GRAND JACKPOT!!!'][lv], color = ['#ffd34a', '#ff8af0', '#7ff7ff'][lv];
    document.body.classList.add('jackpot'); setTimeout(() => document.body.classList.remove('jackpot'), ms);
    banner(name, `황금 곡괭이 ${r.comboN}개 · 대미지 ×${fmt(r.combo)}`, color, ms);
    Sound.play('chestBig'); if (lv) Sound.play('fanfare');
    for (let k = 0; k < [2, 5, 9][lv]; k++) setTimeout(() => { flash(k % 2 ? '#fff' : color, .8, 260); shake($('#arena'), 8 + lv * 5, 300); }, k * 280);
    coinShower([30, 80, 160][lv]);
    const [x, y] = arenaXY($('#mob .mimg'));
    for (let k = 0; k < 1 + lv * 2; k++) setTimeout(() => emit({ t: 'ring', x, y, r0: 20, r1: 260, w: 14, color, life: .6 }), k * 250);
    setTimeout(() => { if (r.fx && r.fx.jackGold) { floatAt(220, 170, `+${fmt(r.fx.jackGold)}`, 'goldf big', 1600, { punch: 2.2 }); goldBump(); } }, 500);
  }
  // 새 심볼 해금
  async function unlockFx(k, auto) {
    const S = I.SYMS[k];
    Sound.play('fanfare');
    if (auto) { banner('새 심볼!', S.name, '#7ff7ff', 1800); toast(`✨ 새 심볼 ${S.name}: ${S.desc}`); await wait(1500); }
    else await modal(`<h3>✨ 새 심볼 해금!</h3><div class="capture"><img src="${ICON[k]}" alt="" style="width:110px;height:110px;object-fit:contain"><b>${S.name}</b><small>${S.desc}</small></div><p>이제 슬롯에 ${S.name}${(S.name.charCodeAt(S.name.length - 1) - 0xac00) % 28 ? '이' : '가'} 나와요</p>`, '좋아요');
  }

  // ---------- 상단 · 강화 목록 ----------
  const floorName = f => `${I.stageNo(f)} ${C.TIERS[I.mineOf(C, f)].name}`;
  let gpsCache = 0, avgCache = 1;
  function recalc() {
    gpsCache = I.goldPerSec(st);
    avgCache = I.avgDmg(st).dmg;
  }
  function refreshTop() {
    $('#gps').textContent = `초당 ${fmt(gpsCache)}`;
    setDur();
    $('#autoBtn').textContent = st.auto ? '자동 도전 ON' : '자동 도전 OFF';
    $('#autoBtn').classList.toggle('on', !!st.auto);
    $('#floorName').textContent = floorName(st.floor);
    preloadMines();
    // 안전장치: 사냥 중인데 몬스터가 안 보이는 상태로 남아 있으면 바로 복구
    if (mode === 'auto' && alive && +getComputedStyle($('#mob')).opacity < .1) $('#mob').getAnimations().forEach(a => a.cancel());
    $('#pips').innerHTML = Array.from({ length: I.IDLE.KILLS }, (_, i) => `<i class="${i < st.kills ? 'on' : ''}"></i>`).join('');
    const ready = I.bossReady(st);
    $('#bossBtn').disabled = !ready || mode !== 'auto';
    $('#bossBtn').classList.toggle('ready', ready && mode === 'auto');
    const shots = Math.max(1, I.mobHp(st.floor) / Math.max(1, avgCache));
    $('#killHint').textContent = mode === 'boss' ? `반격 ${fmt(I.bossAtk(st.floor))}` : `평균 ${shots <= 1 ? '한 방' : f2(Math.ceil(shots * 10) / 10) + '방'}에 처치 · 반격 ${fmt(I.mobAtk(st.floor))}`;
    syncPick();
    if (tab === 'up') updateButtons();
  }
  function upDesc(k) {
    const lv = st.lv[k], S = I.stat, nx = lv + 1;
    const pctOf = (sym, lvx) => { const w = I.weights(Object.assign({}, st, { lv: lvx })); const t = w.reduce((a, e) => a + e[1], 0); return Math.round((w.find(e => e[0] === sym) || [0, 0])[1] / t * 100) + '%'; };
    const L2 = Object.assign({}, st.lv, { [k]: nx });
    switch (k) {
      case 'atk': {
        const left = EVOLVE - lv % EVOLVE, nt = tierOf(nx);
        const evo = nx % EVOLVE === 0 ? (nt > tierOf(lv) ? ` <em>2배 + ${PICKS[nt].name}!</em>` : ' <em>2배!</em>') : ` <i class="evo">진화까지 ${left}</i>`;
        return `공격력 ${fmt(S.atk(lv))} → <b>${fmt(S.atk(nx))}</b>${evo}`;
      }
      case 'spd': return `초당 ${f2(S.aps(lv))}번 → <b>${f2(S.aps(nx))}번</b>`;
      case 'gem': return `💎 확률 ${pctOf('gem', st.lv)} → <b>${pctOf('gem', L2)}</b> · 💎 ${f2(S.gemX(lv))}타 → <b>${f2(S.gemX(nx))}타</b>`;
      case 'chest': return `📦 확률 ${pctOf('chest', st.lv)} → <b>${pctOf('chest', L2)}</b> · 배율 ×${f2(S.chestX(lv))} → <b>×${f2(S.chestX(nx))}</b>`;
      case 'coin': return `처치 광석 ×${f2(S.coinX(lv))} → <b>×${f2(S.coinX(nx))}</b>`;
      case 'dur': return `내구도 ${fmt(S.dur(lv))} → <b>${fmt(S.dur(nx))}</b> · 반격 ${Math.floor(S.dur(nx) / I.mobAtk(st.floor))}대 버팀`;
      case 'cells': return `슬롯 ${S.cells(lv)}칸 → <b>${S.cells(nx)}칸</b> · 칸이 많을수록 콤보·잭팟이 쉬워요`;
    }
    return '';
  }
  let tab = 'up';
  function renderList() {
    const L = $('#list');
    if (tab === 'up') {
      L.innerHTML = Object.keys(I.UP).map(k => `<div class="up" data-k="${k}"><div class="ui">${k === 'atk' ? `<img src="${pickSrc(tierOf(st.lv.atk))}" alt="">` : k === 'dur' ? '<span class="emo">🛠️</span>' : img(I.UP[k].icon)}</div>
        <div class="ut"><b>${I.UP[k].name} <small>Lv.${st.lv[k]}</small></b><span class="ud"></span></div>
        <button class="ub" data-k="${k}"></button></div>`).join('');
      L.querySelectorAll('.ub').forEach(b => b.onclick = () => {
        const k = b.dataset.k;
        const durBefore = I.maxDur(st);
        if (!I.buy(st, k)) return;
        if (k === 'dur') { st.dur += I.maxDur(st) - durBefore; setDur(); }
        Sound.play('coin');
        recalc();
        if (k === 'cells') { buildCells(); toast('슬롯 칸이 늘었어요!'); }
        const row = b.closest('.up'); row.animate([{ background: '#fff3a0' }, { background: '' }], { duration: 400 });
        row.querySelector('.ui').animate([{ transform: 'scale(1.35) rotate(-12deg)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.3,1.6,.5,1)' });
        // 강화하면 광부가 잠깐 빛남 → "세졌다"를 화면 위쪽에서도 느끼게
        $('#pick img').animate([{ filter: 'brightness(1.8)' }, { filter: 'brightness(1)' }], { duration: 450 });
        const [mx, my] = arenaXY($('#pick'));
        floatAt(mx, my - 70, `${I.UP[k].name} UP!`, 'upf', 900, { punch: 1.3 });
        if (k === 'atk') { renderIcon(); if (st.lv.atk % EVOLVE === 0 && tierOf(st.lv.atk) > tierOf(st.lv.atk - 1)) evolve(); }
        renderRow(k); refreshTop(); save();
      });
      Object.keys(I.UP).forEach(renderRow);
    } else {
      const all = C.allCards(), have = all.filter(c => st.dex[C.cardKey(c)]);
      const pt = tierOf(st.lv.atk);
      const un = I.unlocked(st);
      const symRows = Object.keys(I.SYMS).map(k => { const S = I.SYMS[k], on = un.includes(k);
        return `<div class="sym ${on ? 'on' : ''}">${img(k)}<div><b>${on ? S.name : '???'}</b><small>${on ? S.desc : `${I.stageNo(S.u)} 보스를 잡으면 해금`}</small></div></div>`; }).join('');
      L.innerHTML = `<p class="dexh">🎰 슬롯 심볼 <b>${un.length}</b> / ${Object.keys(I.SYMS).length}</p><div class="syms">${symRows}</div>
        <p class="dexh">⛏ 곡괭이 진화 <b>${pt + 1}</b> / ${PICKS.length} · 공격력 ${EVOLVE}레벨마다 진화</p>
        <div class="pkrow">${PICKS.map((p, i) => `<div class="pk ${i <= pt ? 'on' : ''}"><img src="${pickSrc(i)}" alt=""><small>${i <= pt ? p.name : '???'}</small></div>`).join('')}</div>
        <p class="dexh">보스를 잡으면 카드를 얻어요 · <b>${have.length}</b> / ${all.length}</p>
        <div class="dex">${have.length ? have.map(c => `<div class="dc"><img src="${C.cardImg(c)}" alt=""><small>${c.grade} · ${c.name}</small></div>`).join('') : '<p class="muted">아직 없어요. 몬스터 10마리를 잡고 👑 보스에 도전하세요!</p>'}</div>`;
    }
  }
  function renderIcon() { const i = $('#list .up[data-k="atk"] .ui img'); if (i) i.src = pickSrc(tierOf(st.lv.atk)); }
  // 진화 연출 없이 단계가 바뀐 경우(불러오기 등)에도 그림을 맞춤
  function syncPick() { if (+$('#pick').dataset.t !== tierOf(st.lv.atk) && !evolving) showPick(); }
  let evolving = false;
  function renderRow(k) {
    const row = $(`#list .up[data-k="${k}"]`); if (!row) return;
    row.querySelector('.ut b').innerHTML = `${I.UP[k].name} <small>Lv.${st.lv[k]}</small>`;
    row.querySelector('.ud').innerHTML = st.lv[k] >= I.UP[k].max ? '최대 레벨' : upDesc(k);
    updateButtons();
  }
  function updateButtons() {
    document.querySelectorAll('#list .ub').forEach(b => {
      const k = b.dataset.k, max = st.lv[k] >= I.UP[k].max;
      b.disabled = max || !I.canBuy(st, k);
      b.innerHTML = max ? 'MAX' : `<img src="${ICON.coin}" alt="">${fmt(Math.ceil(I.UP[k].cost(st.lv[k])))}`;
    });
  }
  function refresh() { refreshTop(); }

  // ---------- 오프라인 보상 ----------
  async function offlineReward() {
    const o = I.offline(st);
    if (!o.gold) return;
    const h = Math.floor(o.sec / 3600), m = Math.floor(o.sec % 3600 / 60);
    st.gold += o.gold; save();
    Sound.play('chestBig');
    await modal(`<h3>⛏ 쉬는 동안 캔 광석</h3><p>${h ? h + '시간 ' : ''}${m}분 동안 광부가 일했어요<br><span class="big">+${fmt(o.gold)}</span></p><small class="muted">최대 8시간까지 쌓여요 (평소의 절반 속도)</small>`, '받기');
    refresh();
  }

  // ---------- 시작 ----------
  function start() {
    load(); fit(); makeCracks(); showPick();
    const cv = $('#pfx'); cv.width = 880; cv.height = 660; P.cx = cv.getContext('2d'); P.cx.scale(2, 2);
    goldShown = st.gold; goldTick();
    buildCells();
    recalc();
    setEgg();
    renderList();
    newMob();
    refresh();
    document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => {
      tab = b.dataset.t; Sound.play('click');
      document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
      renderList();
    });
    $('#bossBtn').onclick = () => { Sound.unlock(); bossFight(false); };
    $('#autoBtn').onclick = () => { st.auto = !st.auto; Sound.play('click'); toast(st.auto ? '보스가 열리면 자동으로 도전해요' : '보스는 👑 버튼으로 직접 도전해요'); refreshTop(); save(); };
    mobLoop();
    document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) save();
      else { offlineReward(); }
    });
    setInterval(() => { if (!document.hidden) save(); }, 5000);
    offlineReward().then(() => autoLoop());
    window.__idle = { st: () => st, I, save, hp: f => { mobHp = mobMax * f; setHp(); } };
  }
  start();
})();
