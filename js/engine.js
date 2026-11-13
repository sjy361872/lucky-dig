// =====================================================
//  게임 엔진 — 화면과 무관한 순수 계산
//  1) 등급을 먼저 뽑고  2) 그 등급 스코어가 나오는 한 판을 시뮬레이션으로 찾고
//  3) 그 판의 진행 기록(events)을 화면이 그대로 재생합니다.
// =====================================================
(function (root) {
  const C = root.CONFIG;

  // ---------- 난수 ----------
  function makeRng(seed) {
    if (seed === undefined) return Math.random;
    let a = seed >>> 0;
    return function () { // mulberry32
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pickWeighted(rng, entries) { // entries: [[value, weight], ...]
    let total = 0;
    for (const e of entries) total += Math.max(0, e[1]);
    let x = rng() * total;
    for (const e of entries) { x -= Math.max(0, e[1]); if (x < 0) return e[0]; }
    return entries[entries.length - 1][0];
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  function lerpTable(low, high, k) { // 두 가중치 표를 강도 k로 섞기
    const keys = new Set([...Object.keys(low), ...Object.keys(high)]);
    const out = [];
    for (const key of keys) out.push([key, Math.max(0, lerp(low[key] || 0, high[key] || 0, k))]);
    return out;
  }

  // ---------- 강도(k)별 생성 테이블 ----------
  // k=0: 거의 못 캐는 판, k=1: 대박 판. 등급 맞추기는 이 k를 조절해서 합니다.
  // 행마다 나올 수 있는 블록이 정해져 있음 (원작 블록판 5개 관찰 결과)
  //   1행 풀 / 2행 흙·돌 / 3행 돌·?·폭발 / 4행 루비·폭발 / 5행 루비·폭발·금·다이아 / 6행 금·다이아·흑요석
  // [k=0일 때 가중치, k=1일 때 가중치]
  const ROW_TABLES = [
    [{ grass: 100 }, { grass: 100 }],
    [{ dirt: 35, stone: 65 }, { dirt: 20, stone: 80 }],
    [{ stone: 85, mystery: 5, explosive: 10 }, { stone: 45, mystery: 30, explosive: 25 }],
    [{ ruby: 90, explosive: 10 }, { ruby: 75, explosive: 25 }],
    [{ ruby: 55, explosive: 15, gold: 20, diamond: 10 }, { ruby: 15, explosive: 15, gold: 30, diamond: 40 }],
    [{ gold: 45, diamond: 30, obsidian: 25 }, { gold: 10, diamond: 30, obsidian: 60 }],
  ];
  const SLOT_TABLE = [
    { empty: 86, pick1: 6, pick2: 4, pick3: 2.5, pick5: 0.6, pick7: 0.1, spin: 1.6, book: 0.1, superbook: 0.02, tnt: 0.4 },
    { empty: 62, pick1: 6, pick2: 7, pick3: 8, pick5: 6, pick7: 2.5, spin: 4, book: 1.5, superbook: 0.6, tnt: 2.5 },
  ];
  const CHEST_TABLE = [
    { 2: 60, 3: 25, 4: 9, 5: 4, 6: 2, 7: 0.6, 8: 0.3, 9: 0.1, 10: 0.05 },
    { 2: 20, 3: 20, 4: 16, 5: 13, 6: 10, 7: 8, 8: 6, 9: 4, 10: 3 },
  ];
  const MAX_SPINS = 20;

  // ---------- 판 생성 ----------
  function makeBoard(rng, k) {
    const board = [];
    for (let r = 0; r < C.ROWS; r++) {
      const table = lerpTable(ROW_TABLES[r][0], ROW_TABLES[r][1], k);
      const row = [];
      for (let c = 0; c < C.COLS; c++) {
        const type = pickWeighted(rng, table);
        row.push({ type, hp: C.BLOCKS[type].hp, maxHp: C.BLOCKS[type].hp });
      }
      board.push(row);
    }
    return board;
  }
  function makeChests(rng, k) {
    const table = lerpTable(CHEST_TABLE[0], CHEST_TABLE[1], k);
    const chests = [];
    for (let c = 0; c < C.COLS; c++) {
      const min = Number(pickWeighted(rng, table));
      let mult = min;
      while (mult < 10 && rng() < 0.2) mult++; // 최소 배율보다 클 수도 있음
      chests.push({ min, mult, opened: false });
    }
    return chests;
  }
  function makeSlot(rng, k) {
    const table = lerpTable(SLOT_TABLE[0], SLOT_TABLE[1], k);
    const grid = [];
    for (let r = 0; r < C.SLOT_ROWS; r++) {
      const row = [];
      for (let c = 0; c < C.COLS; c++) {
        const it = pickWeighted(rng, table);
        row.push(it === 'empty' ? null : it);
      }
      grid.push(row);
    }
    return grid;
  }

  // ---------- 한 판 시뮬레이션 ----------
  function simulate(bet, k, rng) {
    const board = makeBoard(rng, k);
    const chests = makeChests(rng, k);
    const initialBoard = board.map(row => row.map(b => ({ type: b.type })));
    const initialChests = chests.map(ch => ({ min: ch.min, mult: ch.mult }));
    const events = [];
    let score = 0;
    let gm = 1; // 열린 상자 배율의 곱

    function breakBlock(r, c, queue) {
      const b = board[r][c];
      let mult = C.BLOCKS[b.type].mult;
      if (b.type === 'mystery') mult = pickWeighted(rng, C.MYSTERY_VALUES.map(v => [v.mult, v.w]));
      const base = Math.round(mult * bet);
      const gain = Math.round(mult * bet * gm);
      score += gain;
      board[r][c] = null;
      events.push({ type: 'break', r, c, block: b.type, base, gm, gain, score });
      if (b.type === 'explosive') queue.push({ r, c, center: false });
      checkChest(c);
    }
    function checkChest(c) {
      const ch = chests[c];
      if (ch.opened) return;
      for (let r = 0; r < C.ROWS; r++) if (board[r][c]) return;
      ch.opened = true;
      const before = score;
      score = Math.round(score * ch.mult);
      gm *= ch.mult;
      events.push({ type: 'chest', c, mult: ch.mult, min: ch.min, before, score, gm });
    }
    function damage(r, c, amount, queue) {
      if (r < 0 || r >= C.ROWS || c < 0 || c >= C.COLS) return;
      const b = board[r][c];
      if (!b) return;
      b.hp -= amount;
      events.push({ type: 'hit', r, c, hp: Math.max(0, b.hp), maxHp: b.maxHp });
      if (b.hp <= 0) breakBlock(r, c, queue);
    }
    function runExplosions(queue) {
      while (queue.length) {
        const ex = queue.shift();
        const cells = [];
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!ex.center && dr === 0 && dc === 0) continue;
          const rr = ex.r + dr, cc = ex.c + dc;
          if (rr >= 0 && rr < C.ROWS && cc >= 0 && cc < C.COLS) cells.push([rr, cc]);
        }
        events.push({ type: 'explode', r: ex.r, c: ex.c, cells });
        for (const [rr, cc] of cells) damage(rr, cc, C.EXPLOSION_DAMAGE, queue);
      }
    }
    function topBlockRow(c) {
      for (let r = 0; r < C.ROWS; r++) if (board[r][c]) return r;
      return -1;
    }

    // 시작: 스핀 심볼로 스핀 횟수 결정
    let spins = Math.round(lerp(2, 4, k) + (rng() - 0.5) * 1.6);
    spins = Math.max(1, Math.min(6, spins));
    events.push({ type: 'init', spins });
    let spinCount = 0;

    const boardEmpty = () => board.every(row => row.every(b => !b));
    while (spins > 0 && spinCount < MAX_SPINS && !boardEmpty()) { // 다 파냈으면 남은 스핀은 의미 없으니 종료
      spins--; spinCount++;
      const grid = makeSlot(rng, k);
      events.push({ type: 'spin', grid: grid.map(row => row.slice()), last: spins === 0, spinsLeft: spins });
      // 스핀 심볼: 1개당 남은 스핀 +1 (총 스핀 상한 초과분은 무효)
      for (let r = 0; r < C.SLOT_ROWS; r++) for (let c = 0; c < C.COLS; c++) {
        if (grid[r][c] !== 'spin') continue;
        grid[r][c] = null;
        if (spinCount + spins >= MAX_SPINS) continue;
        spins++;
        events.push({ type: 'spinPlus', r, c, spinsLeft: spins });
      }
      // 강화의 책
      for (let r = 0; r < C.SLOT_ROWS; r++) for (let c = 0; c < C.COLS; c++) {
        const it = grid[r][c];
        if (it !== 'book' && it !== 'superbook') continue;
        const to = it === 'book' ? 'pick5' : 'pick7';
        const ups = [];
        for (let rr = 0; rr < C.SLOT_ROWS; rr++) {
          const p = grid[rr][c];
          if (p && p.startsWith('pick') && C.PICKS[p].power < C.PICKS[to].power) { grid[rr][c] = to; ups.push({ r: rr, c, to }); }
        }
        grid[r][c] = null;
        events.push({ type: 'book', r, c, kind: it, ups });
      }
      // 곡괭이·TNT: 왼쪽 열부터, 위에서 아래로
      for (let c = 0; c < C.COLS; c++) for (let r = 0; r < C.SLOT_ROWS; r++) {
        const it = grid[r][c];
        if (!it) continue;
        grid[r][c] = null;
        if (it === 'tnt') {
          const tr = topBlockRow(c);
          if (tr < 0) { events.push({ type: 'tnt', sr: r, c, tr: -1 }); continue; }
          events.push({ type: 'tnt', sr: r, c, tr });
          runExplosions([{ r: tr, c, center: true }]);
          continue;
        }
        let power = C.PICKS[it].power;
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
      events.push({ type: 'spinEnd', spinsLeft: spins });
    }
    events.push({ type: 'end', score });
    return { bet, k, score, board: initialBoard, chests: initialChests, events };
  }

  // ---------- 등급 ----------
  function gradeIndexForScore(score, bet) {
    for (let i = 0; i < C.GRADES.length; i++) if (score >= C.GRADES[i].need * bet) return i;
    return -1; // G 미만
  }
  function rateOf(g, mode) { return C.MODES && C.MODES[mode] ? C.MODES[mode].rates[g.id] : g.rate; }
  function drawGradeIndex(rng, mode = 'mild') {
    return pickWeighted(rng, C.GRADES.map((g, i) => [i, rateOf(g, mode)]));
  }
  function drawCard(gradeId, rng, bet) {
    const list = C.cardsFor(bet, gradeId);
    const idx = pickWeighted(rng, list.map((c, i) => [i, c.w]));
    return { ...list[idx], grade: gradeId, idx, tier: gradeId === 'G' ? 'G' : C.tierOf(bet) };
  }

  // 정해진 등급의 스코어 구간에 들어가는 판을 찾을 때까지 생성
  const K_GUESS = { S: 0.95, A: 0.8, B: 0.65, C: 0.55, D: 0.5, E: 0.38, F: 0.28, G: 0.18 };
  function findRound(gi, bet, rng) {
    const g = C.GRADES[gi];
    const lo = g.need * bet;
    const hi = (gi === 0 ? C.S_CAP : C.GRADES[gi - 1].need) * bet;
    let k = K_GUESS[g.id];
    for (let tries = 1; tries <= 20000; tries++) {
      const kk = Math.min(1.3, Math.max(0, k + (rng() - 0.5) * 0.15));
      const sim = simulate(bet, kk, rng);
      if (sim.score >= lo && sim.score < hi) { sim.tries = tries; return sim; }
      k = sim.score < lo ? Math.min(1.3, k + 0.01) : Math.max(0, k - 0.01);
    }
    throw new Error('등급 ' + g.id + ' 판 생성 실패');
  }

  // 카드 환원 포인트 = 소비 포인트 × 등급 기준 배수 × 카드별 r
  function cardValue(g, card, bet, mode = 'mild') { const pay = (C.MODES && C.MODES[mode] && C.MODES[mode].pay) || 1; return Math.round(bet * g.need * card.r * pay); }

  // 플레이 1회: 등급 추첨 → 카드 추첨 → 판 생성
  function playRound(bet, seed, mode = 'mild') {
    const rng = makeRng(seed);
    const gi = drawGradeIndex(rng, mode);
    const g = C.GRADES[gi];
    const card = drawCard(g.id, rng, bet);
    const sim = findRound(gi, bet, rng);
    return { grade: g.id, gradeIndex: gi, card, payout: cardValue(g, card, bet, mode), sim };
  }

  root.Engine = { rateOf, cardValue, makeRng, simulate, findRound, playRound, gradeIndexForScore, drawGradeIndex, drawCard };
})(typeof window !== 'undefined' ? window : globalThis);
