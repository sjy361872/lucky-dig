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
  function floatAt(x, y, text, cls = '', ms = 900) {
    const d = document.createElement('div');
    d.className = 'fl ' + cls; d.textContent = text;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    $('#fx').appendChild(d);
    d.animate([{ transform: 'translate(-50%,0) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-18px) scale(1.15)', opacity: 1, offset: .2 }, { transform: 'translate(-50%,-48px) scale(1)', opacity: 0 }], { duration: ms, easing: 'ease-out' });
    setTimeout(() => d.remove(), ms);
  }
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
      setTimeout(() => c.remove(), 650 + i * 60);
    }
  }
  function shake(el, amp = 5) { el.animate([{ translate: '0 0' }, { translate: `${amp}px 0` }, { translate: `-${amp}px 0` }, { translate: '0 0' }], { duration: 180 }); }

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
    syms.forEach((s, i) => {
      const el = cellEls[i]; if (!el) return;
      el.innerHTML = img(s);
      el.classList.toggle('combo', !!(combo && s === combo));
      el.classList.toggle('chest', s === 'chest');
    });
  }
  // 릴 연출: 고정 안 한 칸은 잠깐 섞였다가 왼쪽부터 멈춤
  async function spinAnim(syms, ms, keep) {
    const keys = Object.keys(I.SYMS), n = syms.length, t0 = performance.now();
    cellEls.forEach((el, i) => { el.classList.remove('combo', 'chest'); if (!(keep && keep[i])) el.classList.add('spinning'); });
    while (true) {
      const el = performance.now() - t0;
      let left = 0;
      for (let i = 0; i < n; i++) {
        if (keep && keep[i]) continue;
        const stopAt = ms * (0.55 + 0.45 * (i + 1) / n);
        if (el < stopAt) { left++; cellEls[i].innerHTML = img(keys[Math.floor(rnd() * keys.length)]); }
        else if (cellEls[i].classList.contains('spinning')) { cellEls[i].classList.remove('spinning'); cellEls[i].innerHTML = img(syms[i]); if (ms > 300) Sound.play('stop'); }
      }
      if (!left) break;
      await wait(ms > 300 ? 60 : 40);
    }
    showSyms(syms);
  }
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
    $('#mob').animate([{ transform: 'translateX(120px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'ease-out' });
    setHp();
  }
  function setHp() {
    $('#hpFill').style.width = Math.max(0, mobHp / mobMax * 100) + '%';
    $('#hpText').textContent = `${fmt(Math.max(0, mobHp))} / ${fmt(mobMax)}`;
  }
  function newMob() { setMob(I.mobCard(C, st.floor, rnd, false), I.mobHp(st.floor), false); alive = true; }

  // 공격 한 번: 광부 휘두름 → 몬스터 맞음
  async function hit(r, big) {
    const mi = $('#miner');
    mi.classList.remove('swing'); void mi.offsetWidth; mi.classList.add('swing');
    await wait(90);
    mobHp -= r.dmg;
    const m = $('#mob .mimg');
    m.classList.remove('hurt'); void m.offsetWidth; m.classList.add('hurt');
    const crit = r.combo > 1 || r.chests > 0;
    floatAt(330 + (rnd() - .5) * 50, 70 + rnd() * 30, fmt(r.dmg), crit ? 'crit' : '', crit ? 1200 : 800);
    Sound.play('hit', { type: crit ? 'diamond' : 'stone', ratio: .5 });
    if (r.combo > 1) { floatAt(220, 150, `${I.SYMS[r.comboSym].name} ${r.comboN}개 콤보! ×${r.combo}`, 'combo', 1300); Sound.play('big'); shake($('#arena'), 6); }
    if (r.chests) { floatAt(220, 120, `📦 상자 ×${f2(r.chestMult)}!`, 'chestf', 1300); Sound.play('chestBig'); shake($('#arena'), 8); }
    if (r.coins) { const g = I.coinGold(st, r.coins); st.gold += g; floatAt(120, 120, `+${fmt(g)}`, 'goldf', 900); }
    setHp();
    if (big) shake($('#arena'), 4);
  }
  async function killMob() {
    alive = false;
    const g = I.onKill(st);
    Sound.play('coin');
    floatAt(330, 40, `+${fmt(g)}`, 'goldf big', 1000);
    coinFly(4);
    const m = $('#mob');
    m.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.4) rotate(20deg)' }], { duration: 260, fill: 'forwards' });
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
      $('#calc').innerHTML = calcText(r, syms);
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
        $('#calc').innerHTML = `이대로 공격하면 ${calcText(r, syms)}`;
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
      $('#calc').innerHTML = calcText(r, syms);
      await hit(r, true);
      await wait(500);
    }
    $('#bossBar').hidden = true;
    document.body.classList.remove('bossmode');
    if (mobHp <= 0) {
      Sound.play('fanfare');
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
    $('#gold').textContent = fmt(st.gold);
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
