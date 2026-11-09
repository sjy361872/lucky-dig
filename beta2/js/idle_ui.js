// =====================================================
//  곡괭이 키우기 — 화면 (자동 사냥 · 슬롯 연출 · 강화 · 보스전 · 오프라인 보상)
//   계산은 js/idle.js (Idle), 카드 목록은 js/config.js, 소리는 js/sound.js
// =====================================================
(function () {
  const C = window.CARDS, I = window.Idle, Sound = window.Sound;
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
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && s.lv) {
        const old = !s.picks;
        st = Object.assign(I.newState(), s); st.lv = Object.assign(I.newState().lv, s.lv);
        if (old) st.eq = Math.min(7, Math.floor((s.lv.atk || 0) / 25));
        if (typeof st.eq === 'number' || (st.picks || []).some(x => typeof x === 'number') || !st.eq) I.migratePicks(st, rnd);   // v1 → v2
        if (!s.stv) st.stv = 1;            // 예전 저장엔 stv 가 없음 (새 상태 기본값 2가 덮지 않게)
        I.migrateStages(st);
        st.allBest = Math.max(st.allBest || 0, st.best || 0);
        if (!s.tabs) { st.tabs = ['up', 'pk', 'rb', 'dex']; st.allUp = true; st.tips = { old: 1 }; }   // 온보딩 전부터 하던 사람
        I.setRun(st);
        return;
      }
    } catch (e) { /* 새로 시작 */ }
    st = I.newState(); I.setRun(st);
  }
  let wiping = false;   // 초기화 중엔 저장하지 않음 (창을 닫을 때 저장이 다시 덮어쓰지 않게)
  // 처음부터 다시: 저장 삭제 후 새로고침
  async function resetAll() {
    const ok = await new Promise(done => {
      const m = $('#modal');
      m.innerHTML = `<div class="box"><h3>🔄 처음부터 다시 하기</h3><p>스테이지 · 광석 · 강화 · 곡괭이 · 환생 · 도감이 <b>전부 지워져요.</b><br>되돌릴 수 없어요.</p>
        <div class="mrow"><button class="mbtn ghost" data-v="0">취소</button><button class="mbtn" data-v="1">지우고 처음부터</button></div></div>`;
      m.hidden = false;
      m.querySelectorAll('.mbtn').forEach(b => b.onclick = () => { m.hidden = true; m.innerHTML = ''; done(b.dataset.v === '1'); });
    });
    if (!ok) return;
    wiping = true;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ }
    location.replace(location.pathname);
  }
  function save() { if (wiping) return; st.lastSeen = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(st)); } catch (e) { /* 저장 불가 */ } }

  // ---------- 화면 크기: 440×900 앱을 창에 맞춤 ----------
  function fit() {
    const s = Math.min(window.innerWidth / 440, window.innerHeight / 900);
    $('#app').style.transform = `scale(${s})`;
    $('#vp').style.width = 440 * s + 'px'; $('#vp').style.height = 900 * s + 'px';
  }
  window.addEventListener('resize', fit);

  // ---------- 그림 ----------
  const ICON = {
    tnt: 'assets/items/tnt.png', gem: 'assets/blocks/diamond.png',
    coin: 'assets/ui/coin.png', chest: 'assets/chests/c5.png', slot: 'assets/ui/cell_slot.png',
    pick3: 'assets/items/pick3.png', spin: 'assets/items/spin.png',
    gold: 'assets/syms/gold.webp', stone: 'assets/blocks/stone.png',
  };
  // 보석 칸 그림은 사다리(다이아 → 루비 → 흑요석)를 따라감
  const syncGem = () => { if (typeof st !== 'undefined' && st) ICON.gem = I.ladderOf(st).icon; };
  // ---------- 곡괭이 진화: 공격력 25레벨마다(= 대미지 2배 되는 순간) 다음 곡괭이 ----------
  const PICKS = [
    { name: '나무 곡괭이', c: '#e8d2a8' }, { name: '구리 곡괭이', c: '#ffb27a' }, { name: '철 곡괭이', c: '#cfe3ff' },
    { name: '황금 곡괭이', c: '#ffd34a' }, { name: '크리스탈 곡괭이', c: '#6fd8ff' }, { name: '용암 곡괭이', c: '#ff6a2a' },
    { name: '번개 곡괭이', c: '#c08aff' }, { name: '무지개 곡괭이', c: '#ff8af0' },
  ];
  // 곡괭이 모양 = 장착한 곡괭이 등급 (합성으로 얻음)
  const cur = () => Math.min(7, (st.eq && st.eq.g) || 0);          // 그림 등급 (무지개★ 는 무지개 그림)
  const TY = t => I.PICK.types[t];
  const stars = g => g > 7 ? `<i class="star">★${g - 7}</i>` : '';
  // 그림 시험용: ?art=pixel (도트) · ?art=2d (굵은 외곽선) → assets/test 그림으로 바꿔 보기. 평소엔 영향 없음
  const ART = ['pixel', '2d'].includes(new URLSearchParams(location.search).get('art')) ? new URLSearchParams(location.search).get('art') : null;
  if (ART) document.documentElement.classList.add('art-' + ART);
  const artSrc = n => ART === 'pixel' ? `assets/test/px_${n}.png` : `assets/test/2d_${n}.webp`;
  const pickSrc = t => ART ? artSrc(t < 4 ? 'pick1' : 'pick2') : `assets/picks/pick${t + 1}.webp`;
  function showPick() {
    const t = cur(), el = $('#pick');
    el.dataset.t = t; el.dataset.k = `${st.eq.t}:${st.eq.g}`; el.style.setProperty('--pc', PICKS[t].c);
    el.querySelector('img').src = pickSrc(t);
    $('#pickName').textContent = `${TY(st.eq.t).e} ${I.gradeName(st.eq.g)} ${TY(st.eq.t).name}`;
  }
  // 진화 연출: 번쩍 → 새 곡괭이가 커졌다 돌아옴 → 배너
  async function evolve() {
    const t = cur(), el = $('#pick');
    evolving = true; setTimeout(() => evolving = false, 600);
    Sound.play('drumroll');
    el.querySelector('img').animate([{ filter: 'brightness(1)' }, { filter: 'brightness(6) saturate(0)' }], { duration: 500 });
    el.querySelector('img').style.filter = 'brightness(6) saturate(0)';
    await wait(500);
    showPick();
    flash('#fff', .9, 500);
    const [x, y] = arenaXY(el);
    emit({ t: 'ring', x, y, r0: 20, r1: 230, w: 14, color: PICKS[t].c, life: .6 });
    for (let i = 0; i < 40; i++) { const a = rnd() * 6.28, sp = 200 + rnd() * 500; emit({ t: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: .9, w: 4, color: rnd() < .5 ? PICKS[t].c : '#fff', life: .5 + rnd() * .3 }); }
    el.querySelector('img').getAnimations().forEach(a => a.cancel()); el.querySelector('img').style.filter = '';
    el.animate([{ transform: 'scale(1.6)' }, { transform: 'scale(.95)', offset: .6 }, { transform: 'scale(1)' }], { duration: 600, easing: 'ease-out' });
    banner(`${I.gradeName(st.eq.g)} 곡괭이!`, `${TY(st.eq.t).e} ${TY(st.eq.t).name} · 공격력 ×${f2(I.pickMult(st))}`, PICKS[t].c, 2000);
    setTimeout(() => toast(`능력: ${I.abilText(st.eq)}`), 600);
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
  const hot = () => rnd() < .4 ? PICKS[cur()].c : pick(HOT);
  const pick = a => a[Math.floor(rnd() * a.length)];
  // 한 대 때릴 때: 베기 궤적 + 불꽃 + 돌 파편 (+크리티컬이면 충격파)
  function hitBurst(x, y, crit, huge) {
    const a = -0.6 + (rnd() - .5) * .8;
    emit({ t: 'slash', x: x - 10, y, r: crit ? 70 : 55, a, sweep: 2.2, w: crit ? 12 : 8, color: crit ? '#ffd34a' : PICKS[cur()].c, life: .22 });
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
      el.dataset.sym = s;
      const lab = el.querySelector('.clab');       // 효과 이름표는 다음 탐지까지 남겨 둠
      el.innerHTML = img(s);
      if (lab) el.appendChild(lab);
      const jack = !!(r && r.jackpot && s === 'gold'), boom = !!(r && s === 'tnt');
      el.classList.toggle('jack', jack);
      el.classList.toggle('boost', boom);
      // 황금 광맥·TNT 칸은 왼쪽부터 차례로 통통 튐
      if (jack || boom) el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.22) translateY(-8px)' }, { transform: 'scale(1)' }], { duration: 260, delay: (n++) * 55, easing: 'ease-out' });
    });
  }
  const popCell = el => el.animate([{ transform: 'scale(1.18) translateY(-5px)' }, { transform: 'scale(.96)', offset: .6 }, { transform: 'scale(1)' }], { duration: 170, easing: 'ease-out' });
  // 릴 연출: 고정 안 한 칸은 잠깐 섞였다가 왼쪽부터 멈춤
  async function spinAnim(syms, ms, keep) {
    if (cellEls.length !== syms.length) buildCells();
    syncGem();
    const keys = I.unlocked(st), n = syms.length, t0 = performance.now();
    $('#calc').classList.add('dim');
    $('#cells').querySelectorAll('.clab').forEach(x => x.remove());
    cellEls.forEach((el, i) => { el.classList.remove('boost', 'jack'); if (!(keep && keep[i])) { el.classList.add('spinning'); el.dataset.sym = ''; } });
    while (true) {
      const el = performance.now() - t0;
      let left = 0;
      for (let i = 0; i < n; i++) {
        if (keep && keep[i]) continue;
        const stopAt = ms * (0.55 + 0.45 * (i + 1) / n);
        if (el < stopAt) { left++; cellEls[i].innerHTML = img(keys[Math.floor(rnd() * keys.length)]); }
        else if (cellEls[i].classList.contains('spinning')) { cellEls[i].classList.remove('spinning'); cellEls[i].innerHTML = img(syms[i]); cellEls[i].dataset.sym = syms[i]; popCell(cellEls[i]); if (ms > 300) Sound.play('stop'); }
      }
      if (!left) break;
      await wait(ms > 300 ? 60 : 40);
    }
    showSyms(syms);
  }
  function setCalc(html) { const c = $('#calc'); c.innerHTML = html; c.classList.remove('dim'); }
  // 결과 한 줄 (docs/slot-readable.md): 배율이 없으면 '탐지 피해 107', 있으면 '피해 153 × TNT 2 = 306'
  function calcText(r) {
    const xs = [];
    if (r.tntMult > 1) xs.push(`TNT ${f2(r.tntMult)}`);
    if (r.jackpot) xs.push(`황금 광맥 ${fmt(r.combo)}`);
    if (!xs.length) return `탐지 피해 <b>${fmt(r.dmg)}</b>`;
    return `피해 ${fmt(Math.round(r.base))} × ${xs.join(' × ')} = <b>${fmt(r.dmg)}</b>`;
  }

  // ---------- 몬스터 ----------
  let mob = null, mobHp = 0, mobMax = 1, mode = 'auto', alive = true;
  // 몬스터 그림 미리 받아 두기: 지금 광산 + 다음 광산
  const sprOf = card => ART ? artSrc((card.idx || 0) % 2 ? 'golem' : 'beetle') : C.cardImg(card).replace('assets/cards/', 'assets/mobs/').replace('.jpg', '.webp');
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
    $('#mob').getAnimations().forEach(a => a.cancel()); $('#mob').style.opacity = ''; $('#mob').style.transform = '';
    const z = I.zoneOf(C, st.floor);
    $('#mob .spr').style.filter = z ? `hue-rotate(${z * 60}deg) saturate(1.3)` : '';
    $('#mobName').textContent = (boss ? '👑 ' : '') + (z ? '심층 ' : '') + card.name;
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
  function newMob() { const f = I.bossReady(st) ? st.floor - 1 : st.floor; setMob(I.mobCard(C, f, rnd, false), I.mobHp(f), false); alive = true; }

  // 공격 한 번: 광부 휘두름 → 몬스터 맞음
  async function hit(r, big) {
    const mi = $('#pick');
    mi.classList.remove('swing'); void mi.offsetWidth; mi.classList.add('swing');
    await wait(125);                                    // 곡괭이가 내려꽂히는 순간에 맞춤
    const m = $('#mob .mimg'), [x, y] = arenaXY(m);
    const crit = r.jackpot || r.tntMult > 1;            // 큰 한 방: TNT 곱하기 · 황금 광맥
    const huge = r.jackpot || r.nT >= 2;
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
    if (r.jackpot) { jackpotFx(r); const [jx, jy] = arenaXY($('#mob .mimg')); gotPick(I.rollDrop(st, rnd, r.comboN >= 4 ? 'mega' : 'jack'), jx, jy); }
    else if (huge) { banner(`TNT ${r.nT}개!`, `피해 ×${f2(r.tntMult)}`, '#ff8a3a'); flash('#fff', .6, 300); Sound.play('chestBig'); }
    else if (r.tntMult > 1) { Sound.play('big'); flash('#ffb070', .25); }
    if (r.basic) { setHp(); shake($('#arena'), 1.5 + frac * 8); return; }
    r.fx = I.applySpin(st, r);                            // 황금 광맥 광석
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
    gotPick(I.rollDrop(st, rnd, 'kill'), x, y);
    m.animate([{ opacity: 1, transform: 'scale(1)', filter: 'brightness(1)' }, { opacity: 1, transform: 'scale(1.18)', filter: 'brightness(4)', offset: .3 }, { opacity: 0, transform: 'scale(.2)', filter: 'brightness(4)' }], { duration: 260 });
    m.style.opacity = '0';     // 끝 상태는 직접 (fill:forwards 안 씀 — 일부 앱 안 브라우저에서 투명이 안 풀림)
    refresh();
    await wait(I.IDLE.RESPAWN * 1000);
    m.getAnimations().forEach(a => a.cancel());
    if (mode === 'auto') newMob();          // 그 사이 보스전이 시작됐으면 보스를 일반 몬스터로 덮어쓰지 않음
  }

  // ---------- 잭팟 관통 (docs/jackpot-pierce.md) ----------
  // 잭팟으로 몬스터를 잡으면 다음 일반 몬스터 N마리(=N스테이지)를 한 번에 뚫고 내려감. 보스 앞에서 멈춤
  //  비교용: 주소에 ?pierce=0 이면 끔
  const PIERCE_OFF = /[?&]pierce=0/.test(location.search);
  async function pierce(r) {
    const max = PIERCE_OFF ? 0 : I.pierceMax(r.comboN);
    let n = 0;
    while (n < max && mode === 'auto' && alive && !I.bossReady(st)) {
      n++;
      const mi = $('#pick'); mi.classList.remove('swing'); void mi.offsetWidth; mi.classList.add('swing');
      await wait(90);
      const [x, y] = arenaXY($('#mob .mimg'));
      hitBurst(x, y, true, n >= 3);
      flash('#ffd34a', .35, 180); shake($('#arena'), 6 + n * 1.5);
      Sound.play('hit', { type: 'diamond', ratio: .5 });
      floatAt(220, 120, `⛏ ${n}층 관통!`, 'combo', 900, { punch: 1.4 + n * .08 });
      mobHp = 0; setHp();
      await killMob(true);
    }
    if (n) tip('pierce', '⭐ 황금 광맥으로 잡으면 다음 몬스터들까지 한 번에 뚫고 내려가요!');
    if (n) { banner(`${n}층 관통!`, I.bossReady(st) ? '보스 앞까지 뚫었어요' : `황금 광맥의 힘으로 ${n}스테이지 돌파`, '#ffd34a', 1300); refreshTop(); }
  }

  // ---------- 자동 사냥 루프 ----------
  // 평소엔 곡괭이가 그냥 때림(슬롯 없음) → 때릴 때마다 슬롯 게이지가 참
  // 게이지가 꽉 차면 슬롯이 반짝 → 터치하면(방치 중이면 잠시 뒤 자동) 큰 슬롯이 천천히 돌아감
  let gauge = 0, readyAt = 0, pullReq = false, spinning = false;
  function setGauge() {
    const n = I.IDLE.GAUGE, full = gauge >= n, el = $('#gauge');
    el.classList.toggle('ready', full);
    $('#gaugeFill').style.width = Math.min(100, gauge / n * 100) + '%';
    $('#gaugeText').textContent = full ? '⛏ 광맥 발견!' : `⛏ 광맥 탐지 ${gauge} / ${n}`;
    $('#slotbox').classList.toggle('ready', full && mode === 'auto');
  }
  async function bigSpin() {
    tip('slot', '⛏ 8번 때리면 광맥 탐지! 광석은 피해 더하기 · 💣 TNT는 전체 ×2 · 황금 3개면 황금 광맥!');
    spinning = true;
    try {
      $('#slotbox').classList.remove('ready'); $('#cells').classList.remove('idle');
      const syms = I.roll(st, rnd), r = I.evalSpin(st, syms, rnd);
      Sound.play('drumroll');
      await spinAnim(syms, 850);
      await revealCells(syms, r);
      showSyms(syms, r);
      setCalc(calcText(r));
      await hit(r, true);
      gauge = 0;
      setGauge();
      return r;
    } finally { spinning = false; }
  }
  // 칸마다 무슨 효과인지 이름표 (docs/slot-readable.md): 피해는 '+숫자', 배율은 '×숫자', 그 밖엔 무엇이 얼마나
  //  칸 피해는 반올림 합이 '배율 전 피해'와 딱 맞게 맞춰서 보여 줌 (화면에서 따로 계산해 어긋나지 않게 엔진 값 사용)
  function cellNums(r) {
    const v = (r.cellDmg || []).map(Math.round), tot = Math.round(r.base || 0);
    const sum = v.reduce((a, b) => a + b, 0);
    if (sum && sum !== tot) { let j = 0; v.forEach((x, k) => { if (x > v[j]) j = k; }); v[j] += tot - sum; }
    return v;
  }
  function cellLabel(i, r, nums) {
    const d = nums ? nums[i] : Math.round((r.cellDmg || [])[i] || 0);
    switch (r.res[i]) {
      case 'stone': return `+${fmt(d)}`;
      case 'gem': return `💎 +${fmt(d)}`;
      case 'tnt': return `+${fmt(d)} · 전체 ×${f2(r.tx)}`;
      case 'gold': return `황금 +${fmt(d)}`;
    }
    return '';
  }
  // 이름표를 한꺼번에 바로 붙임 (보스전: 멈추자마자 · 고르는 동안)
  function labelCells(syms, r) {
    const nums = cellNums(r);
    syms.forEach((s, i) => {
      const el = cellEls[i]; if (!el) return;
      el.querySelector('.clab')?.remove();
      const lab = document.createElement('span'); lab.className = 'clab';
      lab.textContent = cellLabel(i, r, nums);
      el.appendChild(lab);
    });
  }
  async function revealCells(syms, r) {
    const nums = cellNums(r);
    for (let i = 0; i < syms.length; i++) {
      const el = cellEls[i]; if (!el) continue;
      const lab = document.createElement('span'); lab.className = 'clab';
      lab.textContent = cellLabel(i, r, nums);
      el.appendChild(lab);
      lab.animate([{ transform: 'translate(-50%,6px) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,0) scale(1.15)', opacity: 1, offset: .5 }, { transform: 'translate(-50%,0) scale(1)', opacity: 1 }], { duration: 220, easing: 'ease-out' });
      popCell(el);
      Sound.play('click');
      await wait(110);
    }
    await wait(200);
  }
  async function autoLoop() {
    while (true) {
      if (mode !== 'auto' || document.hidden) { await wait(200); continue; }
      const aps = I.stat.aps(st.lv.spd), period = 1000 / aps;
      const t0 = performance.now();
      let r;
      if (gauge >= I.IDLE.GAUGE && (pullReq || performance.now() - readyAt > I.IDLE.AUTO_PULL * 1000)) {
        pullReq = false;
        r = await bigSpin();
      } else {
        r = I.basicHit(st, baseCache);
        await hit(r);
        if (gauge < I.IDLE.GAUGE) { gauge++; if (gauge >= I.IDLE.GAUGE) { readyAt = performance.now(); Sound.play('stop'); } setGauge(); }
      }
      if (mode !== 'auto') continue;
      if (st.dur <= 0 && !breaking) { await breakPick(); continue; }
      if (r.fx && r.fx.jackGold) await wait([600, 1800, 3000][Math.min(5, r.comboN) - 3]);
      if (mobHp <= 0 && alive && mode === 'auto') { await killMob(); if (r.jackpot) await pierce(r); }
      refreshTop();
      // 자동 도전: 켜져 있거나, 이미 깬 스테이지로 되돌아온 경우(파손 뒤 복귀)엔 보스도 자동
      if (mode === 'auto' && I.bossReady(st) && (st.auto || st.floor < st.best)) { await bossFight(true); continue; }
      if (!r.basic) { await wait(250); continue; }
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
        b.innerHTML = `🔄 다시 탐지<small>${rer > 0 ? `준비 ${rer}번 남음` : '준비 다 썼어요'}</small>`;
        const rp = $('#bRepair'); if (rp) { rp.disabled = rer <= 0 || st.dur >= I.maxDur(st); rp.innerHTML = `🔧 수리 +${Math.round(I.BOSS_REPAIR * 100)}%<small>준비 1번 사용</small>`; }
        const r = I.evalSpin(st, syms);
        labelCells(syms, r);
        setCalc(`이대로 공격하면 ${calcText(r)}${mobHp > 0 ? (r.dmg >= mobHp ? ' → <b>처치!</b>' : ` → 보스 ${fmt(mobHp - r.dmg)} 남음`) : ''}`);
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
      if ($('#bRepair')) $('#bRepair').onclick = () => { if (rer <= 0 || st.dur >= I.maxDur(st)) return; Sound.play('click'); end('repair'); };
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
    tip('dur', '몬스터도 반격해요! 🛠️ 내구도가 0이 되면 곡괭이가 부러져요');
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
      if (mode !== 'auto' || document.hidden || !alive || breaking || spinning) continue;
      if (await mobStrike(I.mobAtk(st.floor))) await breakPick();
    }
  }
  // 곡괭이 파손 → 산산조각 → 챕터 첫 스테이지(x-1)로 돌아가 다시 사냥
  async function breakPick() {
    breaking = true; mode = 'break';
    const pk = $('#pick'), pim = pk.querySelector('img'), [x, y] = arenaXY(pk);
    const c = PICKS[cur()].c;
    pim.animate([{ transform: 'rotate(-22deg)', opacity: 1 }, { transform: 'rotate(60deg) translate(20px,80px)', opacity: 0 }], { duration: 650, easing: 'ease-in' });
    pim.style.opacity = '0';
    for (let i = 0; i < 34; i++) { const a = rnd() * 6.28, sp = 120 + rnd() * 420; emit({ t: 'shard', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 150, g: 1000, rot: rnd() * 6, vr: (rnd() - .5) * 24, s: 5 + rnd() * 8, color: rnd() < .5 ? c : '#8a6a4a', floor: 300, life: .9 + rnd() * .4 }); }
    shake($('#arena'), 14, 450); flash('#000', .4, 450);
    Sound.play('last');
    I.breakPick(st);
    const quick = Date.now() - (breakPick.last || 0) < 120000; breakPick.last = Date.now();
    if (quick) toast(`💥 곡괭이 파손 · ${I.stageNo(st.floor)}부터 다시`);
    else banner('곡괭이가 부러졌어요!', `${I.stageNo(st.floor)}부터 다시 · 내구도를 강화해 보세요`, '#ff7a6a', 2200);
    await wait(2000);
    pim.getAnimations().forEach(a => a.cancel()); pim.style.opacity = '';
    pk.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    toast('🔧 곡괭이 수리 완료!');
    recalc(); setDur(); newMob(); refresh(); save();
    mode = 'auto'; breaking = false;
  }

  // ---------- 보스전: 한 번 공격할 때마다 보스가 반격 · 내구도가 다 닳으면 패배 ----------
  //  auto=true 면 자동 도전(칸 고정·다시 돌리기도 알아서)
  // 자동 보스: 엔진의 bossPlan 판단 그대로 (시뮬과 같음)
  async function autoDecision(syms, rer) {
    const pl = I.bossPlan(st, syms, rer, mobHp);
    if (pl.act !== 'reroll') return pl.act;
    held = pl.held; cellEls.forEach((el, i) => el.classList.toggle('held', !!held[i]));
    floatAt(220, 300, '🔄 좋은 칸은 고정하고 다시 탐지', 'glassf', 900);
    await wait(420);
    return 'reroll';
  }
  let quitReq = false;
  async function bossFight(auto) {
    try { await bossFight2(auto); }
    catch (e) {
      console.error('bossFight', e); diag('boss-error', String(e && e.message || e));
      $('#bossBar').hidden = true; $('#bossCtl').hidden = true; document.body.classList.remove('bossmode', 'autoboss');
      mode = 'auto'; newMob(); refresh();
    }
  }
  async function bossFight2(auto) {
    if (mode !== 'auto' || !I.bossReady(st)) return;
    mode = 'boss'; quitReq = false;
    await wait(300);
    document.body.classList.add('bossmode');
    document.body.classList.toggle('autoboss', !!auto);
    $('#bossBar').hidden = false;
    $('#bossQuit').onclick = () => { quitReq = true; };
    const card = I.mobCard(C, st.floor, rnd, true);
    $('#bossBar b').textContent = (I.isSBoss(st.floor) ? '💀 챕터 보스' : '👑 중간 보스') + (auto ? ' (자동)' : '');
    tip('bossfight', '⚔ 보스전: 광맥 탐지 1번 = 공격 1번! 공격할 때마다 보스도 반격해요. 안 좋은 칸은 3번까지 다시 돌려요');
    setMob(card, I.bossHp(st.floor), true);
    st.dur = I.maxDur(st); setDur();                       // 보스전 시작 전 곡괭이 수리
    refreshTop();
    Sound.play('drumroll');
    floatAt(220, 120, 'BOSS!', 'bossf', 1400);
    await wait(auto ? 700 : 900);
    let rer = I.IDLE.BOSS_REROLLS, quit = false, turn = 0;
    while (mobHp > 0 && st.dur > 0 && !quit) {
      turn++;
      $('#bossTurns').textContent = `⚔ ${turn}번째 공격 · 준비 ${rer}번 남음`;
      held = [];
      let syms = I.roll(st, rnd);
      await spinAnim(syms, auto ? 380 : 650);
      for (;;) {
        if (quitReq) { quit = true; break; }
        const v = auto ? await autoDecision(syms, rer) : await bossDecision(syms, rer);
        if (v === 'quit' || quitReq) { quit = true; break; }
        if (v === 'attack') break;
        if (v === 'repair') {                    // 준비 1번으로 곡괭이 수리 (보스 반격 없음)
          rer--; const got = I.bossRepair(st); setDur(); Sound.play('click');
          const [px, py] = arenaXY($('#pick')); floatAt(px, py - 50, `🔧 +${fmt(got)}`, 'repf', 900, { dx: 10 });
          $('#bossTurns').textContent = `⚔ ${turn}번째 공격 · 준비 ${rer}번 남음`;
          continue;
        }
        rer--;
        $('#bossTurns').textContent = `⚔ ${turn}번째 공격 · 준비 ${rer}번 남음`;
        const keep = held.slice();
        syms = I.roll(st, rnd, syms, keep);
        await spinAnim(syms, auto ? 350 : 550, keep);
      }
      cellEls.forEach(el => el.classList.remove('held'));
      if (quit) break;
      const r = I.evalSpin(st, syms);
      showSyms(syms, r);
      labelCells(syms, r);
      setCalc(calcText(r));
      await hit(r, true);
      if (r.fx && r.fx.jackGold) await wait([600, 1800, 3000][Math.min(5, r.comboN) - 3]);
      if (mobHp > 0 && st.dur > 0) { await wait(280); await mobStrike(I.bossAtk(st.floor)); }
      await wait(auto ? 250 : 400);
    }
    $('#bossBar').hidden = true;
    document.body.classList.remove('bossmode', 'autoboss');
    if (mobHp <= 0) {
      // 보스 격파 연출: 크게 터지고 → 코인 비 → 배너 → (직접 도전이면) 카드 팝업
      const [bx, by] = arenaXY($('#mob .mimg'));
      killBurst(bx, by, true); flash('#fff', .9, 450); shake($('#arena'), 16, 450);
      $('#mob').animate([{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(1.25)', filter: 'brightness(5)', offset: .3 }, { transform: 'scale(0)', opacity: 0 }], { duration: 420 });
      $('#mob').style.opacity = '0';
      coinShower(auto ? 14 : 30);
      banner('보스 격파!', '다음 → ' + I.stageNo(st.floor + 1), '#ffd34a', 1600);
      Sound.play('fanfare');
      const key = C.cardKey(card), isNew = !st.dex[key];
      st.dex[key] = (st.dex[key] || 0) + 1;
      const ladder0 = I.ladderOf(st);
      const bossDrop = I.rollDrop(st, rnd, 'boss');
      const prevAll = st.allBest || 0;
      const g = I.bossWin(st);
      if ((st.allBest || 0) > prevAll) rankSubmit();
      gotPick(bossDrop, bx, by);
      const ladder1 = I.ladderOf(st), ladderUp = ladder1 !== ladder0;
      if (ladderUp) syncGem();
      save();
      if (auto) { await wait(1300); if (isNew) toast(`✨ 새 카드: ${card.name} (도감 등록)`); }
      else {
        await wait(1500);
        await modal(`<h3>보스 격파!</h3><div class="capture"><img src="${C.cardImg(card)}" alt=""><b>${card.name}</b><small>${card.grade}상 ${isNew ? '· ✨ 새 카드! 도감 등록' : '· 이미 있는 카드'}</small></div>
          <p>광석 <b>+${fmt(g)}</b><br>다음 스테이지 → <b>${floorName(st.floor)}</b></p>`, '계속');
      }
      buildCells();
      if (ladderUp) {        // 보석 사다리: 보석 자리가 더 비싼 광석으로 (그림 수는 그대로)
        Sound.play('fanfare');
        const msg = `${ladder0.name} → ${ladder1.name}! 보석 칸 피해 ×${ladder0.v} → ×${ladder1.v}`;
        if (auto) { banner(`${ladder1.name} 발견!`, msg, '#ff7a9a', 1800); toast('✨ ' + msg); await wait(1500); }
        else await modal(`<h3>✨ 새 광석 발견!</h3><div class="capture"><img src="${ladder1.icon}" alt="" style="width:110px;height:110px;object-fit:contain"><b>${ladder1.name}</b><small>보석 칸이 ${ladder0.name}에서 ${ladder1.name}(으)로 바뀌어요</small></div><p>보석 칸 피해 <b>×${ladder0.v} → ×${ladder1.v}</b></p>`, '좋아요');
      }
    } else {
      I.bossLose(st);
      Sound.play('last');
      if (auto) { banner('보스에게 졌어요', `${I.stageNo(st.floor)}부터 다시 올라가요`, '#ff8a8a', 1800); await wait(1600); }
      else await modal(`<h3>${quit ? '도전 포기' : '아깝다!'}</h3><p>${quit ? '도전을 그만뒀어요' : '곡괭이가 버티지 못했어요'}. 보스 체력이 <b>${fmt(mobHp)}</b> 남았어요.<br><b>${I.stageNo(st.floor)}</b>부터 다시 올라가요. 강화하고 다시 도전하세요.</p>`, '돌아가기');
    }
    $('#calc').innerHTML = '';
    mode = 'auto';
    recalc(); $('#cells').classList.add('idle'); setGauge();
    $('#mob').getAnimations().forEach(a => a.cancel());
    newMob(); setDur();
    refresh();
  }

  // 💰 황금 광맥: 화면이 금빛으로 번쩍 → 코인 폭포 → 광석
  function jackpotFx(r) {
    setTimeout(() => tip('jack', '⭐ 황금 곡괭이 3개 이상 = 황금 광맥! 피해 ×10 + 다음 몬스터 관통'), 1600);
    const ms = 1500, color = '#ffd34a';
    document.body.classList.add('jackpot'); setTimeout(() => document.body.classList.remove('jackpot'), ms);
    banner('황금 광맥!', `황금 곡괭이 ${r.comboN}개 · 피해 ×${fmt(r.combo)}`, color, ms);
    Sound.play('chestBig');
    for (let k = 0; k < 2; k++) setTimeout(() => { flash(k % 2 ? '#fff' : color, .8, 260); shake($('#arena'), 8, 300); }, k * 280);
    coinShower(30);
    const [x, y] = arenaXY($('#mob .mimg'));
    emit({ t: 'ring', x, y, r0: 20, r1: 260, w: 14, color, life: .6 });
    setTimeout(() => { if (r.fx && r.fx.jackGold) { floatAt(220, 170, `+${fmt(r.fx.jackGold)}`, 'goldf big', 1600, { punch: 2.2 }); goldBump(); } }, 500);
  }
  // ---------- 그림 설명 말풍선: 탐지 칸에 마우스를 올리거나 터치하면 ----------
  function symInfo(k) {
    const X = I.SYMS[k];
    const name = k === 'gem' ? I.ladderOf(st).name : X.name;
    const now = { gem: `지금 1칸 = 공격력 ×${f2(I.GEM_V(st))}`, tnt: `지금 전체 ×${f2(I.TNT_X(st))}` }[k];
    return `<b>${name}</b><span>${X.desc}</span>${now ? `<small>${now}</small>` : ''}`;
  }
  let tipT;
  function showTip(el) {
    const k = el.dataset.sym; if (!k || !I.SYMS[k]) return;
    const tip = $('#tip'), app = $('#app').getBoundingClientRect(), r = el.getBoundingClientRect(), sc = app.width / 440;
    tip.innerHTML = symInfo(k); tip.hidden = false;
    const x = (r.left + r.width / 2 - app.left) / sc, y = (r.top - app.top) / sc;
    tip.style.left = Math.max(80, Math.min(360, x)) + 'px'; tip.style.top = (y - 8) + 'px';
    clearTimeout(tipT); tipT = setTimeout(() => tip.hidden = true, 2500);
  }
  function hideTip() { clearTimeout(tipT); $('#tip').hidden = true; }

  // ---------- ⛏ 곡괭이 가방 · 합성 v2 (docs/pickaxe-merge-v2.md) ----------
  let pkSel = -1, pkNew = 0;
  function pkBadge() { const b = $('#tabs button[data-t="pk"]'); if (b) b.dataset.n = pkNew > 0 ? pkNew : ''; }
  // 곡괭이 한 칸 그림: 등급 그림 + 종류 색 테두리 + 종류 문양 + 별
  const pkCell = p => `<img src="${pickSrc(Math.min(7, p.g))}" alt=""><b class="ty">${TY(p.t).e}</b><small>${p.g < 8 ? p.g + 1 : ''}</small>${stars(p.g)}`;
  // 곡괭이(또는 상자)를 얻음: 몬스터 자리에서 튀어나와 '곡괭이' 탭으로 날아감
  function gotPick(p, x, y) {
    if (!p) return;
    pkNew++; pkBadge();
    const app = $('#app').getBoundingClientRect(), sc = app.width / 440, to = $('#tabs button[data-t="pk"]').getBoundingClientRect();
    const ar = $('#arena').getBoundingClientRect();
    const x0 = (ar.left - app.left) / sc + x, y0 = (ar.top - app.top) / sc + y;
    const x1 = (to.left + to.width / 2 - app.left) / sc, y1 = (to.top + to.height / 2 - app.top) / sc;
    const c = document.createElement('img'); c.src = p === 'box' ? 'assets/chests/c5.png' : pickSrc(Math.min(7, p.g)); c.className = 'pkfly';
    c.style.left = x0 + 'px'; c.style.top = y0 + 'px'; $('#app').appendChild(c);
    c.animate([{ transform: 'translate(-50%,-50%) scale(.3) rotate(0)' }, { transform: `translate(-50%,-50%) translate(${(x1 - x0) * .2}px,-70px) scale(1.2) rotate(-200deg)`, offset: .35 },
      { transform: `translate(-50%,-50%) translate(${x1 - x0}px,${y1 - y0}px) scale(.5) rotate(-360deg)` }], { duration: 900, easing: 'ease-in' });
    setTimeout(() => { c.remove(); $('#tabs button[data-t="pk"]').animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 250 }); if (tab === 'pk') renderPk(); }, 900);
    toast(p === 'box' ? '🎁 곡괭이 상자 획득! (곡괭이 탭에서 열기)' : `🎁 ${I.pickName(p)} 획득!`);
    Sound.play('chestBig');
    save();
  }
  // 🎁 상자 열기 연출: 흔들림 → 빛 → 열림 → 곡괭이 등장
  let boxBusy = false;
  async function boxFx(p) {
    boxBusy = true;
    const o = document.createElement('div'); o.className = 'boxfx';
    o.innerHTML = `<i class="rays"></i><img class="bx" src="assets/chests/c5.png" alt=""><div class="got" hidden></div>`;
    $('#app').appendChild(o);
    const bx = o.querySelector('.bx');
    Sound.play('drumroll');
    await bx.animate([{ transform: 'scale(.4)' }, { transform: 'scale(1.1)', offset: .5 }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' }).finished;
    await bx.animate([0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ transform: `rotate(${i % 2 ? -1 : 1}${4 + i * 1.5}deg) scale(${1 + i * .02})` })), { duration: 700 }).finished;
    flash('#fff', .9, 350); Sound.play('chestBig');
    bx.src = 'assets/chests/c5_open.png';
    const g = o.querySelector('.got'); g.hidden = false;
    g.style.setProperty('--tc', TY(p.t).c);
    g.innerHTML = `<div class="gp">${pkCell(p)}</div><b>${I.pickName(p)}</b><small>${I.abilText(p)}</small>`;
    g.animate([{ transform: 'translateY(40px) scale(.3)', opacity: 0 }, { transform: 'translateY(-10px) scale(1.15)', opacity: 1, offset: .6 }, { transform: 'none', opacity: 1 }], { duration: 450, easing: 'ease-out' });
    if (p.g >= 2) Sound.play('fanfare');
    await new Promise(done => { const end = () => { o.remove(); done(); }; o.onclick = end; setTimeout(end, 1800); });
    boxBusy = false;
  }
  async function openBoxUI(buy) {
    if (boxBusy) return;
    if (!st.picks.includes(null)) { I.autoMerge(st); if (!st.picks.includes(null)) return toast('가방이 꽉 찼어요. 판매하거나 분해해 주세요'); }
    if (buy && st.gold < I.boxPrice(st)) return toast('광석이 부족해요');
    const p = I.openBox(st, rnd, buy); if (!p) return;
    save(); refreshTop();
    await boxFx(p);
    renderPk();
  }
  function renderPk() {
    const L = $('#list'), e = st.eq, full = !st.picks.includes(null);
    const sel = pkSel >= 0 ? st.picks[pkSel] : null;
    const price = I.boxPrice(st);
    L.innerHTML = `<div class="pkeq" style="--pc:${PICKS[cur()].c};--tc:${TY(e.t).c}"><div class="gp">${pkCell(e)}</div><div><small>장착 중</small><b>${I.pickName(e)}</b>
        <span>공격력 ×${f2(I.pickMult(st))} · ${I.abilText(e)}</span></div></div>
      <div class="pkshop">
        ${st.boxes > 0 ? `<button id="pkOpen" class="hot">🎁 상자 열기 <b>${st.boxes}</b></button>` : ''}
        <button id="pkBuy" ${st.gold < price ? 'disabled' : ''}>🎁 상자 사기 <b><img src="${ICON.coin}" alt="">${fmt(price)}</b></button>
        <button id="pkCraft" ${(st.frags || 0) < I.PICK.FRAG ? 'disabled' : ''}>🔩 ${st.frags || 0} · 제작</button>
      </div>
      <p class="pkhelp">${sel ? `<b>${I.pickName(sel)}</b> · ${I.abilText(sel)}` : '같은 종류·같은 등급을 <b>끌어서 겹치거나</b> 차례로 누르면 합성!'}${full ? ' · <em>가방이 꽉 찼어요</em>' : ''}</p>
      <div class="pkgrid">${st.picks.map((p, i) => `<div class="pkc ${p ? '' : 'empty'} ${i === pkSel ? 'sel' : ''} ${sel && i !== pkSel && p && p.t === sel.t && p.g === sel.g ? 'match' : ''}" data-i="${i}" style="${p ? `--pc:${PICKS[Math.min(7, p.g)].c};--tc:${TY(p.t).c}` : ''}">${p ? pkCell(p) : ''}</div>`).join('')}</div>
      <div class="pkbtns"><button id="pkAuto">✨ 자동 합성</button><button id="pkEquip" ${sel ? '' : 'disabled'}>⛏ 장착</button>
        <button id="pkSell" ${sel ? '' : 'disabled'}>💰 ${sel ? fmt(I.sellPrice(st, sel)) : '판매'}</button><button id="pkScrap" ${sel ? '' : 'disabled'}>🔩 ${sel ? '+' + fmt(3 * Math.pow(2, Math.min(12, sel.g))) : '분해'}</button></div>`;
    const ob = $('#pkOpen'); if (ob) ob.onclick = () => openBoxUI(false);
    $('#pkBuy').onclick = () => openBoxUI(true);
    $('#pkCraft').onclick = craftUI;
    $('#pkAuto').onclick = () => {
      const before = I.dexCount(st), made = I.autoMerge(st); pkSel = -1;
      if (!made.length) { toast('합칠 수 있는 곡괭이가 없어요'); return; }
      Sound.play('fanfare');
      const top = made.reduce((a, b) => b.g > a.g ? b : a);
      toast(`✨ ${made.length}번 합성! 최고 ${I.pickName(top)}`);
      renderPk(); L.querySelectorAll('.pkc img').forEach(im => im.animate([{ transform: 'scale(1.4)', filter: 'brightness(3)' }, { transform: 'scale(1)', filter: 'none' }], { duration: 400 }));
      dexFx(I.dexCount(st) - before); save();
    };
    $('#pkEquip').onclick = () => { if (pkSel >= 0) equipAt(pkSel); };
    $('#pkSell').onclick = () => { if (pkSel < 0) return; const v = I.sellPick(st, pkSel); pkSel = -1; Sound.play('coin'); toast(`💰 광석 +${fmt(v)}`); goldBump(); renderPk(); refreshTop(); save(); };
    $('#pkScrap').onclick = () => { if (pkSel < 0) return; const v = I.scrapPick(st, pkSel); pkSel = -1; Sound.play('click'); toast(`🔩 조각 +${fmt(v)}`); renderPk(); save(); };
    bindDrag();
  }
  // 새로 도감에 오른 곡괭이가 있으면 축하
  function dexFx(n) { if (n > 0) { banner('곡괭이 도감 등록!', `공격력 +${n * 2}% (총 +${I.dexCount(st) * 2}%)`, '#ffd34a', 1600); flash('#fff', .4, 300); recalc(); } }
  function craftUI() {
    if ((st.frags || 0) < I.PICK.FRAG) return;
    const m = $('#modal');
    m.innerHTML = `<div class="box"><h3>🔩 곡괭이 제작</h3><p>조각 ${I.PICK.FRAG}개로 <b>나무 곡괭이</b> 1개를 만들어요.<br>어떤 종류로 만들까요? (보유 조각 ${fmt(st.frags)})</p>
      <div class="crow">${I.PICK.types.map((T, t) => `<button class="mbtn ty" data-t="${t}" style="--tc:${T.c}">${T.e}<small>${T.name}</small></button>`).join('')}</div>
      <button class="mbtn ghost" data-t="-1">닫기</button></div>`;
    m.hidden = false;
    m.querySelectorAll('.mbtn').forEach(b => b.onclick = () => {
      const t = +b.dataset.t; m.hidden = true; m.innerHTML = '';
      if (t < 0) return;
      const before = I.dexCount(st), p = I.craftPick(st, t);
      if (!p) return toast('가방이 꽉 찼어요');
      Sound.play('chestBig'); toast(`🔩 ${I.pickName(p)} 제작!`); renderPk(); dexFx(I.dexCount(st) - before); save();
    });
  }
  function equipAt(i) {
    const before = `${st.eq.t}:${st.eq.g}`;
    if (!I.equipPick(st, i)) return;
    pkSel = -1; Sound.play('click');
    if (`${st.eq.t}:${st.eq.g}` !== before) { evolve(); recalc(); renderIcon(); setDur(); }
    renderPk(); refreshTop(); save();
  }
  function tryMerge(a, b) {
    const before = I.dexCount(st), n = I.mergePicks(st, a, b);
    if (!n) return false;
    pkSel = -1; Sound.play('chestBig'); renderPk();
    const c = $(`#list .pkc[data-i="${b}"]`);
    if (c) c.animate([{ transform: 'scale(1.5)', filter: 'brightness(4)' }, { transform: 'scale(.9)', offset: .6 }, { transform: 'scale(1)', filter: 'none' }], { duration: 450, easing: 'ease-out' });
    toast(`✨ ${I.pickName(n)} 완성!`); dexFx(I.dexCount(st) - before); save();
    return true;
  }
  function pkTap(i) {
    const p = st.picks[i];
    if (pkSel < 0) { if (p) { pkSel = i; Sound.play('click'); } renderPk(); return; }
    if (i === pkSel) { pkSel = -1; renderPk(); return; }
    if (tryMerge(pkSel, i)) return;
    pkSel = p ? i : -1; Sound.play('click'); renderPk();
  }
  // 드래그: 곡괭이를 끌어서 같은 곡괭이 위에 놓으면 합성, 빈칸이면 이동. 거의 안 움직였으면 '누르기'
  function bindDrag() {
    $('#list').querySelectorAll('.pkc').forEach(c => {
      c.onpointerdown = e => {
        const i = +c.dataset.i, p = st.picks[i];
        if (!p) { c.onclick = () => pkTap(i); return; }
        e.preventDefault();
        const x0 = e.clientX, y0 = e.clientY; let ghost = null, moved = false;
        const app = $('#app').getBoundingClientRect(), sc = app.width / 440;
        const move = ev => {
          if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 8) return;
          if (!moved) { moved = true; ghost = c.cloneNode(true); ghost.className = 'pkc drag'; $('#app').appendChild(ghost); c.classList.add('lift'); pkSel = i; }
          ghost.style.left = (ev.clientX - app.left) / sc + 'px'; ghost.style.top = (ev.clientY - app.top) / sc + 'px';
        };
        const up = ev => {
          document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
          if (!moved) { pkTap(i); return; }
          ghost.remove(); c.classList.remove('lift');
          ghost.hidden = true;
          const t = document.elementFromPoint(ev.clientX, ev.clientY), tc = t && t.closest && t.closest('.pkc');
          const j = tc && tc.dataset.i != null ? +tc.dataset.i : -1;
          if (j >= 0 && j !== i) {
            if (tryMerge(i, j)) return;
            if (!st.picks[j]) { st.picks[j] = st.picks[i]; st.picks[i] = null; pkSel = -1; Sound.play('click'); renderPk(); save(); return; }
          }
          pkSel = -1; renderPk();
        };
        document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
      };
    });
  }

  // ---------- 💠 환생 ----------
  function renderRb() {
    const L = $('#list'), got = I.crystalsFor(st), best = st.best || 0;
    const why = best < I.RB.OPEN ? `5-1에 도착하면 환생할 수 있어요 (지금 ${I.stageNo(best)})` : `시작 지점(${I.stageNo(st.start || 0)})보다 한 챕터 더 내려가야 해요`;
    const startAt = I.stageNo(I.chapterStart(Math.floor(Math.max(st.allBest || 0, best) / 2)));
    L.innerHTML = `<div class="rbhead"><b>💠 환생 ${st.rb || 0}단계</b><small>몬스터 ×${f2(I.diff())} 단단함</small>
        <div class="rbstat"><span>보유 결정 <b>${fmt(st.crystals || 0)}</b></span><span>결정 보너스 <b>+${fmt((I.holdX(st) - 1) * 100)}%</b></span></div></div>
      <div class="rbgo">
        <p>이번 최고 <b>${I.stageNo(best)}</b> · 역대 <b>${I.stageNo(Math.max(st.allBest || 0, best))}</b></p>
        ${got ? `<p>지금 환생하면 💠 <b>${fmt(got)}</b>개 · <b>${startAt}</b>부터 다시 (난이도 ↑)</p>` : `<p class="muted">${why}</p>`}
        <button id="rbBtn" ${got ? '' : 'disabled'}>💠 환생하기</button>
        <small>초기화: 스테이지 · 광석 · 강화 / 유지: 곡괭이 · 도감 · 심볼 · 결정 · 기록</small>
      </div>
      <p class="dexh">💠 영구 강화 (환생해도 유지)</p>
      ${Object.keys(I.CUP).map(k => { const U = I.CUP[k], lv = I.cLv(st, k), mx = U.max && lv >= U.max, c = U.cost(lv);
        return `<div class="up"><div class="ui"><span class="emo">${U.icon}</span></div><div class="ut"><b>${U.name} <small>Lv.${lv}</small></b><span class="ud">${U.desc}</span></div>
          <button class="ub cub" data-k="${k}" ${mx || (st.crystals || 0) < c ? 'disabled' : ''}>${mx ? 'MAX' : `💠 ${fmt(c)}`}</button></div>`; }).join('')}`;
    L.querySelectorAll('.cub').forEach(b => b.onclick = () => { if (I.buyC(st, b.dataset.k)) { Sound.play('coin'); recalc(); setDur(); renderRb(); refreshTop(); save(); } });
    const rb = $('#rbBtn'); if (rb) rb.onclick = doPrestige;
  }
  async function doPrestige() {
    const got = I.crystalsFor(st); if (!got || mode !== 'auto') return;
    const startAt = I.stageNo(I.chapterStart(Math.floor(Math.max(st.allBest || 0, st.best || 0) / 2)));
    const ok = await new Promise(done => {
      const m = $('#modal');
      m.innerHTML = `<div class="box"><h3>💠 환생할까요?</h3><p>결정 <b>${fmt(got)}</b>개를 받고 <b>${startAt}</b>부터 다시 시작해요.<br>몬스터는 조금 더 단단해져요.</p>
        <small class="muted">광석 · 강화는 초기화 / 곡괭이 · 도감 · 결정 · 기록은 유지</small>
        <div class="mrow"><button class="mbtn ghost" data-v="0">더 내려가기</button><button class="mbtn" data-v="1">환생!</button></div></div>`;
      m.hidden = false;
      m.querySelectorAll('.mbtn').forEach(b => b.onclick = () => { m.hidden = true; m.innerHTML = ''; done(b.dataset.v === '1'); });
    });
    if (!ok || mode !== 'auto') return;
    mode = 'rebirth';
    flash('#bff3ff', 1, 900); Sound.play('fanfare');
    const [x, y] = arenaXY($('#pick'));
    for (let k = 0; k < 3; k++) setTimeout(() => emit({ t: 'ring', x, y, r0: 10, r1: 300, w: 16, color: '#7ff7ff', life: .7 }), k * 200);
    I.prestige(st);
    banner('환생!', `💠 +${fmt(got)} · ${I.stageNo(st.floor)}부터`, '#7ff7ff', 2200);
    goldShown = 0; recalc(); buildCells(); setDur(); showPick();
    $('#mob').getAnimations().forEach(a => a.cancel()); newMob(); refresh(); renderList();
    await wait(1200);
    mode = 'auto'; renderList(); refresh(); save(); rankSubmit();
  }

  // ---------- 🏆 층수 랭킹 (Supabase) ----------
  const ON = window.ONLINE || {};
  function rankId() {
    let id; try { id = JSON.parse(localStorage.getItem('pickidle_id')); } catch (e) { /* 없음 */ }
    if (!id || !id.secret) {
      const r = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');
      id = { secret: r(16), pid: r(6) };
      try { localStorage.setItem('pickidle_id', JSON.stringify(id)); } catch (e) { /* 저장 불가 */ }
    }
    return id;
  }
  async function rpc(fn, body) {
    if (!ON.SUPABASE_URL || !ON.SUPABASE_ANON_KEY) throw new Error('offline');
    const key = ON.SUPABASE_ANON_KEY;
    const H = key.startsWith('sb_') ? { apikey: key, 'Content-Type': 'application/json' } : { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
    const r = await fetch(ON.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, { method: 'POST', headers: H, body: JSON.stringify(body || {}) });
    if (!r.ok) throw new Error(fn + ' ' + r.status);
    const t = await r.text(); return t ? JSON.parse(t) : null;
  }
  const myBest = () => Math.max(st.allBest || 0, st.best || 0);
  let rankT;
  function rankSubmit() {
    if (!st.nick) return;
    clearTimeout(rankT);
    rankT = setTimeout(() => { const id = rankId(); rpc('idle_submit', { p_secret: id.secret, p_pid: id.pid, p_nick: st.nick, p_best: myBest(), p_rb: st.rb || 0 }).catch(() => {}); }, 800);
  }
  async function renderRank() {
    const L = $('#list');
    if (!st.nick) {
      L.innerHTML = `<div class="rkjoin"><h3>🏆 층수 랭킹</h3><p>누가 가장 깊이 내려갔는지 겨뤄요.<br>랭킹에 쓸 닉네임을 정해 주세요.</p>
        <input id="nickIn" maxlength="12" placeholder="닉네임 (1~12자)"><button id="nickOk">참가하기</button></div>`;
      $('#nickOk').onclick = () => { const v = $('#nickIn').value.trim(); if (!v) return toast('닉네임을 입력해 주세요'); st.nick = v.slice(0, 12); save(); rankSubmit(); setTimeout(renderRank, 1200); };
      return;
    }
    L.innerHTML = `<p class="dexh">🏆 층수 랭킹 · 역대 최고 스테이지</p><p class="muted" style="text-align:center">불러오는 중…</p>`;
    try {
      const id = rankId();
      await rpc('idle_submit', { p_secret: id.secret, p_pid: id.pid, p_nick: st.nick, p_best: myBest(), p_rb: st.rb || 0 });
      const [top, me] = await Promise.all([rpc('idle_top', { p_limit: 50 }), rpc('idle_my_rank', { p_pid: id.pid })]);
      if (tab !== 'rank') return;
      L.innerHTML = `<p class="dexh">🏆 층수 랭킹 · 역대 최고 스테이지</p>
        <div class="rkme">내 순위 <b>${me || '-'}위</b> · ${st.nick} · <b>${I.stageNo(myBest())}</b> · 환생 ${st.rb || 0} <button id="nickCh">닉네임 변경</button></div>
        <div class="rklist">${(top || []).map((r, i) => `<div class="rk ${r.pid === id.pid ? 'me' : ''}"><span class="no">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><b>${escapeHtml(r.nick)}</b><span class="st">${I.stageNo(r.best)}</span><small>환생 ${r.rb}</small></div>`).join('') || '<p class="muted">아직 아무도 없어요. 1등을 노려 보세요!</p>'}</div>`;
      $('#nickCh').onclick = () => { st.nick = ''; renderRank(); };
    } catch (e) {
      if (tab === 'rank') L.innerHTML = `<p class="dexh">🏆 층수 랭킹</p><p class="muted" style="text-align:center">랭킹 서버에 연결하지 못했어요.<br>잠시 뒤 다시 열어 주세요.</p>`;
    }
  }
  const escapeHtml = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- 🧭 첫 10분 안내 (docs/onboarding.md) ----------
  //  필요해지는 순간 하나씩 열고, 처음 볼 때만 말풍선 한 줄. 방치 플레이는 멈추지 않음
  const tipQ = [];
  let tipOn = false;
  function tip(key, text, target) {
    st.tips = st.tips || {};
    if (st.tips[key] || st.tips.old) return;
    st.tips[key] = 1; save();
    tipQ.push({ text, target }); if (!tipOn) nextTip();
  }
  function nextTip() {
    const t = tipQ.shift(); if (!t) { tipOn = false; return; }
    tipOn = true;
    const h = $('#hint'); h.textContent = t.text; h.hidden = false;
    h.animate([{ transform: 'translate(-50%,10px) scale(.8)', opacity: 0 }, { transform: 'translate(-50%,0) scale(1)', opacity: 1 }], { duration: 250, easing: 'ease-out' });
    if (t.target) { const el = $(t.target); if (el) el.classList.add('finger'); }
    const close = () => {
      clearTimeout(h._t); document.removeEventListener('pointerdown', close, true);
      h.hidden = true; setTimeout(nextTip, 250);
    };
    setTimeout(() => document.addEventListener('pointerdown', close, true), 400);
    h._t = setTimeout(close, 4500);
  }
  const ALL_TABS = ['up', 'pk', 'rb', 'dex'];         // 🏆 랭킹은 보류 중이라 숨김
  function applyTabs() {
    const open = st.tabs || ALL_TABS;
    document.querySelectorAll('#tabs button').forEach(b => { b.hidden = !open.includes(b.dataset.t); });
  }
  function openTab(t, text) {
    st.tabs = st.tabs || ['up'];
    if (st.tabs.includes(t)) return;
    st.tabs.push(t); st.tabs.sort((a, b) => ALL_TABS.indexOf(a) - ALL_TABS.indexOf(b)); applyTabs(); save();
    const b = $(`#tabs button[data-t="${t}"]`);
    if (b) { b.classList.add('newtab'); b.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.3)', offset: .6 }, { transform: 'scale(1)' }], { duration: 500, easing: 'ease-out' }); }
    if (text) tip('tab_' + t, text);
  }
  // 강화 목록: 처음엔 공격력 · 내구도 · 광석 3개만, 2-1에 도착하면 전부
  const BASIC_UP = ['atk', 'dur', 'coin'];
  const upKeys = () => st.allUp ? Object.keys(I.UP) : Object.keys(I.UP).filter(k => BASIC_UP.includes(k));
  // 매 공격마다(refreshTop) 확인: 조건이 되면 열고 안내
  function onboard() {
    if (st.tips && st.tips.old) return;
    if (!st.tips || !st.tips.hello) tip('hello', '⛏ 곡괭이가 자동으로 몬스터를 캐요!');
    if (st.gold >= Math.ceil(I.UP.atk.cost(st.lv.atk)) && st.lv.atk === 0) tip('up', '광석으로 곡괭이를 강화해요 👇', '#list .ub[data-k="atk"]');
    if (st.lv.atk > 0) { const f = $('#list .ub[data-k="atk"].finger'); if (f) f.classList.remove('finger'); }
    if (I.bossReady(st)) tip('boss', '👑 보스 스테이지! 5스테이지마다 보스가 나와요');
    if (Object.keys(st.dex || {}).length) openTab('dex', '📖 잡은 보스는 도감에 모여요');
    if (st.picks.some(Boolean)) openTab('pk', '⛏ 곡괭이를 얻었어요! 같은 곡괭이 2개를 겹치면 더 강해져요');
    if (st.picks.filter(Boolean).length >= 2) tip('merge', '⛏ 곡괭이 탭에서 같은 곡괭이를 끌어서 겹쳐 보세요', '#tabs button[data-t="pk"]');
    if (Math.max(st.best || 0, st.allBest || 0) >= 10 && !st.allUp) { st.allUp = true; if (tab === 'up') renderList(); tip('up2', '💪 새 강화 4개가 열렸어요!'); }
    if (Math.max(st.best || 0, st.allBest || 0) >= 30) openTab('rb', '💠 5-1부터 환생할 수 있어요. 처음부터 다시 하지만 훨씬 강해져요');
    if (I.canPrestige(st)) tip('rb2', `💠 지금 환생하면 결정 ${fmt(I.crystalsFor(st))}개!`, '#tabs button[data-t="rb"]');
  }

  // ---------- 🩹 몬스터가 안 보이면 자동 복구 + 원인 기록 ----------
  //  "몬스터가 투명해지는데 게임은 진행됨" 재현이 안 돼서, 생기면 고치고 무엇이 문제였는지 남김
  //  기록 보기: 주소 뒤에 ?diag=1
  function diag(kind, info) {
    try {
      const d = JSON.parse(localStorage.getItem('pickidle_diag') || '[]');
      d.unshift({ at: new Date().toISOString(), kind, info, f: I.stageNo(st.floor), mode, ua: navigator.userAgent.slice(0, 80) });
      localStorage.setItem('pickidle_diag', JSON.stringify(d.slice(0, 20)));
    } catch (e) { /* 무시 */ }
  }
  let healBad = 0;
  function healMob() {
    if (mode !== 'auto' || !alive || document.hidden || !mob) { healBad = 0; return; }
    const im = $('#mobImg'), mi = $('#mob .mimg'), sp = $('#mob .spr'), m = $('#mob');
    const why = [];
    if (!im.getAttribute('src')) why.push('no-src');
    else if (im.complete && !im.naturalWidth) why.push('broken:' + im.src.split('/').slice(-2).join('/'));
    for (const [n, el] of [['mob', m], ['mimg', mi], ['spr', sp], ['img', im]]) {
      const cs = getComputedStyle(el);
      if (+cs.opacity < .15) why.push(n + '-opacity:' + cs.opacity);
      if (cs.visibility !== 'visible') why.push(n + '-hidden');
      if (/^matrix\(0,/.test(cs.transform)) why.push(n + '-scale0');
    }
    if (mi.style.filter) why.push('mimg-filter:' + mi.style.filter);
    if (!why.length) { healBad = 0; return; }
    if (++healBad < 2) return;            // 1초 넘게 계속 안 보일 때만 (연출 중 잠깐은 정상)
    healBad = 0;
    diag('invisible', why.join(' ') + ' | anims:' + m.getAnimations().map(a => a.playState + '/' + a.effect.getTiming().fill).join(','));
    [m, mi, sp, im].forEach(el => { el.getAnimations().forEach(a => a.cancel()); el.style.opacity = ''; });
    mi.style.filter = '';
    healMob.n = (healMob.n || 0) + 1;
    if (healMob.n >= 2 && +getComputedStyle(m).opacity < .15) {       // 그래도 투명 → 같은 모양으로 새로 만들어 바꿔 끼움
      const fresh = m.cloneNode(true); fresh.style.opacity = '1'; m.replaceWith(fresh); healMob.n = 0;
      diag('replaced', 'mob element re-created');
    }
    const spr = sprOf(mob); im.src = ''; im.src = spr;
  }
  function showDiag() {
    let d = []; try { d = JSON.parse(localStorage.getItem('pickidle_diag') || '[]'); } catch (e) { /* 없음 */ }
    modal(`<h3>🩹 문제 기록</h3><p style="text-align:left;font-size:11px;max-height:300px;overflow:auto;word-break:break-all">${d.length ? d.map(x => `<b>${x.at.slice(5, 16)} ${x.kind}</b> ${x.f} ${x.mode}<br>${x.info}<br><small>${x.ua || ''}</small>`).join('<br><br>') : '기록 없음'}</p>`, '닫기');
  }

  // ---------- 상단 · 강화 목록 ----------
  const floorName = f => { const z = I.zoneOf(C, f); return `${I.stageNo(f)} ${z ? `심층${z + 1} ` : ''}${C.TIERS[I.mineOf(C, f)].name}`; };
  let gpsCache = 0, avgCache = 1, baseCache = 1;
  function recalc() {
    gpsCache = I.goldPerSec(st);
    const a = I.avgDmg(st); avgCache = a.dmg; baseCache = a.base;
  }
  function refreshTop() {
    onboard();
    $('#gps').textContent = `초당 ${fmt(gpsCache)}`;
    setDur();
    $('#autoBtn').textContent = st.auto ? '자동 도전 ON' : '자동 도전 OFF';
    $('#autoBtn').classList.toggle('on', !!st.auto);
    $('#floorName').textContent = floorName(st.floor);
    preloadMines();
    // 안전장치: 사냥 중인데 몬스터가 안 보이는 상태로 남아 있으면 바로 복구
    if (mode === 'auto' && alive && +getComputedStyle($('#mob')).opacity < .1) $('#mob').getAnimations().forEach(a => a.cancel());
    // 보스까지 남은 몬스터 (스테이지 진행으로 착각하지 않게 글자로 표시)
    const cs = I.chapterStart(st.floor), pos = st.floor - cs;
    $('#pips').className = 'dots';
    $('#pips').innerHTML = Array.from({ length: I.IDLE.STAGES }, (_, i) => {
      const f = cs + i, cls = i < pos ? 'done' : i === pos ? 'now' : '';
      return I.isBossStage(f) ? `<b class="${cls}">${I.isSBoss(f) ? '💀' : '👑'}</b>` : `<i class="${cls}"></i>`;
    }).join('');
    const ready = I.bossReady(st);
    $('#bossBtn').disabled = !ready || mode !== 'auto';
    $('#bossBtn').classList.toggle('ready', ready && mode === 'auto');
    const shots = Math.max(1, I.mobHp(st.floor) / Math.max(1, avgCache));
    $('#killHint').textContent = mode === 'boss' ? `반격 ${fmt(I.bossAtk(st.floor))}` : `평균 ${shots <= 1 ? '한 방' : f2(Math.ceil(shots * 10) / 10) + '방'}에 처치 · 반격 ${fmt(I.mobAtk(st.floor))}`;
    syncPick();
    const rbt = $('#tabs button[data-t="rb"]'); if (rbt) rbt.classList.toggle('glow', I.canPrestige(st));
    if (tab === 'up') updateButtons();
  }
  function upDesc(k) {
    const lv = st.lv[k], S = I.stat, nx = lv + 1;
    const pctOf = (sym, lvx) => { const w = I.weights(Object.assign({}, st, { lv: lvx })); const t = w.reduce((a, e) => a + e[1], 0); return Math.round((w.find(e => e[0] === sym) || [0, 0])[1] / t * 100) + '%'; };
    const L2 = Object.assign({}, st.lv, { [k]: nx });
    switch (k) {
      case 'atk': {
        const m = I.pickMult(st);
        return `공격력 ${fmt(S.atk(lv) * m)} → <b>${fmt(S.atk(nx) * m)}</b>${(st.tabs || []).includes('pk') ? ` <i class="evo">곡괭이 ×${f2(m)}</i>` : ''}`;
      }
      case 'spd': return `초당 ${f2(S.aps(lv))}번 → <b>${f2(S.aps(nx))}번</b>`;
      case 'gem': { const g0 = I.GEM_V(st), g1 = I.GEM_V(Object.assign({}, st, { lv: L2 })); return `${I.ladderOf(st).name} 확률 ${pctOf('gem', st.lv)} → <b>${pctOf('gem', L2)}</b> · 피해 ×${f2(g0)} → <b>×${f2(g1)}</b>`; }
      case 'chest': { const t0 = I.TNT_X(st), t1 = I.TNT_X(Object.assign({}, st, { lv: L2 })); return `💣 TNT 곱하기 ×${f2(t0)} → <b>×${f2(t1)}</b>`; }
      case 'coin': return `처치 광석 ×${f2(S.coinX(lv))} → <b>×${f2(S.coinX(nx))}</b>`;
      case 'dur': return `내구도 ${fmt(S.dur(lv))} → <b>${fmt(S.dur(nx))}</b> · 반격 ${Math.floor(S.dur(nx) / I.mobAtk(st.floor))}대 버팀`;
      case 'cells': return `탐지 칸 ${S.cells(lv)}칸 → <b>${S.cells(nx)}칸</b> · 칸이 많을수록 보석·황금 광맥이 쉬워요`;
    }
    return '';
  }
  let tab = 'up';
  function renderList() {
    const L = $('#list');
    if (tab === 'up') {
      L.innerHTML = upKeys().map(k => `<div class="up" data-k="${k}"><div class="ui">${k === 'atk' ? `<img src="${pickSrc(cur())}" alt="">` : k === 'dur' ? '<span class="emo">🛠️</span>' : img(I.UP[k].icon)}</div>
        <div class="ut"><b>${I.UP[k].name} <small>Lv.${st.lv[k]}</small></b><span class="ud"></span></div>
        <button class="ub" data-k="${k}"></button></div>`).join('');
      L.querySelectorAll('.ub').forEach(b => b.onclick = () => {
        const k = b.dataset.k;
        const durBefore = I.maxDur(st);
        if (!I.buy(st, k)) return;
        if (k === 'dur') { st.dur += I.maxDur(st) - durBefore; setDur(); }
        Sound.play('coin');
        recalc();
        if (k === 'cells') { buildCells(); toast('탐지 칸이 늘었어요!'); }
        const row = b.closest('.up'); row.animate([{ background: '#fff3a0' }, { background: '' }], { duration: 400 });
        row.querySelector('.ui').animate([{ transform: 'scale(1.35) rotate(-12deg)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.3,1.6,.5,1)' });
        // 강화하면 광부가 잠깐 빛남 → "세졌다"를 화면 위쪽에서도 느끼게
        $('#pick img').animate([{ filter: 'brightness(1.8)' }, { filter: 'brightness(1)' }], { duration: 450 });
        const [mx, my] = arenaXY($('#pick'));
        floatAt(mx, my - 70, `${I.UP[k].name} UP!`, 'upf', 900, { punch: 1.3 });
        if (k === 'atk') renderIcon();
        renderRow(k); refreshTop(); save();
      });
      upKeys().forEach(renderRow);
    } else if (tab === 'pk') {
      renderPk();
    } else if (tab === 'rb') {
      renderRb();
    } else if (tab === 'rank') {
      renderRank();
    } else {
      const all = C.allCards(), have = all.filter(c => st.dex[C.cardKey(c)]);
      const dx = st.pkDex || {};
      const un = I.unlocked(st);
      syncGem();
      const symRows = Object.keys(I.SYMS).map(k => { const S = I.SYMS[k], on = un.includes(k);
        const nm = k === 'gem' ? I.ladderOf(st).name : S.name, ds = k === 'gem' ? `피해를 크게 더해요 (공격력 ×${f2(I.GEM_V(st))})` : k === 'tnt' ? `피해 ×1을 더하고 · 전체 피해 ×${f2(I.TNT_X(st))}` : S.desc;
        return `<div class="sym ${on ? 'on' : ''}">${img(k)}<div><b>${on ? nm : '???'}</b><small>${on ? ds : `${I.stageNo(Math.max(0, S.u - 1))} 보스를 잡으면 해금`}</small></div></div>`; }).join('');
      L.innerHTML = `<p class="dexh">⛏ 광맥 그림 <b>${un.length}</b> / ${Object.keys(I.SYMS).length}</p><div class="syms">${symRows}</div>
        <p class="dexh">⛏ 곡괭이 도감 <b>${I.dexCount(st)}</b> / 40 · 처음 만들 때마다 공격력 +2% (지금 +${I.dexCount(st) * 2}%)</p>
        <div class="pkdex"><span></span>${PICKS.map((p, g) => `<span class="gh">${g + 1}</span>`).join('')}${I.PICK.types.map((T, t) => `<b style="color:${T.c}">${T.e}</b>${PICKS.map((p, g) => `<div class="pd ${dx[t + ':' + g] ? 'on' : ''}" style="--tc:${T.c}"><img src="${pickSrc(g)}" alt=""></div>`).join('')}`).join('')}</div>
        <p class="muted" style="text-align:center;font-size:11px">${I.PICK.types.map((T, t) => `${T.e} 최고 ${I.gradeName((st.pkStar || {})[t] || 0)}`).join(' · ')}</p>
        <p class="dexh">보스를 잡으면 카드를 얻어요 · <b>${have.length}</b> / ${all.length}</p>
        <div class="dex">${have.length ? have.map(c => `<div class="dc"><img src="${C.cardImg(c)}" alt=""><small>${c.grade} · ${c.name}</small></div>`).join('') : '<p class="muted">아직 없어요. 5스테이지마다 나오는 👑 보스를 잡아 보세요!</p>'}</div>
        <button id="resetBtn" class="resetbtn">🔄 처음부터 다시 하기</button>`;
      $('#resetBtn').onclick = resetAll;
    }
  }
  function renderIcon() { const i = $('#list .up[data-k="atk"] .ui img'); if (i) i.src = pickSrc(cur()); }
  // 진화 연출 없이 단계가 바뀐 경우(불러오기 등)에도 그림을 맞춤
  function syncPick() { if ($('#pick').dataset.k !== `${st.eq.t}:${st.eq.g}` && !evolving) showPick(); }
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
    // 테스트용: 주소 끝에 ?reset=1 을 붙이면 저장을 지우고 처음부터
    if (/[?&]reset=1/.test(location.search)) { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ } history.replaceState(null, '', location.pathname); }
    load(); fit(); makeCracks(); showPick(); applyTabs();
    const cv = $('#pfx'); cv.width = 880; cv.height = 660; P.cx = cv.getContext('2d'); P.cx.scale(2, 2);
    goldShown = st.gold; goldTick();
    buildCells();
    recalc();
    renderList();
    newMob();
    refresh();
    document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => {
      tab = b.dataset.t; Sound.play('click'); b.classList.remove('finger', 'newtab');
      if (tab === 'pk') { pkNew = 0; pkBadge(); pkSel = -1; }
      document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
      renderList();
    });
    $('#bossBtn').onclick = () => { Sound.unlock(); bossFight(false); };
    $('#autoBtn').onclick = () => { st.auto = !st.auto; Sound.play('click'); toast(st.auto ? '보스가 열리면 자동으로 도전해요' : '보스는 👑 버튼으로 직접 도전해요'); refreshTop(); save(); };
    mobLoop();
    $('#cells').addEventListener('pointerover', e => { if (e.pointerType === 'mouse') { const c = e.target.closest('.cell'); if (c) showTip(c); } });
    $('#cells').addEventListener('pointerout', e => { if (e.pointerType === 'mouse' && e.target.closest('.cell')) hideTip(); });
    $('#cells').addEventListener('click', e => { const c = e.target.closest('.cell'); if (c) showTip(c); });
    setGauge(); $('#cells').classList.add('idle');
    $('#slotbox').addEventListener('click', () => { if (mode === 'auto' && gauge >= I.IDLE.GAUGE) { pullReq = true; Sound.unlock(); } });
    document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) save();
      else { offlineReward(); }
    });
    setInterval(() => { if (!document.hidden) save(); }, 5000);
    setInterval(healMob, 600);
    if (/[?&]diag=1/.test(location.search)) setTimeout(showDiag, 800);
    offlineReward().then(() => autoLoop());
    window.__idle = { st: () => st, mode: () => mode, alive: () => alive, I, save, hp: f => { mobHp = mobMax * f; setHp(); } };
  }
  start();
})();
