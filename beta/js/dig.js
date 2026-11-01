// =====================================================
//  탐험 엔진 — 화면과 무관한 순수 계산 (서버에서도 그대로 돌릴 수 있게)
//  탐험(run) → 층(floor) → 스핀(spin) 단위로 진행.
//  스핀마다 결과 그리드를 먼저 만들고(rollGrid), 플레이어가 리롤·홀드를 정한 뒤
//  확정하면 resolveSpin 이 블록을 캐고 이벤트 목록을 돌려줌 → 화면(Render.play)이 재생
//  이벤트 형식은 기존 오리파 엔진과 같음 (break, hit, swing, chest, explode …)
// =====================================================
(function (root) {
  const C = root.CONFIG, E = root.Engine, RL = root.Relics;
  const { pickWeighted, makeBoard, makeChests } = E._;
  const RUN = C.RUN;
  const isPick = it => !!(it && it.startsWith('pick'));

  // ---------- 탐험 ----------
  function newRun({ mine = 0, seed } = {}) {
    if (seed === undefined) seed = Math.floor(Math.random() * 2 ** 31);
    return {
      mine, seed, rng: E.makeRng(seed),
      floor: 0,                       // 0 ~ FLOORS-1 일반층, FLOORS = 보스층
      pool: { ...RUN.BASE_POOL },
      mods: RL.baseMods(),
      rerolls: RUN.START_REROLLS,
      picks: [],                      // 상점에서 고른 것 (id)
      results: [],                    // 층별 { score, quota, grade }
      over: false, cleared: false,
    };
  }
  const isBoss = run => run.floor >= RUN.FLOORS;
  const quotaOf = (mine, floor) => RUN.quota(mine, floor, floor >= RUN.FLOORS);
  // 등급 기준선: [{ id, color, at(점수) }] S → G 순서
  const thresholds = quota => C.GRADES.map(g => ({ id: g.id, color: g.color, at: Math.round(quota * RUN.GRADE_X[g.id]) }));
  function gradeIndexOf(score, quota) { const t = thresholds(quota); for (let i = 0; i < t.length; i++) if (score >= t[i].at) return i; return -1; }

  // ---------- 층 ----------
  function createFloor(run) {
    const boss = isBoss(run), rng = run.rng, m = run.mods;
    const board = makeBoard(rng, RUN.boardK(run.mine, run.floor, boss));
    const chests = makeChests(rng, RUN.chestK(run.mine, run.floor, boss));
    for (const row of board) for (const b of row) {
      const minus = m.hpMinus[b.type] || 0;
      if (minus) b.hp = b.maxHp = Math.max(1, b.maxHp - minus);
    }
    if (m.clearTop) for (let c = 0; c < C.COLS; c++) board[0][c] = null;
    for (const ch of chests) if (m.chestMin) { ch.min = Math.min(10, ch.min + m.chestMin); ch.mult += m.chestMin; }
    const quota = quotaOf(run.mine, run.floor);
    return {
      boss, quota, unit: RUN.UNIT,
      score: 0, gm: 1,
      spins: RUN.START_SPINS + m.startSpins, spinCount: 0,
      board, chests,
      initialBoard: board.map(row => row.map(b => (b ? { type: b.type } : null))),
      initialChests: chests.map(ch => ({ min: ch.min, mult: ch.mult })),
      grid: null, held: [false, false, false, false, false],
    };
  }
  const boardEmpty = fl => fl.board.every(row => row.every(b => !b));
  const floorDone = fl => fl.spins <= 0 || boardEmpty(fl);

  // ---------- 스핀 결과 만들기 ----------
  // held[c] 가 true 인 열은 이전 그리드(prev)를 그대로 둠 (홀드)
  function rollGrid(run, fl, held, prev) {
    const rng = run.rng, pool = Object.entries(run.pool);
    const grid = [];
    for (let r = 0; r < C.SLOT_ROWS; r++) {
      const row = [];
      for (let c = 0; c < C.COLS; c++) {
        if (held && held[c] && prev) { row.push(prev[r][c]); continue; }
        const it = pickWeighted(rng, pool);
        row.push(it === 'empty' ? null : it);
      }
      grid.push(row);
    }
    // 광부의 감: 층 첫 스핀에 곡괭이 최소 N개
    if (fl.spinCount === 1 && !prev && run.mods.firstPicks) {
      const picks = pool.filter(([k]) => isPick(k));
      let have = grid.flat().filter(isPick).length;
      const empties = [];
      for (let r = 0; r < C.SLOT_ROWS; r++) for (let c = 0; c < C.COLS; c++) if (!grid[r][c]) empties.push([r, c]);
      while (have < run.mods.firstPicks && empties.length) {
        const [r, c] = empties.splice(Math.floor(rng() * empties.length), 1)[0];
        grid[r][c] = pickWeighted(rng, picks);
        have++;
      }
    }
    return grid;
  }

  // 스핀 시작 (남은 스핀 1 소모) → 첫 그리드
  function startSpin(run, fl) {
    fl.spins--; fl.spinCount++;
    fl.held = [false, false, false, false, false];
    fl.grid = rollGrid(run, fl, null, null);
    return { type: 'spin', grid: fl.grid.map(r => r.slice()), last: fl.spins === 0, spinsLeft: fl.spins };
  }
  // 리롤: 홀드하지 않은 열만 다시 돌림
  function reroll(run, fl, held) {
    if (run.rerolls <= 0) return null;
    run.rerolls--;
    fl.held = held.slice();
    fl.grid = rollGrid(run, fl, held, fl.grid);
    return { type: 'spin', grid: fl.grid.map(r => r.slice()), last: fl.spins === 0, spinsLeft: fl.spins, held: held.slice(), reroll: true };
  }

  // ---------- 스핀 확정 → 블록 캐기 ----------
  function resolveSpin(run, fl) {
    const m = run.mods, rng = run.rng, board = fl.board, grid = fl.grid.map(r => r.slice());
    const events = [];
    const MAX = RUN.MAX_SPINS;

    function breakBlock(r, c, queue) {
      const b = board[r][c];
      let mult = C.BLOCKS[b.type].mult;
      if (b.type === 'mystery') mult = pickWeighted(rng, C.MYSTERY_VALUES.map(v => [v.mult, v.w]));
      const bm = m.blockMult[b.type] || 1;
      const base = Math.round(mult * fl.unit * bm);
      const gain = Math.round(mult * fl.unit * bm * fl.gm);
      fl.score += gain;
      board[r][c] = null;
      events.push({ type: 'break', r, c, block: b.type, base, gm: fl.gm, gain, score: fl.score });
      if (b.type === 'explosive') queue.push({ r, c, center: false, dmg: m.exDmg });
      checkChest(c);
    }
    function checkChest(c) {
      const ch = fl.chests[c];
      if (ch.opened) return;
      for (let r = 0; r < C.ROWS; r++) if (board[r][c]) return;
      ch.opened = true;
      // 탐험에서는 상자 배율을 더함 (×3, ×4 상자 → 전체 ×6). 곱하면 운이 너무 크게 갈려서 업그레이드가 의미 없어짐
      //  점수 = (지금까지 캔 기본 점수 합) × 전체 배율
      const before = fl.score, gm = fl.gm + ch.mult - 1;
      fl.score = Math.round(fl.score * gm / fl.gm);
      fl.gm = gm;
      events.push({ type: 'chest', c, mult: ch.mult, min: ch.min, before, score: fl.score, gm: fl.gm });
      if (m.chestSpin) {
        const add = Math.max(0, Math.min(m.chestSpin, MAX - (fl.spinCount + fl.spins)));
        if (add) { fl.spins += add; events.push({ type: 'bonusSpin', c, n: add, spinsLeft: fl.spins }); }
      }
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
        for (const [rr, cc] of cells) damage(rr, cc, ex.dmg, queue);
      }
    }
    const topBlockRow = c => { for (let r = 0; r < C.ROWS; r++) if (board[r][c]) return r; return -1; };

    // 스핀 심볼: 1개당 남은 스핀 +1
    for (let r = 0; r < C.SLOT_ROWS; r++) for (let c = 0; c < C.COLS; c++) {
      if (grid[r][c] !== 'spin') continue;
      grid[r][c] = null;
      if (fl.spinCount + fl.spins >= MAX) continue;
      fl.spins++;
      events.push({ type: 'spinPlus', r, c, spinsLeft: fl.spins });
    }
    // 강화의 책
    for (let r = 0; r < C.SLOT_ROWS; r++) for (let c = 0; c < C.COLS; c++) {
      const it = grid[r][c];
      if (it !== 'book' && it !== 'superbook') continue;
      const to = it === 'book' ? 'pick5' : 'pick7';
      const ups = [];
      for (let rr = 0; rr < C.SLOT_ROWS; rr++) {
        const p = grid[rr][c];
        if (isPick(p) && C.PICKS[p].power < C.PICKS[to].power) { grid[rr][c] = to; ups.push({ r: rr, c, to }); }
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
        events.push({ type: 'tnt', sr: r, c, tr });
        if (tr >= 0) runExplosions([{ r: tr, c, center: true, dmg: m.tntDmg }]);
        continue;
      }
      let power = C.PICKS[it].power + m.pickBonus;
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
    fl.grid = null;
    events.push({ type: 'spinEnd', spinsLeft: fl.spins });
    return events;
  }

  // ---------- 층 결과 ----------
  // 등급(S~G, 못 미치면 -1)과 통과 여부
  function floorResult(run, fl) {
    const gi = gradeIndexOf(fl.score, fl.quota);
    const pass = fl.score >= fl.quota;
    return { score: fl.score, quota: fl.quota, gi, grade: gi >= 0 ? C.GRADES[gi].id : '-', pass, boss: fl.boss };
  }
  // 통과 후 다음 층으로 (보스까지 깨면 cleared)
  function advance(run, res) {
    run.results.push(res);
    if (!res.pass) { run.over = true; return; }
    if (res.boss) { run.over = true; run.cleared = true; return; }
    run.floor++;
  }
  // 상점 선택지 수: B상 이상이면 1개 더
  const shopSize = res => (res.gi >= 0 && res.gi <= 2 ? 4 : 3);

  // ---------- 보상 (광석) ----------
  // 층마다: 목표 점수 기준 기본 + 등급 보너스
  const GRADE_BONUS = { S: 3, A: 2.2, B: 1.7, C: 1.35, D: 1, E: 0, F: 0, G: 0, '-': 0 };
  function oreFor(run) {
    let ore = 0;
    run.results.forEach((r, i) => { if (r.pass) ore += Math.round((10 + i * 5) * (1 + run.mine * 0.5) * GRADE_BONUS[r.grade]); });
    if (run.cleared) ore += Math.round(100 * (1 + run.mine * 0.5));
    return ore;
  }

  root.Dig = { newRun, createFloor, startSpin, reroll, resolveSpin, floorDone, floorResult, advance, shopSize, oreFor, quotaOf, thresholds, gradeIndexOf, isBoss, isPick };
})(typeof window !== 'undefined' ? window : globalThis);
