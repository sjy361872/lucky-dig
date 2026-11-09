// 막힘 풀기 타이쿤 — 화면 (계산은 engine.js 의 T)
(function () {
  const P = new URLSearchParams(location.search);
  const MODE = P.get('mode') === 'b' ? 'b' : 'a';
  let SPEED = +P.get('speed') || 1;
  const $ = s => document.querySelector(s);
  const COL = ['var(--s0)', 'var(--s1)', 'var(--s2)', 'var(--s3)'];
  const SHAPE = [
    'polygon(50% 4%, 96% 92%, 4% 92%)',            // 캐기 ▲
    'circle(48% at 50% 50%)',                      // 가공 1 ●
    'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',   // 가공 2 ◆
    'inset(6% round 4px)',                         // 출하 ■
  ];
  const fmt = T.fmt;
  const money = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : Math.floor(n).toLocaleString();

  let st, running = false, guided = false, guideEl = null, lastFix = 0;
  const el = { mach: [], belt: [], slot: [] };

  // ---------- 화면 만들기 ----------
  function build() {
    const line = $('#line'); line.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const row = document.createElement('div'); row.className = 'row';
      const m = document.createElement('div'); m.className = 'mach';
      m.innerHTML = `<div class="ic" style="background:${COL[i]};clip-path:${SHAPE[i]}"></div>
        <div><div class="nm">${T.NAMES[i]}</div><div class="cap"></div></div><span class="fixb"></span><div class="load"><i></i></div>`;
      const s = document.createElement('div'); s.className = 'slot'; s.dataset.m = i;
      row.append(m, s); line.append(row);
      el.mach[i] = m; el.slot[i] = s;
      if (i < 3) {
        const b = document.createElement('div'); b.className = 'belt';
        b.innerHTML = `<div class="track" style="background-image:repeating-linear-gradient(180deg, ${COL[i]} 0 7px, transparent 7px 18px)"></div>
          <div class="pile"><div class="cubes"></div><span class="ptxt"></span><span class="loss"></span></div>`;
        line.append(b); el.belt[i] = { root: b, off: 0, cubes: b.querySelector('.cubes'), txt: b.querySelector('.ptxt'), loss: b.querySelector('.loss'), n: -1 };
      }
    }
    for (let i = 1; i < 4; i++) {
      const s = el.slot[i];
      if (MODE === 'b') {
        const btn = document.createElement('button'); btn.textContent = '보강'; btn.onclick = () => doPlace(i);
        s.append(btn);
      }
    }
    $('#modeTag').textContent = MODE.toUpperCase() + ' 버전';
    $('#tray').classList.toggle('b', MODE === 'b');
    $('#trayTxt').textContent = MODE === 'a' ? '← 보조 기계를 알맞은 칸에 끌어다 놓으세요' : '알맞은 칸의 [보강]을 누르세요';
    $('#startMode').textContent = MODE.toUpperCase() + ' 버전';
    const q = new URLSearchParams(location.search); q.set('mode', MODE === 'a' ? 'b' : 'a');
    $('#bOther').href = '?' + q.toString();
    $('#bOther').textContent = (MODE === 'a' ? 'B' : 'A') + ' 버전도 해 보기 →';
  }

  // ---------- 보조 기계 붙이기 ----------
  function doPlace(m) {
    if (!running) return;
    const r = T.place(st, m);
    if (!r.ok) {
      if (r.jam) {
        const s = el.slot[m]; s.classList.remove('wrong'); void s.offsetWidth; s.classList.add('wrong'); setTimeout(() => s.classList.remove('wrong'), 700);
        toast(r.reason + ' — 다른 칸을 찾아보세요');
      }
      return;
    }
    lastFix = performance.now();
    if (guideEl) { guideEl.remove(); guideEl = null; }
    el.slot[m].innerHTML = '<div class="placed"></div>';
    banner('막힘 해결!', `출하 <em>${fmt(r.before)} → ${fmt(r.after)}</em> /초`);
    const back = Math.round(r.backlog);
    if (back > 0) {
      const b = el.mach[m].getBoundingClientRect(), a = $('#app').getBoundingClientRect();
      float(`+${back}개 한꺼번에 출하!`, b.left - a.left + 70, b.bottom - a.top + 4);
      burst(b.left - a.left + 40, b.bottom - a.top + 10, COL[m]);
    }
  }

  // A 버전: 끌어다 놓기
  function initDrag() {
    const tok = $('#token'); let clone = null, over = null;
    const slotAt = (x, y) => {
      for (let i = 1; i < 4; i++) {
        const s = el.slot[i]; if (!s.classList.contains('on')) continue;
        const r = s.getBoundingClientRect();
        if (x >= r.left - 14 && x <= r.right + 14 && y >= r.top - 14 && y <= r.bottom + 14) return i;
      }
      return 0;
    };
    tok.addEventListener('pointerdown', e => {
      if (MODE !== 'a' || !running) return;
      e.preventDefault(); try { tok.setPointerCapture(e.pointerId); } catch (_) {}
      clone = tok.cloneNode(true); clone.id = ''; clone.classList.add('drag'); document.body.append(clone);
      tok.classList.add('ghost'); move(e);
    });
    const move = e => {
      if (!clone) return;
      clone.style.left = e.clientX + 'px'; clone.style.top = e.clientY + 'px';
      const m = slotAt(e.clientX, e.clientY);
      if (m !== over) { if (over) el.slot[over].classList.remove('hover'); over = m; if (m) el.slot[m].classList.add('hover'); }
    };
    tok.addEventListener('pointermove', move);
    const up = () => {
      if (!clone) return;
      clone.remove(); clone = null; tok.classList.remove('ghost');
      if (over) { el.slot[over].classList.remove('hover'); const m = over; over = null; doPlace(m); }
    };
    tok.addEventListener('pointerup', up); tok.addEventListener('pointercancel', up);
  }

  // ---------- 연출 ----------
  const fx = () => $('#fx');
  function addFx(node, ms) { fx().append(node); setTimeout(() => node.remove(), ms); }
  function banner(t, sub) { const d = document.createElement('div'); d.className = 'banner'; d.innerHTML = `<b>${t}</b><span>${sub}</span>`; addFx(d, 2500); }
  function float(t, x, y) { const d = document.createElement('div'); d.className = 'float'; d.textContent = t; d.style.left = x + 'px'; d.style.top = y + 'px'; addFx(d, 1500); }
  function toast(t) { fx().querySelectorAll('.toast').forEach(n => n.remove()); const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; addFx(d, 2700); }
  function burst(x, y, c) {
    for (let k = 0; k < 18; k++) {
      const d = document.createElement('div'); d.className = 'cube'; d.style.background = c;
      d.style.left = x + 'px'; d.style.top = y + 'px';
      d.style.setProperty('--dx', (Math.random() * 160 - 40) + 'px'); d.style.setProperty('--dy', (Math.random() * -120 - 10) + 'px');
      addFx(d, 950);
    }
  }

  // ---------- 매 프레임 그리기 ----------
  let uiT = 0;
  function draw(dt) {
    // 벨트 움직임 (속도 = 흐르는 양)
    for (let i = 0; i < 3; i++) {
      const b = el.belt[i], r = st.rateOut[i];
      b.off += dt * (r > 0.05 ? 10 + 22 * Math.log10(1 + r) : 0);
      b.root.firstElementChild.style.backgroundPositionY = b.off.toFixed(1) + 'px';
    }
    uiT += dt; if (uiT < 0.1) return; uiT = 0;
    const jam = T.jammed(st), oj = T.openJam(st);
    $('#money').textContent = money(st.money);
    $('#earn').textContent = '+' + money(st.earnRate);
    const left = Math.max(0, T.CFG.END - st.t);
    $('#timebar').style.width = (left / T.CFG.END * 100) + '%';
    $('#timeTxt').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    for (let i = 0; i < 4; i++) {
      const m = el.mach[i];
      const cap = i === 0 ? T.supply(st) : st.cap[i - 1];
      m.querySelector('.cap').innerHTML = i === 0 ? `공급 <b>${fmt(cap)}</b>/초` : `처리 <b>${fmt(cap)}</b>/초`;
      m.querySelector('.load i').style.width = (i === 0 ? 100 : Math.min(100, st.rateIn[i] / cap * 100)) + '%';
      m.classList.toggle('jam', jam > 0 && jam === i);
      m.classList.toggle('boost', i > 0 && st.fixed[i - 1]);
      m.querySelector('.fixb').textContent = i > 0 && st.fixed[i - 1] ? '★ 보강됨' : '';
      if (i > 0) el.slot[i].classList.toggle('on', !!oj && !st.fixed[i - 1]);
    }
    for (let i = 0; i < 3; i++) {
      const b = el.belt[i], n = st.buf[i], c = Math.min(12, Math.ceil(n / 10));
      if (c !== b.n) { b.n = c; b.cubes.innerHTML = `<i style="background:${COL[i]}"></i>`.repeat(c); }
      const full = n >= T.CFG.BUF - 0.5;
      b.root.classList.toggle('full', full);
      b.txt.innerHTML = n >= 1 ? `쌓임 <b>${Math.round(n)}</b>/${T.CFG.BUF}` : '';
      b.loss.textContent = full && jam === i + 1 && st.lostRate > 0.5 ? `놓치는 중 −${fmt(st.lostRate)}/초` : '';
    }
    const al = $('#alert');
    if (jam) {
      const n = st.buf[jam - 1], full = n >= T.CFG.BUF - 0.5;
      al.innerHTML = `⚠ ${T.reason(st)}<br>` + (full ? `<b>넘쳐서 놓치는 중 −${fmt(st.lostRate)}/초</b>` : `곧 넘쳐요 (${Math.round(n)}/${T.CFG.BUF})`);
      al.classList.remove('hide');
    } else al.classList.add('hide');
    $('#tray').classList.toggle('hide', !oj);
    if (oj && !guided) {
      guided = true;
      guideEl = document.createElement('div'); guideEl.className = 'guide';
      guideEl.textContent = '라인이 막혔어요! 보조 기계로 풀어 보세요 👇';
      $('#app').append(guideEl);
    }
    shopBtn('#bSup', 'sup'); shopBtn('#bPrice', 'price');
    if (st.ended) finish();
  }
  function shopBtn(id, k) {
    const b = $(id), c = T.cost(st, k), lv = st.lv[k];
    b.querySelector('.lv').textContent = 'Lv.' + lv;
    const d = b.querySelector('.d');
    if (k === 'sup') {
      const mile = (lv + 1) % T.CFG.MILE_N === 0;
      d.classList.toggle('mile', mile);
      d.textContent = mile ? `공급 ${fmt(T.supplyAt(lv))} → ${fmt(T.supplyAt(lv + 1))}! (×3)` : `공급 ${fmt(T.supplyAt(lv))} → ${fmt(T.supplyAt(lv + 1))}/초`;
    } else d.textContent = `개당 ${T.price(st)} → ${T.price(st) + T.CFG.PRICE_ADD}원`;
    b.querySelector('.c').textContent = money(c) + '원';
    b.disabled = !running || st.money < c;
  }

  function finish() {
    if (!running) return; running = false;
    const rows = [
      ['판 물건', Math.round(st.shipped).toLocaleString() + '개'],
      ['번 돈', money(st.money + spent()) + '원'],
      ['넘쳐서 놓친 물건', Math.round(st.lost).toLocaleString() + '개'],
      ['한꺼번에 출하한 물건', Math.round(st.bonusGot).toLocaleString() + '개'],
    ];
    let h = rows.map(([a, b]) => `<div class="r"><span>${a}</span><b>${b}</b></div>`).join('');
    h += '<h3>막힘 기록</h3>';
    h += st.jams.length ? st.jams.map((j, k) => `<div class="r"><span>${k + 1}번째 · ${T.NAMES[j.m]}</span><b>${j.fix != null ? Math.round(j.fix - j.start) + '초 만에 해결' : '못 풀었음'}${j.wrong ? ` (틀린 칸 ${j.wrong})` : ''}</b></div>`).join('')
      : '<div class="r"><span>막힘 없음</span></div>';
    $('#endStats').innerHTML = h;
    $('#end').classList.remove('hide');
  }
  // 강화에 쓴 돈 (번 돈 계산용)
  function spent() {
    let s = 0; const tmp = { lv: { sup: 0, price: 0 } };
    for (const k of ['sup', 'price']) for (let i = 0; i < st.lv[k]; i++) { tmp.lv[k] = i; s += T.cost(tmp, k); }
    return s;
  }

  // ---------- 시작·반복 ----------
  function reset() {
    st = T.create(); guided = false; if (guideEl) { guideEl.remove(); guideEl = null; }
    build(); fx().innerHTML = '';
    $('#end').classList.add('hide');
  }
  function start() { $('#start').classList.add('hide'); running = true; }
  let last = performance.now();
  function loop(now) {
    const real = Math.min(0.1, (now - last) / 1000); last = now;
    if (running) {
      let dt = real * SPEED;
      while (dt > 0) { const s = Math.min(0.05, dt); T.tick(st, s); dt -= s; }
    }
    draw(real);
    requestAnimationFrame(loop);
  }

  $('#bSup').onclick = () => { if (running && T.buy(st, 'sup')) uiT = 1; };
  $('#bPrice').onclick = () => { if (running && T.buy(st, 'price')) uiT = 1; };
  $('#bStart').onclick = start;
  $('#bAgain').onclick = () => { reset(); start(); };
  reset(); initDrag(); requestAnimationFrame(loop);

  window.__t = { st: () => st, T, place: doPlace, speed: x => (SPEED = x), start, buy: k => T.buy(st, k) };
})();
