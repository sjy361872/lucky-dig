// =====================================================
//  랭킹 — 기록 계산 + 저장소(오프라인/온라인)
//
//  핵심 규칙: 무료 충전은 랭킹에 반영되지 않는다.
//   - 랭크 포인트 = 시작 포인트 + (받은 환원 포인트 합 − 쓴 소비 포인트 합)
//     → "충전을 한 번도 안 했다면 남아 있을 포인트". 충전은 지갑(보유 포인트)에만 더해짐
//   - 나머지 기록(최고 배율, S상 횟수, 도감, 오늘 수익)도 전부 플레이 결과로만 계산
//
//  저장소는 두 가지이고 같은 함수 모양을 가진다:
//   - LocalStore: 이 기기 localStorage (설정이 비어 있을 때)
//   - SupabaseStore: 온라인 DB (js/online-config.js 에 주소를 넣으면)
// =====================================================
(function (root) {
  const C = root.CONFIG;
  const BIG_FEED = g => g === 'S' || g === 'A';           // 피드에 올릴 당첨
  const todayKST = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

  // ---------- 기록 계산 ----------
  function emptyStats() {
    return {
      plays: 0, spent: 0, earned: 0, rankPoints: C.START_POINTS,
      best: null,                       // { mult, grade, mode, bet, card, value, at }
      grades: { mild: {}, hard: {} },   // 모드별 등급 횟수
      collection: [],                   // 모은 카드 키 'S:3'
      daily: { date: todayKST(), net: 0, plays: 0 },
      charged: 0,                       // 참고용: 무료 충전 합계 (랭킹에는 안 씀)
    };
  }
  const GRADE_IDS = 'SABCDEFG'.split('');
  const okGrade = g => (GRADE_IDS.includes(g) ? g : 'G');
  const okMode = m => (m === 'hard' ? 'hard' : 'mild');
  const num = v => (Number.isFinite(+v) ? +v : 0);
  // 서버/저장소에서 읽은 기록을 기본 형식에 맞춰 정리 (빠진 칸 채우기, 이상한 값 제거)
  function normStats(st) {
    const d = emptyStats();
    if (!st || typeof st !== 'object') return d;
    const out = { ...d };
    for (const k of ['plays', 'spent', 'earned', 'charged']) out[k] = num(st[k]);
    out.rankPoints = C.START_POINTS + out.earned - out.spent;
    const b = st.best;
    out.best = b && typeof b === 'object' ? { mult: num(b.mult), grade: okGrade(b.grade), mode: okMode(b.mode), bet: num(b.bet), card: String(b.card || '').slice(0, 20), value: num(b.value), at: num(b.at) } : null;
    for (const m of ['mild', 'hard']) { out.grades[m] = {}; const src = (st.grades && st.grades[m]) || {}; for (const g of GRADE_IDS) if (src[g]) out.grades[m][g] = num(src[g]); }
    out.collection = Array.isArray(st.collection) ? st.collection.filter(k => /^(\d+:[SABCDEF]|G):\d+$/.test(k)) : [];
    out.daily = st.daily && typeof st.daily === 'object' ? { date: String(st.daily.date || ''), net: num(st.daily.net), plays: num(st.daily.plays) } : d.daily;
    return out;
  }
  function cleanFeed(f) {
    return { id: num(f.id), nickname: String(f.nickname || '').slice(0, 10), mode: okMode(f.mode), grade: okGrade(f.grade), card: String(f.card || '').slice(0, 20), bet: num(f.bet), value: num(f.value), at: f.at };
  }
  function applyPlay(st, p) {
    // p = { mode, bet, grade, cardIdx, card, value }
    st.plays++; st.spent += p.bet; st.earned += p.value;
    st.rankPoints = C.START_POINTS + st.earned - st.spent;
    const mult = p.value / p.bet;
    let newBest = false;
    if (!st.best || mult > st.best.mult) { st.best = { mult, grade: p.grade, mode: p.mode, bet: p.bet, card: p.card, value: p.value, at: Date.now() }; newBest = true; }
    const gm = st.grades[p.mode] || (st.grades[p.mode] = {});
    gm[p.grade] = (gm[p.grade] || 0) + 1;
    const key = p.key || (p.grade + ':' + p.cardIdx);
    const newCard = !st.collection.includes(key);
    if (newCard) st.collection.push(key);
    if (st.daily.date !== todayKST()) st.daily = { date: todayKST(), net: 0, plays: 0 };
    st.daily.net += p.value - p.bet; st.daily.plays++;
    return { newBest, newCard };
  }
  const sCount = st => (st.grades.mild.S || 0) + (st.grades.hard.S || 0);
  const todayNet = st => (st.daily && st.daily.date === todayKST() ? st.daily.net : 0);
  const totalCards = () => C.allCards().length;
  // 다 모은 광산 수 (공통 G상 포함)
  function doneMines(st) {
    const have = new Set(st.collection || []), by = {};
    for (const c of C.allCards()) { const t = c.tier; by[t] = by[t] || [0, 0]; by[t][1]++; if (have.has(C.cardKey(c))) by[t][0]++; }
    return Object.values(by).filter(([a, b]) => a === b).length;
  }

  // 랭킹 보드 정의: 점수 계산 + 표시
  const fmt = n => Math.round(n).toLocaleString('ko-KR');
  const BOARDS = [
    // 랭크 = 보유 포인트(화면에 보이는 내 포인트). 예전엔 '충전 안 했다면 남았을 포인트'라 크게 잃으면 마이너스가 됐음
    { id: 'rank', name: '보유 포인트', score: st => st.wallet, show: st => fmt(st.wallet) + ' pt', sub: st => `${fmt(st.plays)}판` },
    { id: 'best', name: '최고 배율', score: st => (st.best ? st.best.mult : 0), show: st => (st.best ? '×' + st.best.mult.toFixed(2) : '—'),
      sub: st => (st.best ? `${st.best.mode.toUpperCase()} ${st.best.grade}상 · ${fmt(st.best.bet)}pt` : '') },
    { id: 'S', name: 'S상 횟수', score: st => sCount(st), show: st => sCount(st) + '회', sub: st => `MILD ${st.grades.mild.S || 0} · HARD ${st.grades.hard.S || 0}` },
    { id: 'dex', name: '도감 수집', score: st => st.collection.length * 1000 + doneMines(st), show: st => `${st.collection.length} / ${totalCards()}장`,
      sub: st => `${Math.floor(st.collection.length / totalCards() * 100)}% · 완성 광산 ${doneMines(st)}곳` },
    { id: 'today', name: '오늘 수익', score: st => todayNet(st), show: st => (todayNet(st) >= 0 ? '+' : '') + fmt(todayNet(st)) + ' pt',
      sub: st => (st.daily && st.daily.date === todayKST() ? `${st.daily.plays}판` : '0판') },
  ];

  // ---------- 저장소: 이 기기 ----------
  const LKEY = 'luckydig.rank.local';
  const LocalStore = {
    online: false,
    _db() { try { return JSON.parse(localStorage.getItem(LKEY)) || { players: {}, feed: [] }; } catch (e) { return { players: {}, feed: [] }; } },
    _put(db) { try { localStorage.setItem(LKEY, JSON.stringify(db)); } catch (e) { /* 무시 */ } },
    async login(nickname) {
      const db = this._db();
      const p = db.players[nickname] || (db.players[nickname] = { nickname, stats: emptyStats(), state: null, updated_at: Date.now() });
      this._put(db);
      return { nickname, stats: p.stats, state: p.state, created: !p.state };
    },
    async save(nickname, _pin, state, stats) { // eslint-disable-line no-unused-vars
      const db = this._db();
      db.players[nickname] = { nickname, stats, state, updated_at: Date.now() };
      this._put(db);
    },
    async leaderboard() { return Object.values(this._db().players).map(p => ({ ...p, wallet: p.state && p.state.points })); },
    async addFeed(item) { const db = this._db(); item.id = Date.now(); db.feed.unshift(item); db.feed = db.feed.slice(0, 50); this._put(db); },
    async feed() { return this._db().feed; },
    async players() { return Object.keys(this._db().players); },
    async addGrant(nickname, amount, by) { const db = this._db(); db.grants = db.grants || []; db.grants.push({ id: Date.now() + Math.random(), nickname, amount, by, claimed: false, at: new Date().toISOString() }); this._put(db); },
    async pendingGrants(nickname) { return (this._db().grants || []).filter(g => g.nickname === nickname && !g.claimed); },
    async claimGrant(id) { const db = this._db(); const g = (db.grants || []).find(x => x.id === id && !x.claimed); if (!g) return null; g.claimed = true; this._put(db); return g; },
  };

  // ---------- 저장소: Supabase (PostgREST) ----------
  async function sha256(text) {
    if (root.crypto && root.crypto.subtle) {
      const buf = await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return 'plain:' + text;
  }
  function makeSupabaseStore(url, key) {
    const base = url.replace(/\/$/, '') + '/rest/v1/';
    // 새 형식 키(sb_publishable_...)는 apikey 헤더에만 넣고, 예전 형식(JWT)은 Authorization 헤더에도 넣음
    const H = key.startsWith('sb_') ? { apikey: key, 'Content-Type': 'application/json' }
      : { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
    async function req(path, opts = {}) {
      const r = await fetch(base + path, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
      if (!r.ok) throw new Error(`서버 오류 ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const t = await r.text();
      return t ? JSON.parse(t) : null;
    }
    const enc = encodeURIComponent;
    return {
      online: true,
      // 닉네임이 없으면 새로 만들고, 있으면 PIN이 맞는지 확인
      async login(nickname, pin, savedHash) {
        const pin_hash = savedHash || await sha256('luckydig:' + nickname + ':' + pin);
        const rows = await req(`players?nickname=eq.${enc(nickname)}&select=nickname,pin_hash,stats,state`);
        if (rows.length) {
          if (rows[0].pin_hash !== pin_hash) throw new Error('PIN이 맞지 않습니다');
          return { nickname, stats: rows[0].stats || emptyStats(), state: rows[0].state, created: false, pin_hash };
        }
        const stats = emptyStats();
        await req('players', { method: 'POST', body: JSON.stringify({ nickname, pin_hash, stats, state: null }) });
        return { nickname, stats, state: null, created: true, pin_hash };
      },
      async save(nickname, pin_hash, state, stats, keepalive) {
        await req(`players?nickname=eq.${enc(nickname)}&pin_hash=eq.${enc(pin_hash)}`, {
          method: 'PATCH', keepalive: !!keepalive, body: JSON.stringify({ state, stats, updated_at: new Date().toISOString() }) });
      },
      async leaderboard() { return req('players?select=nickname,stats,updated_at,wallet:state->points'); },
      async addFeed(item) { await req('feed', { method: 'POST', body: JSON.stringify(item) }); },
      async feed() { return req('feed?select=*&order=id.desc&limit=30'); },
      async players() { return (await req('players?select=nickname')).map(r => r.nickname); },
      async addGrant(nickname, amount, by) { await req('grants', { method: 'POST', body: JSON.stringify({ nickname, amount, by }) }); },
      async pendingGrants(nickname) { return req(`grants?nickname=eq.${enc(nickname)}&claimed=eq.false&select=id,amount,by`); },
      // 두 기기가 동시에 받아도 한 번만 받도록: 아직 안 받은 것만 '받음'으로 바꾸고, 바뀐 행이 있을 때만 지급
      async claimGrant(id) {
        const rows = await req(`grants?id=eq.${+id}&claimed=eq.false`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ claimed: true }) });
        return rows && rows[0] ? rows[0] : null;
      },
    };
  }

  const cfg = root.ONLINE || {};
  // 테스트용 주소(#uitest 등)로 열면 실제 랭킹을 건드리지 않도록 항상 오프라인
  const testMode = root.location && /uitest|auto|fx\d|picktest|ranking|prizes|help|hard|title|dex|migrate/.test(root.location.hash || '');
  const store = !testMode && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY ? makeSupabaseStore(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : LocalStore;

  // ---------- 세션: 현재 플레이어 ----------
  const PKEY = 'luckydig.profile';
  const Rank = {
    store, BOARDS, emptyStats, applyPlay, normStats, cleanFeed, todayKST, totalCards,
    me: null, // { nickname, pin_hash, stats }
    profile() { try { return JSON.parse(localStorage.getItem(PKEY)); } catch (e) { return null; } },
    async login(nickname, pin, savedHash) {
      nickname = String(nickname || '').trim().slice(0, 10);
      if (!nickname) throw new Error('닉네임을 입력하세요');
      if (/^__/.test(nickname)) throw new Error('이 닉네임은 쓸 수 없습니다');
      if (store.online && !savedHash && !/^\d{4}$/.test(pin || '')) throw new Error('PIN은 숫자 4자리입니다');
      Rank.flush(); // 이전 계정의 저장 대기분을 먼저 보냄
      const r = await store.login(nickname, pin, savedHash);
      r.stats = normStats(r.stats);
      Rank.me = { nickname, pin_hash: r.pin_hash || '', stats: r.stats };
      try { localStorage.setItem(PKEY, JSON.stringify({ nickname, pin_hash: Rank.me.pin_hash })); } catch (e) { /* 무시 */ }
      return r;
    },
    logout() { Rank.me = null; try { localStorage.removeItem(PKEY); } catch (e) { /* 무시 */ } },
    // 플레이 결과 기록 → 새 기록 여부 반환
    recordPlay(p) {
      if (!Rank.me) return {};
      let r;
      try { r = applyPlay(Rank.me.stats, p); } catch (e) { console.warn('record', e); return {}; }
      if (BIG_FEED(p.grade) || r.newBest) {
        store.addFeed({ nickname: Rank.me.nickname, mode: p.mode, grade: p.grade, card: p.card, bet: p.bet, value: p.value, at: new Date().toISOString() })
          .catch(e => console.warn('feed', e));
      }
      return r;
    },
    isAdmin() { return !!(Rank.me && (C.ADMINS || []).includes(Rank.me.nickname)); },
    async grant(nickname, amount) {
      if (!Rank.isAdmin()) throw new Error('관리자만 지급할 수 있습니다');
      nickname = String(nickname || '').trim(); amount = Math.round(+amount);
      if (!(amount > 0 && amount <= 100000000)) throw new Error('금액을 확인하세요');
      const list = await store.players();
      if (!list.includes(nickname)) throw new Error('그런 닉네임이 없습니다');
      await store.addGrant(nickname, amount, Rank.me.nickname);
    },
    players: () => store.players(),
    // 나에게 온 지급을 받아서 합계를 돌려줌 (받은 건 '받음' 처리)
    async claimGrants() {
      if (!Rank.me) return [];
      const got = [];
      for (const g of await store.pendingGrants(Rank.me.nickname)) {
        const ok = await store.claimGrant(g.id);
        if (ok) got.push({ amount: Math.max(0, Math.round(+ok.amount || +g.amount || 0)), by: String(ok.by || g.by || '관리자').slice(0, 10) });
      }
      return got;
    },
    noteCharge(amount) { if (Rank.me) Rank.me.stats.charged = (Rank.me.stats.charged || 0) + amount; },
    // 게임 상태(포인트·보관함 등) + 기록을 저장소에 저장 (잦은 저장은 묶어서 1초 뒤 한 번)
    _t: null, _pending: null,
    sync(state) {
      if (!Rank.me) return;
      clearTimeout(Rank._t);
      const me = Rank.me;
      Rank._pending = { me, state: JSON.parse(JSON.stringify(state)) };
      Rank._wallet = state.points;
      Rank._t = setTimeout(() => Rank.flush(), 1000);
    },
    flush(keepalive) {
      clearTimeout(Rank._t);
      const p = Rank._pending; Rank._pending = null;
      if (p) store.save(p.me.nickname, p.me.pin_hash, p.state, p.me.stats, keepalive).catch(e => console.warn('sync', e));
    },
    async board(id) {
      const def = BOARDS.find(b => b.id === id);
      const rows = (await store.leaderboard()).filter(r => r.stats && !String(r.nickname).startsWith('__')); // '__'로 시작 = 점검용 계정
      // 내 최신 기록은 화면 값으로 덮어씀 (저장 지연 대비)
      if (Rank.me) {
        const mine = rows.find(r => r.nickname === Rank.me.nickname);
        if (mine) { mine.stats = Rank.me.stats; if (Rank._wallet != null) mine.wallet = Rank._wallet; }
        else rows.push({ nickname: Rank.me.nickname, stats: Rank.me.stats, wallet: Rank._wallet });
      }
      const out = [];
      for (const r of rows) {
        try { const st0 = Rank.me && r.nickname === Rank.me.nickname ? r.stats : normStats(r.stats);
          // 보유 포인트: 저장된 게임 상태의 포인트 (없으면 시작 포인트)
          const st = { ...st0, wallet: Math.max(0, Number.isFinite(+r.wallet) && r.wallet !== null ? +r.wallet : C.START_POINTS) };
          out.push({ nickname: String(r.nickname).slice(0, 10), score: def.score(st), show: def.show(st), sub: def.sub(st) }); } catch (e) { /* 깨진 기록은 건너뜀 */ }
      }
      return out.sort((a, b) => b.score - a.score);
    },
    feed: async () => (await store.feed()).map(cleanFeed),
  };
  // 창을 닫거나 다른 앱으로 넘어갈 때 저장 대기분을 바로 보냄
  root.addEventListener && root.addEventListener('pagehide', () => Rank.flush(true));
  root.document && root.document.addEventListener('visibilitychange', () => { if (root.document.visibilityState === 'hidden') Rank.flush(true); });
  root.Rank = Rank;
})(window);
