// =====================================================
//  탐험 엔진 (슬롯 덱빌딩) — 화면과 무관한 순수 계산 (서버에서도 그대로 실행 가능)
//   탐험(run) → 층(floor, 몬스터 1마리) → 스핀(spin)
//   스핀: 덱의 심볼이 슬롯 20칸에 깔림 → 특수 심볼 발동 → 곡괭이·TNT가 블록을 깸
//   대미지 = [칩(깬 블록 값 합)] × [배율] → 몬스터 체력에서 깎임
//   이벤트 목록을 돌려주면 화면(Render.play)이 재생
// =====================================================
(function (root) {
  const C = root.CONFIG, E = root.Engine, RL = root.Relics;
  const { pickWeighted, makeBoard, makeChests } = E._;
  const RUN = C.RUN;
  const isPick = it => !!(it && it.startsWith('pick'));
  const ORES = new Set(['ruby', 'gold', 'diamond', 'obsidian', 'mystery']);
  const cv = (run, e) => RL.cv(run, e);
  function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- 탐험 ----------
  // collection: 동료로 쓸 수 있는 카드(도감에서 잡은 몬스터) 목록
  function newRun({ mine = 0, seed, collection = [] } = {}) {
    if (seed === undefined) seed = Math.floor(Math.random() * 2 ** 31);
    return {
      mine, seed, rng: E.makeRng(seed),
      floor: 0,                                      // 0 ~ FLOORS-1 일반층, FLOORS = 보스층
      deck: RUN.START_DECK.map(id => ({ id, plus: 0 })),
      comps: [], collection,
      permMult: 0,                                   // 영구 배율 (공허 동료)
      hearts: RUN.HEARTS, maxHearts: RUN.HEARTS,
      spinsTotal: 0, choices: 0,
      results: [], over: false, cleared: false,
    };
  }
  const isBoss = run => run.floor >= RUN.FLOORS;
  const quotaOf = (mine, floor) => RUN.quota(mine, floor);

  // ---------- 몬스터 ----------
  const MON_GRADES = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
  const mineKey = m => Object.keys(C.TIERS).sort((a, b) => a - b)[m];
  function pickMonster(run, boss, elite) {
    const key = mineKey(run.mine);
    const grade = boss ? 'S' : MON_GRADES[Math.min(run.floor + (elite ? 1 : 0), MON_GRADES.length - 2)];
    const list = C.TIERS[key].cards[grade] || [];
    const idx = Math.floor(run.rng() * list.length);
    return { ...list[idx], grade, idx, tier: key };
  }
  // ---------- 몬스터 행동 (미리 예고) ----------
  // 몬스터는 패턴 순서대로 행동. 화면에 '다음 행동 + 남은 턴'을 보여줌 → 그 전에 잡을지 판단
  const ACTS = {
    atk:   { turns: 3, icon: '⚔️', name: '공격', desc: '하트 -1 · 덱에 돌멩이 +1' },
    heavy: { turns: 4, icon: '💢', name: '강공격', desc: '하트 -2 · 덱에 돌멩이 +1' },
    curse: { turns: 2, icon: '🪨', name: '저주', desc: '덱에 돌멩이 +2' },
    guard: { turns: 1, icon: '🛡', name: '방어', desc: '다음 스핀 대미지 절반' },
    heal:  { turns: 2, icon: '💚', name: '회복', desc: '체력 25% 회복' },
  };
  // 속성별 특기
  const ELEM_ACT = { lava: 'heavy', thunder: 'heavy', ruby: 'heavy', void: 'curse', obsidian: 'curse', rainbow: 'curse',
    sapphire: 'guard', diamond: 'guard', stone: 'guard', clover: 'heal', gold: 'heal' };
  function makePattern(run, fl) {
    const fav = ELEM_ACT[fl.monster.elem] || 'atk', f = run.floor;
    if (fl.boss) return ['heavy', 'guard', fav === 'heavy' || fav === 'guard' ? 'heal' : fav, 'atk', 'heavy'];
    if (fl.elite) return ['heavy', fav === 'heavy' ? 'curse' : fav, 'atk'];
    if (f === 0) return ['atk', fav === 'heavy' ? 'atk' : fav];         // 1층: 순한 몬스터
    return ['atk', fav === 'heavy' ? 'curse' : fav, 'heavy'];          // 2층부터: 강공격 섞임
  }
  function setIntent(fl) {
    fl.intent = fl.pattern[fl.patIdx % fl.pattern.length];
    fl.spins = ACTS[fl.intent].turns;
  }

  function layBoard(run, fl) {
    const rng = run.rng;
    fl.board = makeBoard(rng, RUN.boardK(run.mine, run.floor, fl.boss));
    fl.chests = makeChests(rng, RUN.chestK(run.mine, run.floor, fl.boss));
    fl.initialBoard = fl.board.map(row => row.map(b => (b ? { type: b.type } : null)));
    fl.initialChests = fl.chests.map(ch => ({ min: ch.min, mult: ch.mult }));
  }

  // ---------- 층 ----------
  // 남은 스핀 = 몬스터 공격까지 남은 턴. 0이 되면 하트 -1, 덱에 돌멩이(저주) +1
  // kind: 'normal' | 'elite' (정예: 체력 ↑, 한 등급 위 몬스터, 보상 +1)
  function createFloor(run, kind = 'normal') {
    const boss = isBoss(run), elite = !boss && kind === 'elite';
    const fl = {
      boss, elite, quota: Math.round(quotaOf(run.mine, run.floor) * (elite ? RUN.ELITE_HP : 1)), monster: pickMonster(run, boss, elite),
      score: 0, floorMult: 0, hits: 0, refills: 0, spinCount: 0, grid: null, cards: null, guard: false, patIdx: 0,
    };
    fl.pattern = makePattern(run, fl);
    setIntent(fl);
    layBoard(run, fl);
    return fl;
  }
  const boardEmpty = fl => fl.board.every(row => row.every(b => !b));
  const isDead = fl => fl.score >= fl.quota;
  const floorDone = (fl, run) => isDead(fl) || (run && run.hearts <= 0);
  const powerOf = (run, fl, r, c) => C.PICKS[fl.grid[r][c]].power + run.deck[fl.cards[r][c]].plus;

  // ---------- 스핀: 덱 → 슬롯 ----------
  function startSpin(run, fl) {
    fl.spins--; fl.spinCount++; run.spinsTotal++;
    const N = C.SLOT_ROWS * C.COLS, rng = run.rng;
    const pick = shuffle(run.deck.map((_, i) => i), rng).slice(0, N);   // 덱이 20장보다 많으면 20장만
    const cells = shuffle([...Array(N).keys()], rng);
    fl.grid = Array.from({ length: C.SLOT_ROWS }, () => Array(C.COLS).fill(null));
    fl.cards = Array.from({ length: C.SLOT_ROWS }, () => Array(C.COLS).fill(-1));
    pick.forEach((di, k) => { const r = Math.floor(cells[k] / C.COLS), c = cells[k] % C.COLS; fl.grid[r][c] = run.deck[di].id; fl.cards[r][c] = di; });
    const pow = fl.grid.map((row, r) => row.map((t, c) => (isPick(t) ? powerOf(run, fl, r, c) : 0)));
    return { type: 'spin', grid: fl.grid.map(r => r.slice()), pow, spinsLeft: fl.spins };
  }

  // ---------- 스핀 처리 ----------
  function resolveSpin(run, fl) {
    const rng = run.rng, board = fl.board, g = fl.grid.map(r => r.slice()), cards = fl.cards;
    const ROWS = C.ROWS, SR = C.SLOT_ROWS, COLS = C.COLS, MAX = RUN.MAX_SPINS;
    const events = [];
    let chips = 0, mult = 1 + fl.floorMult + run.permMult, xmult = 1;
    const curMult = () => Math.round(mult * xmult * 100) / 100;
    const pw = g.map((row, r) => row.map((t, c) => (isPick(t) ? powerOf(run, fl, r, c) : 0)));
    const colTorch = Array(COLS).fill(0), colMag = Array(COLS).fill(0);
    const addMult = (r, c, add, label) => { mult += add; events.push({ type: 'mult', r, c, add, label, mult: curMult() }); };
    const cStone = cv(run, 'stone'), cRuby = cv(run, 'ruby'), cDia = cv(run, 'diamond'), cLava = cv(run, 'lava'), cRain = cv(run, 'rainbow');
    const tntRad = cLava > 0 ? 2 : 1;
    const used = [];

    function breakBlock(r, c, queue, viaBoom) {
      const b = board[r][c];
      let chip = RUN.CHIPS[b.type];
      if (b.type === 'mystery') chip = pickWeighted(rng, RUN.MYSTERY_CHIPS);
      if (cStone && (b.type === 'grass' || b.type === 'dirt' || b.type === 'stone')) chip += 7 * cStone;
      if (cDia && (b.type === 'gold' || b.type === 'diamond')) chip *= 1 + 0.5 * cDia;
      if (colTorch[c] && ORES.has(b.type)) chip *= Math.pow(2, colTorch[c]);
      // 용암: 범위만 넓어짐
      chip += 5 * colMag[c];
      chip = Math.round(chip);
      chips += chip;
      board[r][c] = null;
      events.push({ type: 'break', r, c, block: b.type, chip, chips });
      if (b.type === 'ruby' && cRuby) addMult(-1, c, cRuby, '루비');
      if (b.type === 'explosive') queue.push({ r, c, center: false, dmg: 2, rad: 1 });
      checkChest(c);
    }
    function checkChest(c) {
      const ch = fl.chests[c];
      if (ch.opened) return;
      for (let r = 0; r < ROWS; r++) if (board[r][c]) return;
      ch.opened = true;
      const add = ch.mult - 1 + 0.5 * cRain;
      mult += add;                                   // 상자 배율은 연 스핀에만 (층 내내 쌓이면 시간만 끌면 이기게 됨)
      events.push({ type: 'chest', c, mult: ch.mult, min: ch.min, add, cur: curMult() });
    }
    function damage(r, c, amount, queue, viaBoom) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
      const b = board[r][c];
      if (!b) return;
      b.hp -= amount;
      events.push({ type: 'hit', r, c, hp: Math.max(0, b.hp), maxHp: b.maxHp });
      if (b.hp <= 0) breakBlock(r, c, queue, viaBoom);
    }
    function runExplosions(queue) {
      while (queue.length) {
        const ex = queue.shift();
        const cells = [], k = ex.rad || 1;
        for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) {
          if (!ex.center && dr === 0 && dc === 0) continue;
          const rr = ex.r + dr, cc = ex.c + dc;
          if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) cells.push([rr, cc]);
        }
        events.push({ type: 'explode', r: ex.r, c: ex.c, cells });
        for (const [rr, cc] of cells) damage(rr, cc, ex.dmg, queue, true);
      }
    }
    const topBlockRow = c => { for (let r = 0; r < ROWS; r++) if (board[r][c]) return r; return -1; };
    const each = fn => { for (let r = 0; r < SR; r++) for (let c = 0; c < COLS; c++) fn(r, c, g[r][c]); };

    // 1) 모래시계: 몬스터 공격 1턴 늦춤
    each((r, c, t) => {
      if (t !== 'spin') return;
      g[r][c] = null;
      if (fl.spins >= MAX) return;
      fl.spins++;
      used.push(cards[r][c]);                        // 모래시계는 쓰면 덱에서 사라짐 (소모품)
      events.push({ type: 'spinPlus', r, c, spinsLeft: fl.spins });
    });
    // 2) 동료: 곡괭이 강화 (흑요석 = 전부, 사파이어 = 첫 곡괭이)
    const cObs = cv(run, 'obsidian'), cSap = cv(run, 'sapphire');
    if (cObs) { const n = Math.max(1, Math.floor(cObs)); each((r, c, t) => { if (isPick(t)) pw[r][c] += n; }); }
    if (cSap) {
      let done = false;
      for (let c = 0; c < COLS && !done; c++) for (let r = 0; r < SR && !done; r++) if (isPick(g[r][c])) { pw[r][c] += Math.round(4 * cSap); done = true; events.push({ type: 'sym', r, c, sym: 'sap', label: '선봉!', keep: true, ups: [{ r, c, power: pw[r][c] }] }); }
    }
    // 3) 모루: 바로 위 곡괭이 영구 +1
    each((r, c, t) => {
      if (t !== 'anvil') return;
      const ups = [];
      if (r > 0 && isPick(g[r - 1][c])) { run.deck[cards[r - 1][c]].plus++; pw[r - 1][c]++; ups.push({ r: r - 1, c, power: pw[r - 1][c] }); }
      g[r][c] = null;
      events.push({ type: 'sym', r, c, sym: 'anvil', label: ups.length ? '영구 +1' : '', ups });
    });
    // 4) 강화의 책: 같은 열 아래 곡괭이 +2
    each((r, c, t) => {
      if (t !== 'book') return;
      const ups = [];
      for (let rr = r + 1; rr < SR; rr++) if (isPick(g[rr][c])) { pw[rr][c] += 2; ups.push({ r: rr, c, power: pw[rr][c] }); }
      g[r][c] = null;
      events.push({ type: 'sym', r, c, sym: 'book', label: ups.length ? `+2타 ×${ups.length}` : '', ups });
    });
    // 5) 횃불·자석: 열 효과
    each((r, c, t) => {
      if (t === 'torch') { colTorch[c]++; g[r][c] = null; events.push({ type: 'sym', r, c, sym: 'torch', label: '광석 ×2', col: [c] }); }
      if (t === 'magnet') { if (c > 0) colMag[c - 1]++; if (c < COLS - 1) colMag[c + 1]++; g[r][c] = null; events.push({ type: 'sym', r, c, sym: 'magnet', label: '옆 열 +5', col: [c - 1, c + 1].filter(x => x >= 0 && x < COLS) }); }
      if (t === 'pebble') g[r][c] = null;
    });
    // 6) 클로버: 배율
    let clovers = 0; each((r, c, t) => { if (t === 'clover') clovers++; });
    const cClo = cv(run, 'clover');
    each((r, c, t) => {
      if (t !== 'clover') return;
      g[r][c] = null;
      addMult(r, c, (clovers >= 3 ? 1 : 0.5) + cClo, '🍀');
    });
    // 7) 빈칸 (황금 동료)
    const cGold = cv(run, 'gold');
    if (cGold) {
      let empty = 0;
      for (let r = 0; r < SR; r++) for (let c = 0; c < COLS; c++) if (cards[r][c] < 0) empty++;
      if (empty) addMult(-1, 2, Math.round(0.8 * cGold * empty * 100) / 100, `빈칸 ${empty}`);
    }
    // 8) 잭팟: 가로 한 줄이 전부 곡괭이 → 배율 ×3
    for (let r = 0; r < SR; r++) if (g[r].every(isPick)) { xmult *= 3; events.push({ type: 'jackpot', r, mult: curMult() }); }

    // 9) 왼쪽 열부터: 곡괭이·TNT·번개
    for (let c = 0; c < COLS; c++) for (let r = 0; r < SR; r++) {
      const it = g[r][c];
      if (!it) continue;
      g[r][c] = null;
      if (it === 'tnt') {
        const tr = topBlockRow(c);
        events.push({ type: 'tnt', sr: r, c, tr });
        if (tr >= 0) runExplosions([{ r: tr, c, center: true, dmg: 2, rad: tntRad }]);
        continue;
      }
      if (it === 'bolt') {
        const cols = shuffle([...Array(COLS).keys()], rng).slice(0, 3);
        events.push({ type: 'boltSym', r, c });
        for (const cc of cols) { const tr = topBlockRow(cc); events.push({ type: 'bolt', c: cc, r: tr }); if (tr >= 0) { const q = []; damage(tr, cc, 1, q); runExplosions(q); } }
        continue;
      }
      if (!isPick(it)) continue;
      let power = pw[r][c];
      events.push({ type: 'pick', sr: r, c, item: it, power });
      while (power > 0) {
        const tr = topBlockRow(c);
        if (tr < 0) break;
        power--;
        events.push({ type: 'swing', r: tr, c, power });
        const q = [];
        damage(tr, c, 1, q);
        runExplosions(q);
      }
      events.push({ type: 'pickEnd', c, power });
    }
    // 동료 번개
    const cTh = cv(run, 'thunder');
    if (cTh) for (let i = 0; i < Math.max(1, Math.round(2 * cTh)); i++) {
      const cc = Math.floor(rng() * COLS), tr = topBlockRow(cc);
      events.push({ type: 'bolt', c: cc, r: tr });
      if (tr >= 0) { const q = []; damage(tr, cc, 1, q); runExplosions(q); }
    }

    // 소모된 심볼 덱에서 제거 (뒤에서부터)
    used.sort((x, y) => y - x).forEach(i => run.deck.splice(i, 1));
    // 10) 대미지 = 칩 × 배율
    const m = curMult(), guard = fl.guard;
    const dmg = Math.round(chips * m * (guard ? 0.5 : 1));
    fl.guard = false;
    fl.score += dmg;
    fl.grid = null;
    events.push({ type: 'tally', chips, mult: m, dmg, guard, score: fl.score, hp: Math.max(0, fl.quota - fl.score), quota: fl.quota });
    events.push({ type: 'spinEnd', spinsLeft: fl.spins });
    return events;
  }

  // 스핀이 끝난 뒤: 몬스터 공격 / 판 새로 깔기
  function endTurn(run, fl) {
    const out = { dead: isDead(fl), attacked: false, refill: false, act: null };
    if (!out.dead && fl.spins <= 0) {
      const a = fl.intent;
      out.act = a;
      if (a === 'atk' || a === 'heavy') {
        const n = a === 'heavy' ? 2 : 1;
        run.hearts = Math.max(0, run.hearts - n); fl.hits++; out.attacked = true; out.lost = n;
        run.deck.push({ id: 'pebble', plus: 0 });
      }
      if (a === 'curse') { run.deck.push({ id: 'pebble', plus: 0 }, { id: 'pebble', plus: 0 }); }
      if (a === 'guard') fl.guard = true;
      if (a === 'heal') { const h = Math.min(fl.score, Math.round(fl.quota * 0.25)); fl.score -= h; out.healed = h; out.score = fl.score; }
      fl.patIdx++;
      setIntent(fl);
    }
    if (!out.dead && run.hearts > 0 && boardEmpty(fl)) { layBoard(run, fl); fl.refills++; out.refill = true; }
    out.hearts = run.hearts; out.spinsLeft = fl.spins;
    return out;
  }

  // ---------- 선택: 스핀마다 심볼 3택1, 3스핀마다 1장 빼기 ----------
  const draftOffer = run => RL.draft(run, 3, run.rng);
  const canRemove = run => run.spinsTotal % 3 === 0 && run.deck.length > 1;
  function addSymbol(run, id) { run.deck.push({ id, plus: 0 }); run.choices++; }
  function removeCard(run, i) {
    if (i < 0 || i >= run.deck.length) return;
    run.deck.splice(i, 1); run.choices++;
    const v = cv(run, 'void');
    if (v) run.permMult = Math.round((run.permMult + 0.4 * v) * 100) / 100;
  }

  // ---------- 층 결과·보상 ----------
  function floorResult(run, fl) {
    const pass = isDead(fl), perfect = pass && fl.hits === 0;
    return { score: fl.score, quota: fl.quota, pass, perfect, hits: fl.hits, turns: fl.spinCount, boss: fl.boss, elite: fl.elite, monster: fl.monster,
      gi: perfect ? 0 : pass ? 4 : -1, grade: perfect ? 'S' : pass ? 'D' : '-' };
  }
  function advance(run, res) {
    run.results.push(res);
    if (!res.pass || run.hearts <= 0) { run.over = true; return; }
    if (res.boss) { run.over = true; run.cleared = true; return; }
    run.floor++;
  }
  const shopSize = res => 3 + (res.perfect ? 1 : 0) + (res.elite ? 1 : 0);
  // 층 보상 (큰 선택): 방금 잡은 몬스터를 동료로 / 도감 속 다른 동료 / 희귀 심볼 / 회복 / 정화
  //  → [{ kind:'comp', card } | { kind:'sym', id } | { kind:'heal' } | { kind:'purge' }]
  function rewardOffer(run, res, n) {
    const rng = run.rng, out = [];
    const has = card => run.comps.some(c => c.name === card.name);
    const canComp = run.comps.length < RUN.MAX_COMPS;
    if (canComp && res.monster && RL.COMP[res.monster.elem] && !has(res.monster)) out.push({ kind: 'comp', card: res.monster });
    const others = shuffle(run.collection.filter(c => RL.COMP[c.elem] && !has(c) && !(res.monster && c.name === res.monster.name)), rng);
    if (canComp && others.length) out.push({ kind: 'comp', card: others[0] });
    const rares = shuffle(['pick5', 'pick7', 'anvil', 'bolt', 'magnet'], rng);
    out.push({ kind: 'sym', id: rares[0] });
    out.push({ kind: 'purge' });
    if (canComp && others.length > 1) out.push({ kind: 'comp', card: others[1] });
    out.push({ kind: 'sym', id: rares[1] });
    return out.slice(0, n);
  }
  function takeReward(run, opt) {
    run.choices++;
    if (opt.kind === 'comp') run.comps.push(opt.card);
    if (opt.kind === 'sym') run.deck.push({ id: opt.id, plus: 0 });
    if (opt.kind === 'heal') { if (run.hearts >= run.maxHearts) run.maxHearts = Math.min(5, run.maxHearts + 1); run.hearts = Math.min(run.maxHearts, run.hearts + 1); }
    if (opt.kind === 'purge') {   // 돌멩이(없으면 돌 곡괭이) 2장 빼기
      for (let k = 0; k < 2; k++) {
        let j = run.deck.findIndex(d => d.id === 'pebble');
        if (j < 0) j = run.deck.findIndex(d => d.id === 'pick1');
        if (j >= 0) removeCard(run, j);
      }
      run.choices--;
    }
  }

  // ---------- 갈림길: 다음 층을 고름 (보스 직전 제외) ----------
  //  일반 / 정예(강하지만 보상 +1, 한 등급 위 카드) / 휴식(싸움 없이 하트 +1, 대신 보상 없음)
  function routeOffer(run) {
    if (run.over || isBoss(run)) return null;
    const out = ['normal', 'elite'];
    const last = run.results[run.results.length - 1];
    if (run.hearts < run.maxHearts && !(last && last.rest)) out.push('rest');
    return out;
  }
  function rest(run) {
    run.hearts = Math.min(run.maxHearts, run.hearts + 1);
    run.results.push({ pass: true, rest: true, perfect: false, hits: 0, turns: 0, score: 0, quota: 0, boss: false, elite: false, monster: null });
    run.choices++;
    run.floor++;
  }

  // ---------- 보상 (광석) ----------
  function oreFor(run) {
    let ore = 0;
    run.results.forEach((r, i) => { if (r.pass && !r.rest) ore += Math.round((10 + i * 5) * (1 + run.mine * 0.5) * (r.perfect ? 1.5 : 1)); });
    if (run.cleared) ore += Math.round(100 * (1 + run.mine * 0.5));
    return ore;
  }

  root.Dig = { newRun, createFloor, startSpin, resolveSpin, endTurn, floorDone, isDead, floorResult, advance, shopSize, oreFor, quotaOf, isBoss, isPick,
    draftOffer, canRemove, addSymbol, removeCard, rewardOffer, takeReward, mineKey, ACTS, routeOffer, rest };
})(typeof window !== 'undefined' ? window : globalThis);
