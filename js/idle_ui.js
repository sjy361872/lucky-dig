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
  };
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
    d.className = 'banner'; d.style.setProperty('--c', color);
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
  const pick = a => a[Math.floor(rnd() * a.length)];
  // 한 대 때릴 때: 베기 궤적 + 불꽃 + 돌 파편 (+크리티컬이면 충격파)
  function hitBurst(x, y, crit, huge) {
    const a = -0.6 + (rnd() - .5) * .8;
    emit({ t: 'slash', x: x - 10, y, r: crit ? 70 : 55, a, sweep: 2.2, w: crit ? 12 : 8, color: crit ? '#ffd34a' : '#bfefff', life: .22 });
    const n = huge ? 26 : crit ? 16 : 8;
    for (let i = 0; i < n; i++) {
      const ang = rnd() * Math.PI * 2, sp = 250 + rnd() * (crit ? 520 : 300);
      emit({ t: 'spark', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, drag: .9, w: 3, color: pick(HOT), life: .25 + rnd() * .2 });
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
  function showSyms(syms, combo) {
    let n = 0;
    syms.forEach((s, i) => {
      const el = cellEls[i]; if (!el) return;
      el.innerHTML = img(s);
      const on = !!(combo && s === combo);
      el.classList.toggle('combo', on);
      el.classList.toggle('chest', s === 'chest');
      // 콤보 칸은 왼쪽부터 차례로 통통 튐
      if (on || s === 'chest') el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.22) translateY(-8px)' }, { transform: 'scale(1)' }], { duration: 260, delay: (n++) * 55, easing: 'ease-out' });
    });
  }
  const popCell = el => el.animate([{ transform: 'scale(1.18) translateY(-5px)' }, { transform: 'scale(.96)', offset: .6 }, { transform: 'scale(1)' }], { duration: 170, easing: 'ease-out' });
  // 릴 연출: 고정 안 한 칸은 잠깐 섞였다가 왼쪽부터 멈춤
  async function spinAnim(syms, ms, keep) {
    const keys = Object.keys(I.SYMS), n = syms.length, t0 = performance.now();
    $('#calc').classList.add('dim');
    cellEls.forEach((el, i) => { el.classList.remove('combo', 'chest'); if (!(keep && keep[i])) el.classList.add('spinning'); });
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
    return `${parts.join(' × ')} = <b>${fmt(r.dmg)}</b>`;
  }

  // ---------- 몬스터 ----------
  let mob = null, mobHp = 0, mobMax = 1, mode = 'auto', alive = true;
  function setMob(card, hp, boss) {
    mob = card; mobHp = mobMax = hp;
    $('#mobImg').src = C.cardImg(card);
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
  }
  function newMob() { setMob(I.mobCard(C, st.floor, rnd, false), I.mobHp(st.floor), false); alive = true; }

  // 공격 한 번: 광부 휘두름 → 몬스터 맞음
  async function hit(r, big) {
    const mi = $('#miner');
    mi.classList.remove('swing'); void mi.offsetWidth; mi.classList.add('swing');
    await wait(120);                                    // 곡괭이가 내려꽂히는 순간에 맞춤
    const m = $('#mob .mimg'), [x, y] = arenaXY(m);
    const crit = r.combo > 1 || r.chests > 0;
    const huge = r.comboN >= 4 || r.chests >= 2 || (r.combo > 1 && r.chests > 0);
    const frac = Math.min(1, r.dmg / mobMax);           // 체력의 몇 %를 깎았나 → 흔들림 크기
    mobHp -= r.dmg;
    m.classList.remove('hurt'); void m.offsetWidth;
    // 히트스톱: 큰 한 방은 화면이 아주 잠깐 멈춤 → '묵직하다'는 느낌
    if (crit) {
      m.style.filter = 'brightness(4) saturate(0)'; mi.style.animationPlayState = 'paused';
      hitBurst(x, y, true, huge);
      await wait(huge ? 150 : 75);
      m.style.filter = ''; mi.style.animationPlayState = '';
    } else hitBurst(x, y, false, false);
    m.classList.add(crit ? 'hurtbig' : 'hurt');
    setTimeout(() => m.classList.remove('hurtbig'), 350);
    floatAt(x + (rnd() - .5) * 40, y - 70, fmt(r.dmg), crit ? 'crit' : '', crit ? 1300 : 800, { dx: (rnd() - .5) * 70, punch: crit ? 1.9 : 1.3 });
    Sound.play('hit', { type: crit ? 'diamond' : 'stone', ratio: .5 });
    if (huge) {
      const t = r.comboN >= 5 ? '잭팟!!' : r.chests >= 2 ? '보물 대박!' : r.combo > 1 && r.chests ? '콤보 + 상자!' : `${r.comboN}콤보!`;
      banner(t, `대미지 ×${fmt(r.combo * r.chestMult)}`, r.chests ? '#ffd34a' : '#7ff7ff');
      flash('#fff', .7, 320);
      if (r.comboN >= 5 || r.chests >= 2) coinShower(16);
      Sound.play('chestBig');
    } else {
      if (r.combo > 1) { floatAt(220, 150, `${I.SYMS[r.comboSym].name} ${r.comboN}개 콤보! ×${r.combo}`, 'combo', 1300, { punch: 1.5 }); Sound.play('big'); flash('#7ff7ff', .25); }
      if (r.chests) { floatAt(220, 120, `📦 상자 ×${f2(r.chestMult)}!`, 'chestf', 1300, { punch: 1.6 }); Sound.play('chestBig'); flash('#ffd34a', .35); }
    }
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
    newMob();
  }

  // ---------- 자동 사냥 루프 ----------
  async function autoLoop() {
    while (true) {
      if (mode !== 'auto' || document.hidden) { await wait(200); continue; }
      const aps = I.stat.aps(st.lv.spd), period = 1000 / aps;
      const t0 = performance.now();
      const syms = I.roll(st, rnd), r = I.evalSpin(st, syms);
      await spinAnim(syms, Math.min(260, period * 0.5));
      if (mode !== 'auto') continue;
      showSyms(syms, r.comboSym);
      setCalc(calcText(r, syms));
      await hit(r);
      if (mobHp <= 0 && alive) await killMob();
      refreshTop();
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
  async function bossFight() {
    if (mode !== 'auto' || !I.bossReady(st)) return;
    mode = 'boss';
    await wait(300);
    document.body.classList.add('bossmode');
    $('#bossBar').hidden = false;
    const card = I.mobCard(C, st.floor, rnd, true);
    setMob(card, I.bossHp(st.floor), true);
    Sound.play('drumroll');
    floatAt(220, 120, 'BOSS!', 'bossf', 1400);
    await wait(900);
    let rer = I.IDLE.BOSS_REROLLS, quit = false;
    for (let t = I.IDLE.BOSS_SPINS; t > 0 && mobHp > 0 && !quit; t--) {
      $('#bossTurns').textContent = `남은 공격 ${t}`;
      held = [];
      let syms = I.roll(st, rnd);
      await spinAnim(syms, 650);
      for (;;) {
        const v = await bossDecision(syms, rer);
        if (v === 'quit') { quit = true; break; }
        if (v === 'attack') break;
        rer--;
        const keep = held.slice();
        syms = I.roll(st, rnd, syms, keep);
        await spinAnim(syms, 550, keep);
      }
      cellEls.forEach(el => el.classList.remove('held'));
      if (quit) break;
      const r = I.evalSpin(st, syms);
      showSyms(syms, r.comboSym);
      setCalc(calcText(r, syms));
      await hit(r, true);
      await wait(500);
    }
    $('#bossBar').hidden = true;
    document.body.classList.remove('bossmode');
    if (mobHp <= 0) {
      // 보스 격파 연출: 크게 터지고 → 코인 비 → 배너 → 카드 팝업
      const [bx, by] = arenaXY($('#mob .mimg'));
      killBurst(bx, by, true); flash('#fff', .9, 450); shake($('#arena'), 16, 450);
      $('#mob').animate([{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(1.25)', filter: 'brightness(5)', offset: .3 }, { transform: 'scale(0)', opacity: 0 }], { duration: 420, fill: 'forwards' });
      coinShower(30);
      banner('보스 격파!', floorName(st.floor + 1) + '로', '#ffd34a', 1600);
      Sound.play('fanfare');
      await wait(1500);
      const key = C.cardKey(card), isNew = !st.dex[key];
      st.dex[key] = (st.dex[key] || 0) + 1;
      const g = I.bossWin(st);
      save();
      await modal(`<h3>보스 격파!</h3><div class="capture"><img src="${C.cardImg(card)}" alt=""><b>${card.name}</b><small>${card.grade}상 ${isNew ? '· ✨ 새 카드! 도감 등록' : '· 이미 있는 카드'}</small></div>
        <p>광석 <b>+${fmt(g)}</b><br>다음 층으로 내려가요 → <b>${floorName(st.floor)}</b></p>`, '계속');
      buildCells();
    } else {
      st.bossFails++;
      Sound.play('last');
      await modal(`<h3>${quit ? '도전 포기' : '아깝다!'}</h3><p>보스 체력이 <b>${fmt(mobHp)}</b> 남았어요.<br>몬스터를 더 잡고 강화한 뒤 다시 도전하세요.</p>`, '돌아가기');
    }
    $('#calc').innerHTML = '';
    mode = 'auto';
    $('#mob').getAnimations().forEach(a => a.cancel());
    newMob();
    refresh();
  }

  // ---------- 상단 · 강화 목록 ----------
  const floorName = f => `${C.TIERS[I.mineOf(C, f)].name} ${(f % I.FLOORS_PER_MINE) + 1}층`;
  let gpsCache = 0, avgCache = 1;
  function recalc() {
    gpsCache = I.goldPerSec(st);
    avgCache = I.avgDmg(st).dmg;
  }
  function refreshTop() {
    $('#gps').textContent = `초당 ${fmt(gpsCache)}`;
    $('#floorName').textContent = floorName(st.floor);
    $('#pips').innerHTML = Array.from({ length: I.IDLE.KILLS }, (_, i) => `<i class="${i < st.kills ? 'on' : ''}"></i>`).join('');
    const ready = I.bossReady(st);
    $('#bossBtn').disabled = !ready || mode !== 'auto';
    $('#bossBtn').classList.toggle('ready', ready && mode === 'auto');
    const shots = Math.max(1, I.mobHp(st.floor) / Math.max(1, avgCache));
    $('#killHint').textContent = mode === 'boss' ? '' : `평균 ${shots <= 1 ? '한 방' : f2(Math.ceil(shots * 10) / 10) + '방'}에 처치`;
    if (tab === 'up') updateButtons();
  }
  function upDesc(k) {
    const lv = st.lv[k], S = I.stat, nx = lv + 1;
    const tot = lvx => 50 + 14 + S.gemW(lvx.gem) + 12 + S.chestW(lvx.chest);
    const pct = (w, lvx) => Math.round(w / tot(lvx) * 100) + '%';
    const L2 = Object.assign({}, st.lv, { [k]: nx });
    switch (k) {
      case 'atk': return `공격력 ${fmt(S.atk(lv))} → <b>${fmt(S.atk(nx))}</b>${nx % 25 === 0 ? ' <em>2배!</em>' : ''}`;
      case 'spd': return `초당 ${f2(S.aps(lv))}번 → <b>${f2(S.aps(nx))}번</b>`;
      case 'gem': return `💎 확률 ${pct(S.gemW(lv), st.lv)} → <b>${pct(S.gemW(nx), L2)}</b> · 💎 ${f2(S.gemX(lv))}타 → <b>${f2(S.gemX(nx))}타</b>`;
      case 'chest': return `📦 확률 ${pct(S.chestW(lv), st.lv)} → <b>${pct(S.chestW(nx), L2)}</b> · 배율 ×${f2(S.chestX(lv))} → <b>×${f2(S.chestX(nx))}</b>`;
      case 'coin': return `처치 광석 ×${f2(S.coinX(lv))} → <b>×${f2(S.coinX(nx))}</b>`;
      case 'cells': return `슬롯 ${S.cells(lv)}칸 → <b>${S.cells(nx)}칸</b> · 칸이 많을수록 콤보·잭팟이 쉬워요`;
    }
    return '';
  }
  let tab = 'up';
  function renderList() {
    const L = $('#list');
    if (tab === 'up') {
      L.innerHTML = Object.keys(I.UP).map(k => `<div class="up" data-k="${k}"><div class="ui">${img(I.UP[k].icon)}</div>
        <div class="ut"><b>${I.UP[k].name} <small>Lv.${st.lv[k]}</small></b><span class="ud"></span></div>
        <button class="ub" data-k="${k}"></button></div>`).join('');
      L.querySelectorAll('.ub').forEach(b => b.onclick = () => {
        const k = b.dataset.k;
        if (!I.buy(st, k)) return;
        Sound.play('coin');
        recalc();
        if (k === 'cells') { buildCells(); toast('슬롯 칸이 늘었어요!'); }
        const row = b.closest('.up'); row.animate([{ background: '#fff3a0' }, { background: '' }], { duration: 400 });
        row.querySelector('.ui').animate([{ transform: 'scale(1.35) rotate(-12deg)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.3,1.6,.5,1)' });
        // 강화하면 광부가 잠깐 빛남 → "세졌다"를 화면 위쪽에서도 느끼게
        $('#miner img').animate([{ filter: 'drop-shadow(0 0 18px #ffd34a) brightness(1.6)' }, { filter: 'drop-shadow(0 6px 4px rgba(0,0,0,.45))' }], { duration: 450 });
        const [mx, my] = arenaXY($('#miner'));
        floatAt(mx, my - 60, `${I.UP[k].name} UP!`, 'upf', 900, { punch: 1.3 });
        renderRow(k); refreshTop(); save();
      });
      Object.keys(I.UP).forEach(renderRow);
    } else {
      const all = C.allCards(), have = all.filter(c => st.dex[C.cardKey(c)]);
      L.innerHTML = `<p class="dexh">보스를 잡으면 카드를 얻어요 · <b>${have.length}</b> / ${all.length}</p>
        <div class="dex">${have.length ? have.map(c => `<div class="dc"><img src="${C.cardImg(c)}" alt=""><small>${c.grade} · ${c.name}</small></div>`).join('') : '<p class="muted">아직 없어요. 몬스터 10마리를 잡고 👑 보스에 도전하세요!</p>'}</div>`;
    }
  }
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
    load(); fit();
    const cv = $('#pfx'); cv.width = 880; cv.height = 660; P.cx = cv.getContext('2d'); P.cx.scale(2, 2);
    goldShown = st.gold; goldTick();
    buildCells();
    recalc();
    renderList();
    newMob();
    refresh();
    document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => {
      tab = b.dataset.t; Sound.play('click');
      document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
      renderList();
    });
    $('#bossBtn').onclick = () => { Sound.unlock(); bossFight(); };
    document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) save();
      else { offlineReward(); }
    });
    setInterval(() => { if (!document.hidden) save(); }, 5000);
    offlineReward().then(() => autoLoop());
    window.__idle = { st: () => st, I, save };
  }
  start();
})();
