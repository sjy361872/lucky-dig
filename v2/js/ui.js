// =====================================================
//  UI — 버튼, 팝업, 저장, 플레이 진행
// =====================================================
(function (root) {
  const C = root.CONFIG, E = root.Engine, R = root.Render, Art = root.Art, Sound = root.Sound, Rank = root.Rank;
  const $ = s => document.querySelector(s);
  const fmt = R.fmt;
  // 시험 주소(/v2/)에서는 진짜 저장 기록과 따로 (같은 사이트라 localStorage 를 같이 쓰기 때문)
  const V2TEST = /\/v2\//.test(root.location.pathname);
  const SAVE_KEY = V2TEST ? 'luckydig.v2test' : 'luckydig.v1';
  // 화면 테마 (밝은 채석장 / 밤 갱도 / 휴대폰 따라). 저장 데이터와 따로 보관
  const Theme = {
    get() { try { return localStorage.getItem('ld_theme') || 'auto'; } catch (e) { return 'auto'; } },
    set(v) { try { localStorage.setItem('ld_theme', v); } catch (e) { /* 무시 */ } this.apply(); },
    apply() { document.documentElement.dataset.theme = 'dark'; }, // 2026-11-14: 라이트 모드 제거, 밤 갱도 하나로 통일
  };
  Theme.apply();
  try { root.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => Theme.apply()); } catch (e) { /* 무시 */ }

  // ---------- 저장 ----------
  const S = { mode: 'mild', points: C.START_POINTS, bet: C.DEFAULT_BET, inventory: [], nextId: 1, settings: { bgm: 0.5, sfx: 0.8 } };
  const DEFAULTS = () => ({ mode: 'mild', points: C.START_POINTS, bet: C.DEFAULT_BET, inventory: [], nextId: 1, settings: { bgm: 0.5, sfx: 0.8 }, dex: {}, attend: { last: '', streak: 0 }, gift: { last: 0 }, owner: null, savedAt: 0 });
  // 불러온 저장 데이터를 기본 형식에 맞춰 정리 (빠진 칸·이상한 값·지금 없는 카드 제거)
  function applyState(d) {
    const base = DEFAULTS();
    const keepSettings = S.settings;
    for (const k of Object.keys(S)) delete S[k];
    Object.assign(S, base, d || {});
    S.settings = { ...base.settings, ...(keepSettings || {}), ...((d && d.settings) || {}) };
    for (const k of ['bgm', 'sfx']) if (!Number.isFinite(+S.settings[k])) S.settings[k] = base.settings[k];
    if (!C.MODES[S.mode]) S.mode = 'mild';
    if (!C.BETS.includes(S.bet)) S.bet = C.DEFAULT_BET;
    S.points = Math.max(0, Number.isFinite(+S.points) ? Math.round(+S.points) : C.START_POINTS);
    // 보관함 카드: 광산(tier) 정보가 없으면 판 포인트로 계산, 지금 없는 카드는 제거
    S.inventory = (Array.isArray(S.inventory) ? S.inventory : []).map(x => x && (x.grade === 'P' ? { ...x, tier: 'P', idx: 0 } : { ...x, tier: x.grade === 'G' ? 'G' : (C.TIERS[x.tier] ? String(x.tier) : C.tierOf(+x.bet || C.DEFAULT_BET)), idx: x.idx | 0 }))
      .filter(x => x && (x.grade === 'P' ? true : x.grade === 'G' ? C.G_CARDS[x.idx] : (C.TIERS[x.tier] && (C.TIERS[x.tier].cards[x.grade] || [])[x.idx])))
      .map(x => ({ ...x, value: Math.max(0, Math.round(+x.value || 0)), name: x.grade === 'P' ? String(x.name || '포인트 카드').slice(0, 20) : String((x.grade === 'G' ? C.G_CARDS[x.idx] : C.TIERS[x.tier].cards[x.grade][x.idx]).name).slice(0, 20) })); // 이름은 항상 지금 카드 목록 기준 (그림과 일치)
    S.nextId = Math.max(+S.nextId || 1, ...S.inventory.map(x => (+x.id || 0) + 1), 1);
    // 도감: 형식이 맞는 기록만 남기고, 보관함에 있는 카드는 도감에도 등록
    const valid = new Set(C.allCards().map(C.cardKey)), dex = {};
    for (const [k, v] of Object.entries(S.dex && typeof S.dex === 'object' ? S.dex : {})) if (valid.has(k)) dex[k] = { n: Math.max(1, +v.n | 0), at: +v.at || Date.now() };
    for (const x of S.inventory) { const k = C.cardKey(x); if (valid.has(k) && !dex[k]) dex[k] = { n: 1, at: Date.now() }; }
    S.dex = dex;
    if (!S.attend || typeof S.attend !== 'object') S.attend = { last: '', streak: 0 };
    S.attend = { last: String(S.attend.last || '').slice(0, 10), streak: Math.max(0, +S.attend.streak | 0) };
    Sound.setVolume('bgm', S.settings.bgm); Sound.setVolume('sfx', S.settings.sfx);
  }
  function load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { /* 저장 불가 환경 */ }
    applyState(d);
  }
  function save() { if (Rank.me) Rank.me.stats.collection = Object.keys(S.dex || {}); // 랭킹 도감 수 = 내 도감
    S.savedAt = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 무시 */ } Rank.sync(S); }
  function refreshAll() { showPoints(); showBet(); showMode(); R.setBet(S.bet); showWho(); showAdmin(); }
  function showAdmin() { document.body.classList.toggle('admin', Rank.isAdmin()); }
  // 로그인 결과를 지갑·보관함에 반영
  //  - 서버에 이 계정 기록이 있으면: 이 기기 기록이 같은 계정이고 더 최신이면 그대로, 아니면 서버 기록으로
  //  - 서버 기록이 없는 새 계정: 처음 로그인이면 지금 기기 기록을 가져가고, 다른 계정에서 바꾼 거면 새로 시작
  function applyLogin(r) {
    const nick = Rank.me.nickname;
    if (r.state) {
      const localNewer = S.owner === nick && (S.savedAt || 0) > (r.state.savedAt || 0);
      if (!localNewer) applyState(r.state);
    } else {
      // 새 계정: 이 기기에 남아 있던 기록과 상관없이 시작 포인트로 새로 시작 (소리 설정·모드만 유지)
      applyState({ settings: S.settings, mode: S.mode });
      if (r.created !== false) setTimeout(() => news(`가입 축하! ${fmt(C.START_POINTS)}pt를 드렸어요`, 'gift'), 600);
    }
    S.owner = nick;
    save(); refreshAll();
    setTimeout(checkGrants, 500);
  }

  let busy = false, loginSeq = 0;

  // ---------- 화면 맞추기 ----------
  function fit() {
    const app = $('#app');
    const s = Math.min(window.innerWidth / 440, window.innerHeight / 860, 1.4);
    app.style.transform = `scale(${s})`;
    $('#viewport').style.height = Math.ceil(860 * s) + 'px';
  }

  // ---------- 표시 ----------
  function showPoints() { $('#pointsText').textContent = fmt(S.points) + ' pt'; }
  // 코인이 화면 가운데에서 위쪽 잔고로 촤르륵 날아가고, 잔고 숫자가 올라감 (끝나면 정확한 값으로)
  function flyCoins(amount) {
    return new Promise(res => {
      const pt = $('#pointsText'), r = pt.getBoundingClientRect();
      const from = S.points - amount, n = Math.min(14, 5 + Math.floor(Math.log10(Math.max(10, amount)) * 2));
      for (let k = 0; k < n; k++) {
        const c = document.createElement('i');
        c.className = 'fly-coin';
        c.style.left = (window.innerWidth / 2 + (Math.random() - 0.5) * 80) + 'px';
        c.style.top = (window.innerHeight * 0.55 + (Math.random() - 0.5) * 60) + 'px';
        c.style.setProperty('--tx', (r.left + r.width / 2) + 'px'); c.style.setProperty('--ty', (r.top + r.height / 2) + 'px');
        c.style.animationDelay = (k * 0.04) + 's';
        document.body.appendChild(c);
        setTimeout(() => { c.remove(); if (k % 3 === 0) Sound.play('tick'); }, 650 + k * 40);
      }
      const t0 = performance.now(), dur = 700;
      const step = () => {
        const p = Math.min(1, (performance.now() - t0 - 250) / dur);
        pt.textContent = fmt(from + amount * Math.max(0, p)) + ' pt';
        if (p < 1) setTimeout(step, 30); else { showPoints(); pt.parentElement.classList.remove('bump'); void pt.offsetWidth; pt.parentElement.classList.add('bump'); res(); }
      };
      step();
    });
  }
  function showBet() {
    $('#betText').textContent = fmt(S.bet) + ' pt';
    $('#btnPlay').classList.toggle('disabled', S.points < S.bet);
  }
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 1800);
  }

  // ---------- 팝업 ----------
  function modal(html, opts = {}) {
    const ov = $('#overlay');
    ov.hidden = false;
    ov.innerHTML = `<div class="modal ${opts.cls || ''}">${opts.title ? `<h2>${opts.title}</h2><div class="divider"><span></span></div>` : ''}<div class="mbody">${html}</div>${opts.noClose ? '' : '<button class="closebtn">닫기</button>'}</div>`;
    const close = () => { ov.hidden = true; ov.innerHTML = ''; opts.onClose && opts.onClose(); };
    const cb = ov.querySelector('.closebtn');
    if (cb) cb.onclick = () => { Sound.play('click'); close(); };
    ov.onclick = e => { if (e.target === ov && !opts.noClose) close(); };
    return { el: ov.querySelector('.modal'), close };
  }
  function tabs(container, names, render) {
    container.innerHTML = `<div class="tabs">${names.map((n, i) => `<button data-i="${i}">${n}</button>`).join('')}</div><div class="tabbody"></div>`;
    const btns = container.querySelectorAll('.tabs button');
    const show = i => { btns.forEach(b => b.classList.toggle('on', +b.dataset.i === i)); container.querySelector('.tabbody').innerHTML = render(i); container.querySelector('.tabbody').scrollTop = 0; };
    btns.forEach(b => b.onclick = () => { Sound.play('click'); show(+b.dataset.i); });
    show(0);
    return show;
  }

  function openCharge() {
    const m = modal(`<p class="muted">테스트용 무료 충전입니다.</p><div class="chargegrid">${C.CHARGE_AMOUNTS.map(a => `<button data-a="${a}">+${fmt(a)} pt</button>`).join('')}</div>`, { title: '포인트 충전' });
    m.el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      S.points += +b.dataset.a; Rank.noteCharge(+b.dataset.a); save(); showPoints(); showBet(); Sound.play('coin'); toast(`${fmt(+b.dataset.a)} pt 충전했습니다`);
    });
  }

  // 메뉴용 단색 선 아이콘 (이모지 대신, 글자색을 따라감)
  const ICO = {
    sound: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    reset: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/>',
    gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13"/><path d="M12 8C10 4 6 4 7 7s5 1 5 1 4 2 5-1-3-3-5 1z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
  };
  const ico = k => `<svg class="mico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;
  function openMenu() {
    const m = modal(`
      <label class="slider"><span>${ico('music')}BGM</span><input type="range" min="0" max="1" step="0.05" id="volBgm" value="${S.settings.bgm}"></label>
      <label class="slider"><span>${ico('sound')}효과음</span><input type="range" min="0" max="1" step="0.05" id="volSfx" value="${S.settings.sfx}"></label>
      ${Rank.isAdmin() ? `<button class="rowbtn gold" id="btnGrant">${ico('gift')}포인트 지급 (관리자)</button>` : ''}
      <div class="themepick"><span>${ico('star')}화면 스타일</span><div class="seg">${[['basic', '기본'], ['pixel', '도트']].map(([k, t]) => `<button data-ui="${k}" class="${(document.documentElement.dataset.ui || 'pixel') === k ? 'on' : ''}">${t}</button>`).join('')}</div></div>
      <button class="rowbtn" id="btnHelp2">${ico('book')}하는 법</button>
      <button class="rowbtn" id="btnDaily">${ico('calendar')}출석 체크</button>
      <button class="rowbtn" id="btnTitle">${ico('home')}타이틀로 (모드 변경: 지금 ${C.MODES[S.mode].name})</button>
      <button class="rowbtn" id="btnReset">${ico('reset')}기록 초기화 (${fmt(C.START_POINTS)}pt로 새로 시작)</button>`, { title: '설정', cls: 'small' });
    m.el.querySelector('#volBgm').oninput = e => { S.settings.bgm = +e.target.value; Sound.setVolume('bgm', S.settings.bgm); save(); };
    m.el.querySelector('#volSfx').oninput = e => { S.settings.sfx = +e.target.value; Sound.setVolume('sfx', S.settings.sfx); save(); };
    m.el.querySelector('#btnDaily').onclick = () => { m.close(); openDaily(true); };
    m.el.querySelectorAll('.seg [data-ui]').forEach(bt => { bt.onclick = () => { try { localStorage.setItem('ld_ui', bt.dataset.ui); } catch (e) { /* 무시 */ } document.documentElement.dataset.ui = bt.dataset.ui; m.el.querySelectorAll('.seg [data-ui]').forEach(x => x.classList.toggle('on', x === bt)); }; });
    m.el.querySelector('#btnHelp2').onclick = () => { m.close(); openHelp(); };
    const gb = m.el.querySelector('#btnGrant'); if (gb) gb.onclick = () => { m.close(); openGrant(); };
    m.el.querySelector('#btnTitle').onclick = () => { if (busy) { toast('플레이 중에는 이동할 수 없습니다'); return; } m.close(); showTitle(); };
    m.el.querySelector('#btnReset').onclick = () => {
      if (busy) { toast('플레이 중에는 초기화할 수 없습니다'); return; }
      if (!confirm('포인트와 보관함을 초기화할까요?')) return;
      S.points = C.START_POINTS; S.inventory = []; save(); showPoints(); showBet(); m.close(); toast('초기화했습니다');
    };
  }

  function openHelp() {
    const m = modal('<div id="helpTabs"></div>', { title: '하는 법', cls: 'tall' });
    const ic = (svg, label, sub) => `<div class="icbox"><div class="ic">${svg}</div><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    tabs(m.el.querySelector('#helpTabs'), ['게임 흐름', '아이템', '블록·보물상자', '조작'], i => {
      if (i === 0) return `<ol class="steps">
        <li><b>판 포인트 선택</b>−/+로 판 포인트를 정하고 “채굴”을 누르는 순간 결과가 정해집니다.</li>
        <li><b>곡괭이로 채굴</b>탐지기에 나온 곡괭이가 같은 열의 블록을 위에서부터 깹니다. 깬 블록에 따라 점수가 오릅니다.</li>
        <li><b>탐지 횟수</b>처음 나온 한 번 더 코인 수가 탐지 횟수가 됩니다. 도중에 코인이 나오면 1개당 1번 늘어납니다.</li>
        <li><b>등급 결정</b>점수가 게이지의 기준선을 넘을 때마다 등급이 올라갑니다. 마지막 등급의 카드 중 하나를 받습니다.</li>
        <li><b>카드 받기</b>받은 카드는 보관하거나 포인트로 바꿀 수 있습니다.</li></ol>
        <p class="note">결과는 플레이 시작 시 정해집니다. 고속 모드로 넘겨도 결과는 바뀌지 않습니다.</p>`;
      if (i === 1) return `<h4>곡괭이</h4><p>정해진 횟수만큼 같은 열의 블록을 위에서부터 때립니다. 남은 횟수로 아래 블록까지 계속 깹니다.</p>
        <div class="icrow">${Object.entries(C.PICKS).map(([k, p]) => ic(Art.item(k), p.name.replace(' 곡괭이', ''), p.power + '회')).join('')}</div>
        <div class="itemrow">${ic(Art.item('spin'), '한 번 더 코인')}<p>나오면 1개당 남은 탐지 +1</p></div>
        <div class="itemrow">${ic(Art.item('book'), '강화의 책')}<p>같은 열의 곡괭이를 모두 다이아(5회)로 강화</p></div>
        <div class="itemrow">${ic(Art.item('superbook'), '초강화의 책')}<p>같은 열의 곡괭이를 모두 흑요석(7회)으로 강화</p></div>
        <div class="itemrow">${ic(Art.item('tnt'), 'TNT')}<p>떨어진 블록과 주위 8칸에 ${C.EXPLOSION_DAMAGE} 대미지</p></div>`;
      if (i === 2) return `<h4>블록과 점수</h4><table class="tbl"><tr><th>블록</th><th>점수 배율</th><th>내구도</th></tr>
        ${Object.entries(C.BLOCKS).map(([k, b]) => `<tr><td><span class="mini">${Art.block(k)}</span>${b.name}</td><td>${b.mult === null ? '깨면 공개' : b.mult === 0 ? '—' : '×' + b.mult}</td><td>${b.hp}회</td></tr>`).join('')}</table>
        <p>블록을 깨면 <b>배율 × 판 포인트</b>가 점수에 더해집니다. 폭발 광석은 깨지면 주위 8칸에 ${C.EXPLOSION_DAMAGE} 대미지를 줍니다.</p>
        <h4>보물상자</h4><p>한 열을 맨 아래까지 다 파면 그 열의 보물상자가 열립니다. 그때까지의 점수에 2~10배가 곱해지고, 이후 깨는 모든 블록에도 그 배율이 붙습니다. 상자가 여러 개 열리면 배율끼리 곱해집니다.</p>
        <p>상자 색은 최소 배율을 나타냅니다. 실제 배율은 열어야 알 수 있습니다.</p>
        <div class="icrow wrap">${C.CHESTS.map(ch => ic(Art.chest(ch, false), ch.min === 10 ? '10배 확정' : ch.min + '배 이상')).join('')}</div>`;
      return `<div class="steps2">
        <p><b>포인트가 부족하면</b> 관리자에게 요청 (관리자가 보내 주면 자동으로 들어와요)</p>
        <p><b>판 포인트 −/+</b> 판 포인트 변경 (숫자를 누르면 목록)</p>
        <p><b>채굴</b> 포인트를 쓰고 탐지 시작</p>
        <p><b>보상표</b> 판 포인트별 등급 기준·확률·카드 목록</p>
        <p><b>보관함</b> 받은 카드 확인 / 포인트 교환</p>
        <p><b>고속 버튼</b> 연출을 3배 빠르게 (결과는 그대로)</p>
        <p><b>종료 연출 중 화면 탭</b> 건너뛰기</p></div>`;
    });
  }

  function openPrizes() {
    const m = modal('<div id="prizeTabs"></div>', { title: '보상표', cls: 'tall' });
    const box = m.el.querySelector('#prizeTabs');
    tabs(box, C.BETS.map(b => fmt(b)), i => {
      const bet = C.BETS[i];
      return `<p class="muted center"><b class="modetag ${S.mode}">${C.MODES[S.mode].name}</b> <b>${C.tierName(bet)}</b> · 판 포인트 ${fmt(bet)}pt 기준</p><div class="plist">${C.GRADES.map(g => `
        <details class="prow"><summary><span class="chip" style="background:${g.color}">${g.name}</span>
          <span class="need">점수 <b>${fmt(g.need * bet)}</b> 이상</span><span class="rate">확률 <b>${E.rateOf(g, S.mode).toFixed(1)}%</b></span></summary>
          <div class="pcards">${C.cardsFor(bet, g.id).map((c, idx) => `<div class="pcard" data-g="${g.id}" data-i="${idx}" data-b="${bet}">${Art.card({ ...c, grade: g.id, idx, tier: g.id === 'G' ? 'G' : C.tierOf(bet) })}<small>${c.name}<br>환원 <b>${fmt(E.cardValue(g, c, bet, S.mode))}</b>pt<br>등급 내 ${(c.w / C.cardsFor(bet, g.id).reduce((a, x) => a + x.w, 0) * 100).toFixed(0)}%</small></div>`).join('')}</div>
        </details>`).join('')}</div>`;
    });
    box.addEventListener('click', e => {
      const pc = e.target.closest('.pcard');
      if (!pc) return;
      const bet = +pc.dataset.b, c = { ...C.cardsFor(bet, pc.dataset.g)[+pc.dataset.i], tier: pc.dataset.g === 'G' ? 'G' : C.tierOf(bet) };
      zoomCard({ ...c, grade: pc.dataset.g, idx: +pc.dataset.i });
    });
  }
  function zoomCard(c) {
    const z = document.createElement('div');
    z.className = 'zoom';
    z.innerHTML = `${Art.card(c, { cls: 'big' })}<b>${c.name}</b><button class="closebtn">닫기</button>`;
    document.body.appendChild(z);
    z.onclick = () => z.remove();
  }

  // ---------- 보관함 + 도감 ----------
  function openBag(startTab = 0) {
    const m = modal('<div id="bagTabs"></div>', { title: '보관함', cls: 'tall' });
    const box = m.el.querySelector('#bagTabs');
    let dexTier = null;
    const bagHtml = () => {
      const inv = S.inventory;
      const total = inv.reduce((a, x) => a + x.value, 0);
      return inv.length === 0 ? '<p class="muted center">보관한 카드가 없습니다.</p>' :
        `<p class="muted center">${inv.length}장 · 전부 교환 시 ${fmt(total)}pt</p>
        <div class="bag">${inv.slice().reverse().map(x => `<div class="bagitem" data-item="${x.id}">${Art.card(x)}<small>${esc(x.name)}<br>${fmt(x.value)}pt</small><button data-id="${x.id}">교환</button></div>`).join('')}</div>
        <button class="rowbtn" id="sellAll">전부 포인트로 바꾸기</button>`;
    };
    const dexHtml = () => {
      const all = C.allCards();
      const tiers = Object.keys(C.TIERS).sort((a, b) => a - b).concat(['G']);
      if (!dexTier || !tiers.includes(dexTier)) dexTier = C.tierOf(S.bet);
      const owned = c => S.dex[C.cardKey(c)];
      const have = all.filter(owned).length;
      const tierCards = t => all.filter(c => c.tier === t);
      const tierLabel = t => (t === 'G' ? '공통 G' : C.TIERS[t].name);
      const list = tierCards(dexTier), got = list.filter(owned).length;
      const pct = n => Math.floor(n * 100);
      return `<div class="dex-total"><b>${have}</b> / ${all.length}장 <small>(${pct(have / all.length)}%)</small><div class="bar"><i style="width:${have / all.length * 100}%"></i></div></div>
        <div class="dex-tiers">${tiers.map(t => { const tc = tierCards(t), g = tc.filter(owned).length;
          return `<button data-tier="${t}" class="${t === dexTier ? 'on' : ''} ${g === tc.length ? 'done' : ''}">${t === 'G' ? '공통' : fmt(+t)}<small>${g}/${tc.length}</small></button>`; }).join('')}</div>
        <h4 class="dex-title">${esc(tierLabel(dexTier))} ${got === list.length ? `<span class="dex-done">${ico('trophy')}완성!</span>` : `<small>${got}/${list.length}</small>`}</h4>
        ${(dexTier === 'G' ? ['G'] : 'SABCDEF'.split('')).map(g => {
          const cs = list.filter(c => c.grade === g); if (!cs.length) return '';
          const col = C.GRADES.find(x => x.id === g).color;
          return `<div class="dex-row"><span class="chip" style="background:${col}">${C.gname(g)}</span><div class="dex-grid">${cs.map(c => {
            const o = owned(c);
            return o ? `<div class="dexcard" data-key="${C.cardKey(c)}">${Art.card(c)}<small>${esc(c.name)}<br>×${o.n}</small></div>`
                     : `<div class="dexcard none"><div class="card-back" style="--gc:${col}"><b>?</b><span>${g}</span></div><small>???</small></div>`;
          }).join('')}</div></div>`; }).join('')}`;
    };
    const show = tabs(box, ['보관함', '도감'], i => (i === 0 ? bagHtml() : dexHtml()));
    let cur = 0;
    box.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => { cur = +b.dataset.i; }));
    const rerender = () => show(cur);
    if (startTab) { cur = startTab; show(startTab); }
    box.addEventListener('click', e => {
      const t = e.target.closest('[data-tier]');
      if (t) { dexTier = t.dataset.tier; Sound.play('click'); rerender(); return; }
      const dc = e.target.closest('.dexcard[data-key]');
      if (dc) { const c = C.allCards().find(x => C.cardKey(x) === dc.dataset.key); if (c) zoomCard(c); return; }
      const b = e.target.closest('[data-id]');
      if (b) {
        const i = S.inventory.findIndex(x => x.id === +b.dataset.id);
        if (i >= 0) { S.points += S.inventory[i].value; toast(`${fmt(S.inventory[i].value)} pt 환원했습니다`); S.inventory.splice(i, 1); }
      } else if (e.target.id === 'sellAll') {
        const t2 = S.inventory.reduce((a, x) => a + x.value, 0);
        if (!confirm(`${S.inventory.length}장을 ${fmt(t2)}pt로 교환할까요?`)) return;
        S.points += t2; S.inventory = []; toast(`${fmt(t2)} pt 환원했습니다`);
      } else {
        const bi = e.target.closest('.bagitem .card');
        if (bi) { const x = S.inventory.find(v => v.id === +bi.closest('.bagitem').dataset.item); if (x && x.grade !== 'P') zoomCard(x); }
        return;
      }
      Sound.play('coin'); save(); showPoints(); showBet(); rerender();
    });
  }
  // 도감 기록: 처음 얻은 카드면 true
  function recordDex(card) {
    const key = C.cardKey(card), d = S.dex[key];
    S.dex[key] = { n: (d ? d.n : 0) + 1, at: d ? d.at : Date.now() };
    return !d;
  }

  function openBetList() {
    const m = modal(`<div class="betlist">${C.BETS.map(b => `<button data-b="${b}" class="${b === S.bet ? 'on' : ''} ${b > S.points ? 'disabled' : ''}">${fmt(b)} pt</button>`).join('')}</div>`, { title: '판 포인트', cls: 'small' });
    m.el.querySelectorAll('[data-b]').forEach(btn => btn.onclick = () => { S.bet = +btn.dataset.b; save(); showBet(); R.setBet(S.bet); m.close(); });
  }
  function stepBet(d) {
    const i = C.BETS.indexOf(S.bet);
    const n = Math.max(0, Math.min(C.BETS.length - 1, (i < 0 ? 0 : i) + d));
    S.bet = C.BETS[n]; save(); showBet(); R.setBet(S.bet); Sound.play('click');
  }

  // ---------- 플레이 ----------
  async function play() {
    if (busy) return;
    if (S.points < S.bet) { if (Rank.isAdmin()) { toast('포인트가 부족합니다'); openCharge(); } else toast('포인트가 부족합니다. 관리자에게 요청하세요'); return; }
    busy = true;
    try {
      Sound.unlock();
      Sound.play('click');
      const round = E.playRound(S.bet, undefined, S.mode);
      // 결과는 이 순간 확정 → 포인트 차감 + 카드 보관함에 먼저 넣어 둠 (창을 닫아도 보관 처리)
      S.points -= S.bet;
      const item = { id: S.nextId++, name: round.card.name, elem: round.card.elem, idx: round.card.idx, tier: round.card.tier, grade: round.grade, value: round.payout, bet: S.bet };
      S.inventory.push(item);
      const newDex = recordDex(round.card);
      const rec = Rank.recordPlay({ mode: S.mode, bet: S.bet, grade: round.grade, cardIdx: round.card.idx, key: C.cardKey(round.card), card: round.card.name, value: round.payout });
      save(); showPoints();

      $('#app').classList.add('playing');
      $('#panelIdle').hidden = true; $('#panelPlay').hidden = false;
      $('#playBet').textContent = fmt(S.bet) + ' pt';
      R.setBet(S.bet);
      R.drawBoard(round.sim.board, round.sim.chests);
      R.clearSlot();
      R.state.skipping = false;
      await R.replay(round.sim);
      await finale(round, item);
      R.setLastGrade(round.grade);
      if (rec.newBest) setTimeout(() => news(`최고 배율 갱신! ×${(round.payout / round.sim.bet).toFixed(2)}`, 'trophy'), 300);
      else if (newDex) setTimeout(() => news(`도감 등록: ${round.card.name}`, 'book'), 300);
    } catch (e) {
      // 연출 중 오류가 나도 결과(포인트·카드)는 이미 저장돼 있으므로 화면만 원래대로
      console.error(e);
      $('#overlay').hidden = true;
      toast('오류가 발생했습니다. 받은 카드는 보관함에 있습니다');
    } finally {
      R.state.skipping = false;
      $('#app').classList.remove('playing');
      R.setGauge(0);
      $('#panelIdle').hidden = false; $('#panelPlay').hidden = true;
      showPoints(); showBet();
      busy = false;
      updateHeaderGoals();
    }
  }

  async function finale(round, item) {
    const g = C.GRADES[round.gradeIndex], score = round.sim.score, bet = round.sim.bet;
    const ov = $('#overlay');
    ov.hidden = false;
    ov.onclick = () => { R.state.skipping = true; };
    const w = ms => R.wait(ms);

    const next = round.gradeIndex > 0 ? C.GRADES[round.gradeIndex - 1] : null;
    // 0) 아깝다! (다음 등급까지 칸의 30% 이내로 남았을 때만): 지금 등급·다음 등급 LED 블록 두 개를 크게
    if (next) {
      const lo = g.need * bet, hi = next.need * bet, short = Math.ceil(hi - score);
      const ratio = (score - lo) / (hi - lo);
      if (ratio >= 0.7 && short > 0) {
        ov.innerHTML = `<div class="fin fin2 nm">
          <div class="nm-tower">
            <div class="nm-led next" style="--gc:${next.color}"><b>${next.name}</b><small>${fmt(hi)}</small></div>
            <div class="nm-led cur" style="--gc:${g.color}"><i class="nm-fill"></i><b>${g.name}</b><small>${fmt(lo)}</small></div>
          </div>
          <div class="nm-short">−${fmt(short)}점</div>
          <div class="nm-msg">아깝다! ${next.name} 등급까지 ${fmt(short)}점</div>
          <div class="tapskip">탭해서 건너뛰기</div></div>`;
        const fillEl = ov.querySelector('.nm-fill');
        await w(250);
        fillEl.style.height = (Math.min(0.985, ratio) * 100).toFixed(1) + '%';   // 차오르다가 바로 앞에서 멈칫
        Sound.play('drumroll');
        await w(1250);
        ov.querySelector('.nm').classList.add('show');
        Sound.play('last');
        await w(1300);
      }
    }

    // 1) 랜턴 감정 + 등급 엠블럼 (2026-11-14). 등급이 높을수록 연출이 세짐
    //    단계: 0 = G·F (먼지, 짧게) / 1 = E·D (코인) / 2 = C·B (보석 비 + 빛줄기 + 흔들림) / 3 = A·S (번쩍 + 불꽃 + 띠)
    const tier = { G: 0, F: 0, E: 1, D: 1, C: 2, B: 2, A: 3, S: 3 }[g.id] || 0;
    const BANNER = { S: 'LEGEND!', A: 'AMAZING!', B: 'GREAT!', C: 'NICE!' };
    ov.innerHTML = `<div class="fin fin2 ft${tier}" style="--gc:${g.color}">
      ${tier >= 2 ? '<div class="f2-rays"></div>' : ''}
      <img class="f2-lantern" src="assets/v2/lantern.png" alt="">
      <div class="f2-emb"><img src="assets/v2/emblems/${g.id}.webp" alt=""><b>${g.name}</b></div>
      ${BANNER[g.id] ? `<div class="f2-banner">${BANNER[g.id]}</div>` : ''}
      <div class="f2-title">${g.name} 등급</div>
      <div class="f2-score">점수 <b>${fmt(score)}</b></div>
      ${next ? `<div class="f2-next">${next.name} 등급까지 ${fmt(next.need * bet - score)}점 모자랐어요</div>` : '<div class="f2-next top">최고 등급!</div>'}
      <div class="tapskip">탭해서 건너뛰기</div></div>`;
    const finEl = ov.querySelector('.fin2');
    if (tier >= 3) { const fl = document.createElement('div'); fl.className = 'f2-flash'; finEl.appendChild(fl); }
    Sound.play(tier >= 2 ? 'fanfare' : tier === 1 ? 'chest' : 'stop');
    // 파편: 0 먼지 · 1 코인 · 2 등급 색 보석 · 3 보석 + 금 불꽃 여러 번
    const burstFx = (n, kind) => {
      for (let k = 0; k < n; k++) {
        const p = document.createElement('i');
        p.className = 'f2-p ' + kind;
        const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 150;
        p.style.setProperty('--dx', Math.cos(a) * d + 'px'); p.style.setProperty('--dy', Math.sin(a) * d - 40 + 'px');
        p.style.animationDelay = (Math.random() * 0.15) + 's';
        finEl.appendChild(p);
        setTimeout(() => p.remove(), 1400);
      }
    };
    await w(350);
    burstFx([10, 16, 22, 30][tier], ['dust', 'coin', 'gem', 'gem'][tier]);
    if (tier >= 2) finEl.classList.add('shake');
    if (tier >= 3) { await w(350); burstFx(24, 'coin'); await w(300); burstFx(24, 'gem'); }
    await w([750, 1050, 1350, 1300][tier]);

    // 2) 원석 깨기: 등급에 맞는 원석이 세 번 맞아 금이 가다가 터지고, 안에서 카드가 나옴 (룰렛 대신)
    const ORE = { S: 'obsidian', A: 'diamond', B: 'ruby', C: 'gold', D: 'stone', E: 'stone', F: 'dirt', G: 'grass' };
    const ore = ORE[g.id] || 'stone';
    ov.innerHTML = `<div class="fin fin2" style="--gc:${g.color}">
      <div class="f2-title small">원석을 깨는 중…</div>
      <div class="f2-ore"><img src="${Art.blockSrc(ore, 0)}" alt=""></div>
      <div class="f2-card" hidden>${Art.card({ ...round.card, grade: g.id }, { cls: 'big' })}</div>
      <div class="tapskip">탭해서 건너뛰기</div></div>`;
    const oreBox = ov.querySelector('.f2-ore'), oreImg = oreBox.querySelector('img');
    const hitOre = (cls) => { oreBox.classList.remove('h1', 'h2'); void oreBox.offsetWidth; oreBox.classList.add(cls); };
    await w(450);
    for (let k = 1; k <= 3; k++) {
      oreImg.src = Art.blockSrc(ore, k / 3);
      hitOre(k % 2 ? 'h1' : 'h2');
      Sound.play('hit', { type: ore, ratio: k / 3 });
      await w(k < 3 ? 520 : 650);
    }
    Sound.play('break', { type: ore });
    oreBox.classList.add('burst');
    const fl = document.createElement('div'); fl.className = 'f2-flash'; ov.querySelector('.fin2').appendChild(fl);
    await w(260);
    oreBox.hidden = true;
    ov.querySelector('.f2-title').textContent = `${round.card.name}`;
    ov.querySelector('.f2-title').classList.remove('small');
    ov.querySelector('.f2-card').hidden = false;
    Sound.play('big');
    await w(1100);

    // 4) 결과 팝업
    ov.onclick = null;
    await new Promise(res => {
      const m = modal(`<div class="result"><div class="r-emb"><img src="assets/v2/emblems/${g.id}.webp" alt=""><b>${g.name}</b></div>
        ${Art.card(item, { cls: 'big' })}<b class="rname">${item.name}</b>
        <div class="rrow"><span>포인트 교환 시</span><b>${fmt(item.value)} pt</b></div>
        <div class="rbtns"><button id="keep">보관함에 두기</button><button id="sell" class="red">포인트로 바꾸기</button></div></div>`, { title: `${g.name} 등급 획득`, noClose: true });
      m.el.querySelector('#keep').onclick = () => { Sound.play('click'); m.close(); toast('보관함에 넣었습니다'); res(); };
      m.el.querySelector('#sell').onclick = () => {
        Sound.play('click');
        const after = S.points + item.value;
        const c = modal(`<p>받은 카드를 포인트로 바꿉니다.</p><div class="cmp">${fmt(S.points)}pt → <b>${fmt(after)}pt</b></div>
          <div class="rbtns"><button id="cancel">취소</button><button id="ok" class="red">확정</button></div>`, { title: '포인트 교환', noClose: true, cls: 'small' });
        c.el.querySelector('#cancel').onclick = () => { c.close(); toast('보관함에 넣었습니다'); res(); };
        c.el.querySelector('#ok').onclick = () => {
          const i = S.inventory.findIndex(x => x.id === item.id);
          if (i >= 0) { S.inventory.splice(i, 1); S.points += item.value; }
          save(); Sound.play('coin'); c.close();
          flyCoins(item.value).then(() => { toast(`${fmt(item.value)} pt 환원했습니다`); res(); });
        };
      };
    });
  }

  // ---------- 랭킹 ----------
  function news(msg, icon) { // 화면 위쪽에 잠깐 뜨는 소식 띠 (icon: ICO 이름, 단색 선 아이콘)
    const n = document.createElement('div');
    n.className = 'news-item'; n.innerHTML = (icon ? ico(icon) : '') + `<span>${esc(msg)}</span>`;
    $('#news').appendChild(n);
    setTimeout(() => n.classList.add('out'), 3200);
    setTimeout(() => n.remove(), 3700);
  }
  function openRanking(startTab = 0) {
    const m = modal('<div id="rankTabs"></div>', { title: '랭킹', cls: 'tall' });
    const box = m.el.querySelector('#rankTabs');
    const names = Rank.BOARDS.map(b => b.name).concat(['소식']);
    const body = () => box.querySelector('.tabbody');
    const note = Rank.store.online ? '' : '<p class="note center">오프라인 모드: 이 기기 기록만 보여요. 온라인 연결 후 둘이 같이 보입니다.</p>';
    let seq = 0;
    const render = async i => {
      const my = ++seq;
      const el = body();
      if (i < Rank.BOARDS.length) {
        const rows = await Rank.board(Rank.BOARDS[i].id);
        if (my !== seq) return;
        const medal = k => (k < 3 ? `<i class="medal m${k + 1}">${k + 1}</i>` : (k + 1));
        const isMe = r => Rank.me && r.nickname === Rank.me.nickname;
        const rowHtml = (r, rk, extra = '') => `<div class="rrow2 ${isMe(r) ? 'me' : ''}">
            <span class="rk">${rk}</span><span class="rn">${esc(r.nickname)}</span><span class="rs"><b>${esc(r.show)}</b><small>${extra}${esc(r.sub)}</small></span></div>`;
        // 수익 랭킹: 플러스인 사람만 순위에. 0 이하인 사람은 숫자를 숨기고 '도전 중 N명'으로 묶음 (내 기록은 나에게만 보임)
        const pos = Rank.BOARDS[i].posOnly ? rows.filter(r => r.score > 0) : rows;
        const rest = Rank.BOARDS[i].posOnly ? rows.filter(r => !(r.score > 0)) : [];
        const meRest = rest.find(isMe);
        el.innerHTML = note + (Rank.BOARDS[i].desc ? `<p class="muted center">${Rank.BOARDS[i].desc}</p>` : '') +
          `<div class="rlist">${pos.map((r, k) => rowHtml(r, medal(k))).join('') || (rest.length ? '<p class="muted center">아직 플러스인 사람이 없어요. 첫 1등의 기회!</p>' : '<p class="muted center">기록이 없습니다</p>')}
          ${rest.length ? `<div class="rest-note">도전 중 <b>${rest.length}명</b> · 플러스가 되면 순위에 올라요</div>` : ''}
          ${meRest ? rowHtml(meRest, '—', '<i class="only-me">나만 보여요</i> ') : ''}</div>`;
      } else {
        const feed = await Rank.feed();
        if (my !== seq) return;
        el.innerHTML = note + `<div class="rlist">${feed.map(f => `<div class="frow"><span class="chip" style="background:${(C.GRADES.find(g => g.id === f.grade) || {}).color}">${esc(C.gname(f.grade))}</span>
          <span><b>${esc(f.nickname)}</b> · ${esc(f.mode.toUpperCase())} · ${esc(f.card)}<br><small>${fmt(f.bet)}pt → ${fmt(f.value)}pt · ${timeAgo(f.at)}</small></span></div>`).join('') || '<p class="muted center">아직 소식이 없습니다 (S·A 등급, 최고 배율 갱신 시 기록)</p>'}</div>`;
      }
    };
    const showTab = tabs(box, names, i => { setTimeout(() => render(i).catch(e => { body().innerHTML = `<p class="note center">불러오기 실패: ${esc(e.message)}</p>`; }), 0); return '<p class="muted center">불러오는 중…</p>'; });
    if (startTab) showTab(startTab);
  }
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function timeAgo(at) {
    const s = (Date.now() - new Date(at).getTime()) / 1000;
    return s < 60 ? '방금' : s < 3600 ? Math.floor(s / 60) + '분 전' : s < 86400 ? Math.floor(s / 3600) + '시간 전' : Math.floor(s / 86400) + '일 전';
  }
  // 닉네임 입력 (온라인이면 PIN 4자리도) → 서버/기기 기록 불러오기
  function askLogin() {
    return new Promise(resolve => {
      const prof = Rank.profile() || {};
      const m = modal(`<p class="muted">랭킹에 표시될 이름이에요.${Rank.store.online ? '<br>PC·모바일에서 같은 닉네임+PIN으로 들어오면 기록이 이어져요.' : ''}</p>
        <input id="inNick" class="inp" maxlength="10" placeholder="닉네임 (최대 10자)" value="${esc(prof.nickname || '')}">
        ${Rank.store.online ? '<input id="inPin" class="inp" maxlength="4" inputmode="numeric" placeholder="PIN 숫자 4자리">' : ''}
        <p id="loginErr" class="note"></p><button id="btnLogin" class="rowbtn gold">확인</button>`, { title: '닉네임', cls: 'small', noClose: !Rank.me, onClose: () => resolve() });
      let sending = false;
      const go = async () => {
        if (sending) return;
        sending = true; m.el.querySelector('#btnLogin').textContent = '확인 중…';
        const nick = m.el.querySelector('#inNick').value, pinEl = m.el.querySelector('#inPin');
        try {
          loginSeq++;
          const r = await Rank.login(nick, pinEl ? pinEl.value : '');
          applyLogin(r);
          m.close(); toast(`${Rank.me.nickname}님 환영합니다`); resolve();
        } catch (e) { m.el.querySelector('#loginErr').textContent = e.message; }
        sending = false; const b = m.el.querySelector('#btnLogin'); if (b) b.textContent = '확인';
      };
      m.el.querySelector('#btnLogin').onclick = go;
      m.el.querySelector('#inNick').onkeydown = e => { if (e.key === 'Enter') go(); };
      setTimeout(() => m.el.querySelector('#inNick').focus(), 50);
    });
  }
  // ---------- 관리자: 포인트 지급 ----------
  async function openGrant() {
    const m = modal(`<p class="muted">지급한 포인트는 받는 사람의 보유 포인트에만 더해지고 랭킹에는 반영되지 않아요.</p>
      <select id="gNick" class="inp"><option value="">불러오는 중…</option></select>
      <input id="gAmt" class="inp" inputmode="numeric" placeholder="금액 (pt)">
      <div class="chargegrid">${[10000, 50000, 100000, 1000000].map(a => `<button data-a="${a}">${fmt(a)}</button>`).join('')}</div>
      <p id="gErr" class="note"></p><button id="gSend" class="rowbtn gold">지급하기</button>`, { title: '포인트 지급', cls: 'small' });
    try {
      const list = await Rank.players();
      m.el.querySelector('#gNick').innerHTML = list.filter(n => !n.startsWith('__')).map(n => `<option value="${esc(n)}">${esc(n)}${Rank.me && n === Rank.me.nickname ? ' (나)' : ''}</option>`).join('');
    } catch (e) { m.el.querySelector('#gErr').textContent = '목록을 못 불러왔어요: ' + e.message; }
    m.el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { m.el.querySelector('#gAmt').value = b.dataset.a; });
    let sending = false;
    m.el.querySelector('#gSend').onclick = async () => {
      if (sending) return; sending = true;
      const nick = m.el.querySelector('#gNick').value, amt = +m.el.querySelector('#gAmt').value.replace(/[^0-9]/g, '');
      try {
        await Rank.grant(nick, amt);
        toast(`${nick}님에게 ${fmt(amt)}pt 지급했습니다`); Sound.play('coin'); m.close();
        if (Rank.me && nick === Rank.me.nickname) checkGrants();
      } catch (e) {
        m.el.querySelector('#gErr').textContent = /grants/.test(e.message) ? '서버에 지급 테이블이 아직 없어요 (SQL 실행 필요)' : e.message;
      }
      sending = false;
    };
  }
  // 나에게 온 지급 받기 (로그인할 때 + 20초마다)
  let grantBusy = false;
  async function checkGrants() {
    if (!Rank.me || grantBusy) return;
    grantBusy = true;
    try {
      const got = await Rank.claimGrants();
      for (const g of got) { S.points += g.amount; Rank.noteCharge(g.amount); news(`${g.by}님이 ${fmt(g.amount)}pt를 보냈어요!`, 'gift'); }
      if (got.length) { save(); showPoints(); showBet(); Sound.play('coin'); }
    } catch (e) { /* 지급 테이블이 없거나 연결 실패 → 조용히 넘어감 */ }
    grantBusy = false;
  }

  // ---------- 출석 체크 ----------
  const dayNum = d => Math.floor(Date.parse(d + 'T00:00:00Z') / 86400000);
  // 오늘 받을 차례(0~6)와 이미 받았는지
  function dailyInfo() {
    const today = Rank.todayKST(), a = S.attend, R7 = C.DAILY_REWARDS.length;
    const claimed = a.last === today;
    const cont = a.last && dayNum(today) - dayNum(a.last) === 1;      // 어제 받았으면 연속
    const streakNow = claimed ? a.streak : (cont ? a.streak : 0);       // 지금까지 연속 일수
    const idx = claimed ? (a.streak - 1) % R7 : streakNow % R7;          // 오늘 칸 (0~6)
    return { today, claimed, idx, streak: streakNow };
  }
  function openDaily(force) {
    const d = dailyInfo();
    if (d.claimed && !force) return false;
    const R = C.DAILY_REWARDS;
    const m = modal(`<p class="muted center">${d.claimed ? '오늘 출석 완료! 내일 또 와요' : '하루 한 번 출석하고 포인트 받아 가세요'}<br><small>연속 ${d.claimed ? d.streak : d.streak + 1}일째 · 하루라도 빠지면 1일차부터</small></p>
      <div class="daily">${R.map((r, i) => `<div class="dday ${i < d.idx || (d.claimed && i === d.idx) ? 'got' : ''} ${i === d.idx && !d.claimed ? 'today' : ''} ${i === R.length - 1 ? 'big' : ''}">
        <small>${i + 1}일차</small><span class="coin"></span><b>${fmt(r)}</b>${i < d.idx || (d.claimed && i === d.idx) ? `<i>${ico('check')}</i>` : ''}</div>`).join('')}</div>
      ${d.claimed ? '' : `<button id="dailyClaim" class="rowbtn gold big">${ico('gift')}${fmt(R[d.idx])}pt 받기</button>`}`, { title: '출석 체크', cls: 'small' });
    const b = m.el.querySelector('#dailyClaim');
    if (b) b.onclick = () => {
      const cur = dailyInfo();
      if (cur.claimed) { m.close(); return; }                 // 다른 창에서 이미 받은 경우
      const amt = C.DAILY_REWARDS[cur.idx];
      S.attend = { last: cur.today, streak: cur.streak + 1 };
      S.points += amt; Rank.noteCharge(amt);                  // 지갑에만 더함 (랭크 포인트 제외)
      save(); showPoints(); showBet(); Sound.play('coin');
      m.close(); news(`출석 ${S.attend.streak}일째! ${fmt(amt)}pt 획득`, 'calendar');
    };
    return true;
  }

  function showWho() { const w = $('#btnWho'); if (w) w.innerHTML = Rank.me ? `${ico('user')}<b>${esc(Rank.me.nickname)}</b> · 변경` : `${ico('user')}닉네임 설정`; }
  // 다른 사람의 큰 당첨 소식 확인 (온라인일 때 20초마다)
  let lastFeedId = null;
  async function pollFeed() {
    try {
      const f = await Rank.feed();
      // S·A·B상은 나를 포함해 모두에게 매번 알림 (받은 포인트까지). 최고 배율 갱신만 있는 낮은 등급은 소식 탭에만
      if (lastFeedId !== null) f.filter(x => x.id > lastFeedId && ['S', 'A', 'B'].includes(x.grade)).reverse()
        .forEach(x => news(`${x.nickname}님이 ${String(x.mode).toUpperCase()} ${C.gname(x.grade)} 「${x.card}」 획득! +${fmt(x.value)}pt`, 'star'));
      if (f.length) lastFeedId = Math.max(...f.map(x => x.id));
      else if (lastFeedId === null) lastFeedId = 0;
    } catch (e) { /* 연결 실패는 조용히 무시 */ }
  }

  // ---------- 시간 선물: 1시간마다 C.HOURLY_GIFT pt (포인트 칸을 눌러 받음, 쌓이지 않음) ----------
  const GIFT_MS = 3600e3;
  const giftLeft = () => { const g = S.gift && +S.gift.last || 0; return Math.max(0, GIFT_MS - (Date.now() - g)); };
  const mmss = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  // 시간이 되면 자동으로 보관함에 '포인트 카드'가 들어옴 (보관함에서 교환하면 포인트)
  function claimGift() {
    if (giftLeft() > 0) return;
    const amt = C.HOURLY_GIFT || 10000;
    S.gift = { last: Date.now() };
    S.inventory.push({ id: S.nextId++, grade: 'P', tier: 'P', idx: 0, kind: 'gift', name: '시간 선물', value: amt, bet: 0, at: Date.now() });
    Rank.noteCharge(amt);                                   // 수익 랭킹 제외 (선물)
    save(); Sound.play('coin');
    news(`시간 선물 도착! 보관함에 ${fmt(amt)}pt 포인트 카드가 들어왔어요`, 'gift'); updateGift();
  }
  function updateGift() {
    const b = $('#giftBadge'); if (!b) return;
    const left = giftLeft();
    if (left === 0) { claimGift(); return; }
    b.innerHTML = `${ico('gift')}다음 선물 <b>${mmss(left)}</b>`;
    const gt = $('#giftTime'); if (gt) gt.textContent = mmss(left);
  }
  // 상단: 이번 주 순위 + 도감 진행 (게임 목표 두 개)
  async function updateHeaderGoals() {
    const dexN = Object.keys(S.dex || {}).length, dexAll = C.allCards().length;
    const dt = $('#dexText'), df = $('#dexFill');
    if (dt) dt.textContent = `${dexN}/${dexAll}`;
    if (df) df.style.width = (dexAll ? dexN / dexAll * 100 : 0) + '%';
    const rt = $('#rankText'); if (!rt || !Rank.me) return;
    try {
      const rows = (await Rank.board('week')).filter(r => r.score > 0);   // 수익 랭킹은 플러스인 사람만 순위
      const i = rows.findIndex(r => r.nickname === Rank.me.nickname);
      rt.textContent = i >= 0 ? `${i + 1}위` : '도전 중';
      rt.classList.toggle('none', i < 0);
    } catch (e) { /* 서버 오류면 그대로 둠 */ }
  }
  function startGiftTimer() {
    const pill = $('#pointsPill');
    if (!pill || $('#giftBadge')) return;
    const b = document.createElement('span'); b.id = 'giftBadge'; pill.appendChild(b);
    updateGift(); setInterval(updateGift, 1000);
  }

  // ---------- 새 버전 자동 적용 ----------
  // 배포하면 version.txt 숫자가 바뀜 → 1분마다 확인 → 플레이 중·창(결과·메뉴 등)이 열려 있으면 기다렸다가
  // 한가할 때 저장하고 새로고침. 하던 판·고르던 카드는 끊기지 않음
  function startUpdateWatch() {
    if (V2TEST) return; // 시험 주소에서는 자동 업데이트 끔 (라이브 version.txt 를 보고 새로고침하지 않게)
    // 원인 메모(2026-11-14): GitHub Pages CDN은 ?t= 같은 주소 뒤 숫자를 무시하고 파일을 최대 10분(max-age=600) 캐시함.
    // → 배포 직후 새로고침하면 옛 화면/옛 js 가 섞여 올 수 있음. 그래서 '배포 시각 + 11분'이 지난 뒤에 적용(그때는 캐시가 다 갱신됨).
    const metaOf = (doc, name) => { const m = doc.querySelector(`meta[name="${name}"]`); return m ? m.content : ''; };
    const mine = metaOf(document, 'app-version');
    if (!mine || location.protocol === 'file:') return;
    const kstMs = v => Date.UTC(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8), +v.slice(8, 10), +v.slice(10, 12), +v.slice(12, 14)) - 9 * 3600e3;
    // 자동 업데이트로 새로고침돼서 들어온 경우: 가운데에 '업데이트 완료' 알림 (바뀐 내용 한 줄과 같이)
    const url = new URL(location.href);
    const came = url.searchParams.get('u');
    if (came) {
      url.searchParams.delete('u'); history.replaceState(null, '', url.toString());
      if (mine >= came) {
        const note = metaOf(document, 'app-note');
        const d = document.createElement('div'); d.className = 'upd-done';
        d.innerHTML = `<b>${ico('spark')}업데이트 완료!</b><span>${note ? esc(note) : '새 버전이 적용됐어요'}</span>`;
        document.body.appendChild(d);
        setTimeout(() => d.classList.add('out'), 3500); setTimeout(() => d.remove(), 4000);
      }
    }
    let newer = null, going = false;
    const idle = () => !busy && $('#overlay').hidden;
    const apply = () => {
      if (!newer || going || !idle()) return;
      if (Date.now() < kstMs(newer) + 11 * 60e3) return;          // CDN 캐시가 다 바뀔 때까지 기다림
      // 같은 버전 재시도는 2분 간격·최대 3번 (무한 새로고침 방지)
      let t = {}; try { t = JSON.parse(sessionStorage.getItem('ld_upd') || '{}'); } catch (e) { t = {}; }
      if (t.v === newer && (t.n >= 3 || Date.now() - t.at < 120e3)) return;
      try { sessionStorage.setItem('ld_upd', JSON.stringify({ v: newer, n: (t.v === newer ? t.n : 0) + 1, at: Date.now() })); } catch (e) { /* 무시 */ }
      going = true;
      try { save(); Rank.flush(true); } catch (e) { /* 저장 실패해도 진행 */ }
      news('새 버전이 나왔어요! 잠깐만요…', 'spark');
      setTimeout(() => { const u = new URL(location.href); u.searchParams.set('u', newer); location.replace(u.toString()); }, 1500);
    };
    const check = async () => {
      try {
        const r = await fetch('version.txt?t=' + Date.now(), { cache: 'no-store' });
        if (r.ok) {
          const v = (await r.text()).trim().split(/\r?\n/)[0].trim();
          if (/^\d{14}$/.test(v) && v > mine && (!newer || v > newer)) newer = v;
        }
      } catch (e) { /* 연결 실패는 무시 */ }
      apply();
    };
    setInterval(check, 60000);
    setInterval(apply, 3000);                                   // 업데이트 대기 중이면 한가해지는 순간 적용
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });  // 앱으로 돌아오면 바로 확인
    setTimeout(check, 5000);
  }

  // ---------- 모드 ----------
  function showMode() {
    const mode = C.MODES[S.mode];
    $('#modeBadge').textContent = mode.name;
    $('#modeBadge').className = S.mode;
    document.body.dataset.mode = S.mode;
    document.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.toggle('on', b.dataset.mode === S.mode);
      const lit = C.MODES[b.dataset.mode].meter;
      b.querySelectorAll('.meter i').forEach((i, k) => i.classList.toggle('lit', k < lit));
    });
  }
  function showTitle() { const t = $('#title'); t.hidden = false; t.classList.remove('out'); showMode(); }

  // ---------- 시작 ----------
  function init() {
    document.body.appendChild($('#toast'));
    // 팝업(#overlay)이 열려 있는 동안 뒤 화면(게임·타이틀)은 키보드/터치로 조작 불가
    const ov = $('#overlay');
    new MutationObserver(() => { const open = !ov.hidden; $('#app').inert = open; $('#title').inert = open; }).observe(ov, { attributes: true, attributeFilter: ['hidden'] });
    load();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 정리된 저장 데이터를 바로 기록 */ }
    R.init();
    showPoints(); showBet();
    R.setBet(S.bet);
    const preview = E.simulate(S.bet, 0.5, Math.random);
    R.drawBoard(preview.board, preview.chests);
    $('#scoreText').textContent = '0';

    $('#pointsPill').onclick = () => { Sound.unlock(); Sound.play('click');
      if (Rank.isAdmin()) openCharge(); else toast(`다음 시간 선물까지 ${mmss(giftLeft())} · 선물은 보관함에 들어와요`); };
    startGiftTimer();
    $('#btnRank').onclick = () => { Sound.unlock(); Sound.play('click'); openRanking(); };
    $('#hdRank').onclick = () => { Sound.unlock(); Sound.play('click'); openRanking(1); };
    $('#hdDex').onclick = () => { Sound.unlock(); Sound.play('click'); if (busy) { toast('플레이 중에는 열 수 없습니다'); return; } openBag(1); };
    $('#giftBtn').onclick = () => { Sound.unlock(); Sound.play('click'); toast(`다음 시간 선물까지 ${mmss(giftLeft())} · 보관함에 포인트 카드로 들어와요`); };
    setInterval(updateHeaderGoals, 60000); setTimeout(updateHeaderGoals, 1500);
    $('#btnMenu').onclick = () => { Sound.unlock(); Sound.play('click'); openMenu(); };
    $('#btnHelp').onclick = () => { Sound.unlock(); Sound.play('click'); openHelp(); };
    $('#btnPrizes').onclick = () => { Sound.unlock(); Sound.play('click'); openPrizes(); };
    $('#btnBag').onclick = () => { Sound.unlock(); Sound.play('click'); if (busy) { toast('플레이 중에는 열 수 없습니다'); return; } openBag(); };
    $('#betMinus').onclick = () => stepBet(-1);
    $('#betPlus').onclick = () => stepBet(1);
    $('#betBox').onclick = () => { Sound.play('click'); openBetList(); };
    $('#btnPlay').onclick = play;
    $('#btnSpeed').onclick = () => {
      R.state.speed = R.state.speed === 1 ? 3 : 1;
      $('#btnSpeed').classList.toggle('on', R.state.speed > 1);
      toast(R.state.speed > 1 ? '고속 ON' : '고속 OFF');
    };
    window.addEventListener('resize', fit);
    fit();
    // 저장된 닉네임으로 자동 로그인 (온라인이면 서버 기록과 맞춤)
    const prof = Rank.profile();
    if (prof && prof.nickname) {
      const mySeq = ++loginSeq;
      Rank.login(prof.nickname, prof.pin, prof.pin || !prof.pin_hash ? undefined : prof.pin_hash).then(r => {
        if (mySeq !== loginSeq) return;           // 그사이 직접 로그인했으면 무시
        if (busy) { const wait = setInterval(() => { if (!busy) { clearInterval(wait); applyLogin(r); } }, 500); return; }
        applyLogin(r);
      }).catch(() => { if (mySeq === loginSeq) { Rank.me = null; showWho(); } });
    }
    showWho();
    if (Rank.store.online) { pollFeed(); setInterval(pollFeed, 10000); }
    setInterval(checkGrants, 20000);
    startUpdateWatch();
    showAdmin();
    // 시작 화면: GAME START 를 누르면 사라지면서 BGM 시작 (테스트용 주소(#...)로 열면 건너뜀)
    const title = $('#title');
    if (!C.MODES[S.mode]) S.mode = 'mild';
    showMode();
    title.querySelectorAll('.mode-btn').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      S.mode = b.dataset.mode; save(); showMode(); Sound.unlock(); Sound.play('click');
    }));
    if (location.hash) { if (location.hash.includes('hard')) { S.mode = 'hard'; showMode(); } if (!location.hash.includes('title')) title.hidden = true; }
    {
      const sp = title.querySelector('.title-sparkles');
      for (let i = 0; i < 24; i++) {
        const d = document.createElement('i');
        d.style.left = Math.random() * 100 + '%'; d.style.top = Math.random() * 100 + '%';
        d.style.animationDelay = (Math.random() * 3).toFixed(2) + 's';
        d.style.transform = `scale(${0.5 + Math.random()})`;
        sp.appendChild(d);
      }
      const start = async e => {
        if (e && e.target.closest('.mode-btn')) return;
        if (e && e.target.closest('#btnWho')) { await askLogin(); return; }
        if (title.classList.contains('out')) return;
        Sound.unlock();
        let justLoggedIn = false;
        if (!Rank.me) { await askLogin(); justLoggedIn = true; }
        Sound.play('chestBig');
        title.classList.add('out');
        setTimeout(() => { title.hidden = true; title.classList.remove('out'); }, 600);
        toast(justLoggedIn && Rank.me ? `${Rank.me.nickname}님 환영합니다! ${C.MODES[S.mode].name} 모드로 시작해요` : `${C.MODES[S.mode].name} 모드로 시작합니다`);
        setTimeout(() => { if (!busy) openDaily(false); }, 900);
      };
      title.addEventListener('click', start);
    }
    // 테스트용: 주소 끝에 #auto 를 붙이면 자동으로 한 판 플레이
    if (location.hash.includes('auto')) setTimeout(play, 300);
    if (location.hash.includes('help')) openHelp();
    if (location.hash.includes('dex')) openBag(1);
    if (location.hash.includes('ranking')) setTimeout(openRanking, 200);
    if (location.hash.includes('prizes')) { openPrizes(); if (location.hash.includes('open')) document.querySelector('.prow').open = true; }
  }
  window.addEventListener('error', e => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:0;right:0;top:0;background:#c00;color:#fff;padding:6px;font:12px monospace;z-index:999';
    d.textContent = 'JS 오류: ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno;
    document.body.appendChild(d);
  });
  root.UI = { openDaily, dailyInfo, state: () => S }; // 테스트용
  document.addEventListener('DOMContentLoaded', init);
})(window);
