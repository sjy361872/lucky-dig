// =====================================================
//  곡괭이 키우기 (방치형) — 계산만 하는 엔진 (화면과 무관, tools/sim_idle.js 에서도 그대로 실행)
//   광부가 자동으로 몬스터를 때림. 공격 한 번 = 작은 슬롯 한 번
//   슬롯 칸: ⛏ 곡괭이(1타) · 💎 보석(크리티컬) · 💣 TNT(2타) · 🪙 코인(광석) · 📦 상자(대미지 배율)
//   같은 그림이 3개 이상이면 콤보 배율. 층마다 몬스터 10마리 → 보스 도전(직접 플레이)
// =====================================================
(function (root) {
  const IDLE = {
    KILLS: 10,                 // 층마다 잡아야 보스에 도전할 수 있는 몬스터 수
    OFFLINE_MAX: 8 * 3600,     // 접속 안 해도 쌓이는 최대 시간(초)
    OFFLINE_RATE: 0.5,         // 자리 비운 동안은 평소의 50%
    BOSS_X: 2.5,               // 보스 체력 = 그 층 몬스터 체력 × 2.5 (공격 8번 안에 잡아야 하므로 이 정도가 첫판 승률 ~50%)
    BOSS_REROLLS: 3,           // 보스전 다시 돌리기 횟수
    MOB_HIT: 1.5,              // 일반 몬스터가 반격하는 간격(초)
    REGEN: 0.15,               // 몬스터를 잡을 때마다 내구도 회복(최대치의 15%)
    STAGES: 5,                 // 챕터(광산)마다 스테이지 수: 1-1 ~ 1-5
    RESPAWN: 0.35,             // 몬스터가 다시 나오기까지(초)
  };
  // 슬롯 심볼: w = 나오는 비중, hit = 기본 타수
  const SYMS = {
    pick:  { name: '곡괭이', icon: 'pick2', w: 50, hit: 1 },
    tnt:   { name: 'TNT', icon: 'tnt', w: 14, hit: 2 },
    gem:   { name: '보석', icon: 'gem', w: 10, hit: 0 },     // 타수 = 보석 배율(강화로 증가)
    coin:  { name: '코인', icon: 'coin', w: 12, hit: 0 },
    chest: { name: '보물상자', icon: 'chest', w: 3, hit: 0 },
  };
  const COMBO = { 3: 2, 4: 4, 5: 10 };   // 같은 그림 n개 → 대미지 ×

  // 강화: cost(lv) = 다음 레벨 가격, max = 최대 레벨
  const UP = {
    atk:   { name: '곡괭이 공격력', icon: 'pick3', max: 1e9, cost: lv => 5 * Math.pow(1.13, lv) },
    spd:   { name: '휘두르기 속도', icon: 'spin', max: 20, cost: lv => 40 * Math.pow(1.55, lv) },
    gem:   { name: '보석 감정', icon: 'gem', max: 40, cost: lv => 60 * Math.pow(1.28, lv) },
    chest: { name: '보물상자', icon: 'chest', max: 40, cost: lv => 150 * Math.pow(1.3, lv) },
    coin:  { name: '광석 수집', icon: 'coin', max: 1e9, cost: lv => 30 * Math.pow(1.2, lv) },
    cells: { name: '슬롯 칸 늘리기', icon: 'slot', max: 2, cost: lv => [400, 30000][lv] },
    dur:   { name: '곡괭이 내구도', icon: 'dur', max: 1e9, cost: lv => 8 * Math.pow(1.14, lv) },
  };
  const ATB = +(globalThis.process && process.env.ATB) || 5;   // 공격력 시작값
  // 강화 레벨 → 실제 수치
  const stat = {
    atk: lv => (ATB + lv) * Math.pow(2, Math.floor(lv / 25)),        // 25레벨마다 2배 · 시작값 ATB가 크면 초반 한 레벨의 체감이 덜 폭발적
    aps: lv => 0.8 + 0.08 * lv,                                         // 초당 공격
    gemW: lv => 10 + 2 * lv, gemX: lv => 3 + 0.25 * lv,
    chestW: lv => 3 + 0.5 * lv, chestX: lv => 3 + 0.2 * lv,
    coinX: lv => 1 + 0.2 * lv,
    cells: lv => 3 + lv,
    dur: lv => Math.round(100 * Math.pow(+(globalThis.process && process.env.DURG) || 1.062, lv)),   // 곡괭이 내구도(= 체력)
  };
  // 밸런스 숫자 (tools/sim_idle.js 에서 환경변수로 바꿔 시험 가능)
  const env = (k, d) => +(globalThis.process && process.env[k]) || d;
  //  HPE: 초반(EF층까지) 체력 증가율 — 초반엔 강화가 빨리 쌓이므로 체력도 더 빨리 올려야 '한 방 컷'이 안 됨
  const BAL = { HPB: env('HPB', 70), HPG: env('HPG', 1.20), HPE: env('HPE', 1.30), EF: env('EF', 20), GG: env('GG', 1.15), KG: env('KG', 2), BX: env('BX', IDLE.BOSS_X), SX: env('SX', 1.4) };
  const mobHp = f => Math.round(BAL.HPB * Math.pow(BAL.HPE, Math.min(f, BAL.EF)) * Math.pow(BAL.HPG, Math.max(0, f - BAL.EF)));
  const killGold = f => Math.ceil(BAL.KG * Math.pow(BAL.GG, f));
  const isSBoss = f => f % 5 === 4;
  // 반격: 일반 몬스터 한 대 · 보스 한 턴 (곡괭이 내구도를 깎음)
  BAL.DA = env('DA', 22); BAL.DG = env('DG', 1.095); BAL.BA = env('BA', 0.9);
  //  처음 두 챕터(10스테이지)는 반격이 약하게 시작해서 서서히 세짐 → 1-1에서 부러지는 일 없게
  const mobAtk = f => Math.max(1, Math.round(BAL.DA * Math.pow(BAL.DG, f) * Math.min(1, 0.35 + 0.065 * f)));
  const bossAtk = f => Math.max(1, Math.round(mobAtk(f) * BAL.BA * (isSBoss(f) ? 1.2 : 1)));
  // 스테이지 번호: 챕터(광산) - 스테이지
  const chapterStart = f => f - f % IDLE.STAGES;
  const stageNo = f => `${Math.floor(f / IDLE.STAGES) + 1}-${f % IDLE.STAGES + 1}`;
  const maxDur = st => stat.dur(st.lv.dur || 0);
  // 곡괭이가 부러짐 → 그 챕터 첫 스테이지(x-1)로 돌아가서 다시 사냥
  function breakPick(st) { st.floor = chapterStart(st.floor); st.kills = 0; st.dur = maxDur(st); st.breaks = (st.breaks || 0) + 1; }                                   // 5층마다 S급 보스 = 더 단단한 벽
  const bossHp = f => Math.round(mobHp(f) * BAL.BX * (isSBoss(f) ? BAL.SX : 1));

  function newState() {
    return { gold: 0, floor: 0, kills: 0, best: 0, lv: { atk: 0, spd: 0, gem: 0, chest: 0, coin: 0, cells: 0, dur: 0 }, dur: 100, auto: true, dex: {}, lastSeen: Date.now(), totalKills: 0, bossWins: 0, bossFails: 0, breaks: 0 };
  }
  const canBuy = (st, k) => st.lv[k] < UP[k].max && st.gold >= Math.ceil(UP[k].cost(st.lv[k]));
  function buy(st, k) {
    if (!canBuy(st, k)) return false;
    st.gold -= Math.ceil(UP[k].cost(st.lv[k]));
    st.lv[k]++;
    return true;
  }

  // ---------- 슬롯 ----------
  function weights(st) {
    return [['pick', SYMS.pick.w], ['tnt', SYMS.tnt.w], ['gem', stat.gemW(st.lv.gem)], ['coin', SYMS.coin.w], ['chest', stat.chestW(st.lv.chest)]];
  }
  function pickW(rng, list) {
    let t = 0; for (const e of list) t += e[1];
    let x = rng() * t;
    for (const e of list) { x -= e[1]; if (x < 0) return e[0]; }
    return list[list.length - 1][0];
  }
  // held[i] 가 true 인 칸은 prev 그대로
  function roll(st, rng, prev, held) {
    const n = stat.cells(st.lv.cells), w = weights(st), out = [];
    for (let i = 0; i < n; i++) out.push(prev && held && held[i] ? prev[i] : pickW(rng, w));
    return out;
  }
  // 슬롯 결과 → 대미지
  function evalSpin(st, syms) {
    const atk = stat.atk(st.lv.atk), gemX = stat.gemX(st.lv.gem), chestX = stat.chestX(st.lv.chest);
    let hits = 0, chests = 0, coins = 0;
    const cnt = {};
    for (const s of syms) {
      cnt[s] = (cnt[s] || 0) + 1;
      if (s === 'pick') hits += 1;
      else if (s === 'tnt') hits += 2;
      else if (s === 'gem') hits += gemX;
      else if (s === 'chest') chests++;
      else if (s === 'coin') coins++;
    }
    let best = 0, bestSym = null;
    for (const [s, n] of Object.entries(cnt)) if (n > best) { best = n; bestSym = s; }
    const combo = COMBO[best] || 1;
    const chestMult = Math.pow(chestX, chests);
    if (hits === 0) hits = 0.5;                                     // 빈손이어도 살짝
    const dmg = Math.max(1, Math.round(atk * hits * combo * chestMult));
    return { atk, hits, combo, comboSym: combo > 1 ? bestSym : null, comboN: best, chests, chestMult, coins, dmg };
  }
  const coinGold = (st, coins) => Math.ceil(coins * killGold(st.floor) * 0.3 * stat.coinX(st.lv.coin));
  const goldPerKill = st => Math.ceil(killGold(st.floor) * stat.coinX(st.lv.coin));

  // 평균 초당 대미지 (몬테카를로)
  function avgDmg(st, n = 600) {
    let seed = 12345; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let tot = 0, coins = 0;
    for (let i = 0; i < n; i++) { const r = evalSpin(st, roll(st, rng)); tot += r.dmg; coins += r.coins; }
    return { dmg: tot / n, coins: coins / n };
  }
  // 초당 광석 (자동 사냥 기준)
  function goldPerSec(st) {
    const a = avgDmg(st), aps = stat.aps(st.lv.spd), hp = mobHp(st.floor);
    const attacksPerKill = Math.max(1, Math.ceil(hp / Math.max(1, a.dmg)));
    const killTime = attacksPerKill / aps + IDLE.RESPAWN;
    return goldPerKill(st) / killTime + a.coins * aps * coinGold(st, 1);
  }
  // 접속 안 한 동안 쌓인 광석
  function offline(st, now = Date.now()) {
    const sec = Math.min(IDLE.OFFLINE_MAX, Math.max(0, (now - (st.lastSeen || now)) / 1000));
    if (sec < 60) return { sec, gold: 0 };
    return { sec, gold: Math.floor(goldPerSec(st) * sec * IDLE.OFFLINE_RATE) };
  }

  // 몬스터 한 마리 처치 → 광석. 보스 문 열림 여부
  function onKill(st) {
    const g = goldPerKill(st);
    st.gold += g; st.totalKills++;
    st.dur = Math.min(maxDur(st), st.dur + maxDur(st) * IDLE.REGEN);
    if (st.kills < IDLE.KILLS) st.kills++;
    return g;
  }
  const bossReady = st => st.kills >= IDLE.KILLS;
  function bossLose(st) { st.kills = 0; st.bossFails++; st.dur = maxDur(st); }
  function bossWin(st) {
    st.floor++; st.kills = 0; st.bossWins++; st.dur = maxDur(st);
    st.best = Math.max(st.best, st.floor);
    const g = killGold(st.floor) * 10;
    st.gold += g;
    return g;
  }

  // ---------- 층 → 광산(카드 묶음) · 몬스터 ----------
  const FLOORS_PER_MINE = 5;
  function mineOf(C, f) {
    const keys = Object.keys(C.TIERS).sort((a, b) => a - b);
    return keys[Math.min(keys.length - 1, Math.floor(f / FLOORS_PER_MINE))];
  }
  function mobCard(C, f, rng, boss) {
    const tier = mineOf(C, f), inMine = f % FLOORS_PER_MINE;
    const grade = boss ? (inMine === FLOORS_PER_MINE - 1 ? 'S' : ['C', 'B', 'B', 'A'][inMine]) : ['F', 'E', 'D'][Math.floor(rng() * 3)];
    const list = C.TIERS[tier].cards[grade];
    const idx = Math.floor(rng() * list.length);
    return { ...list[idx], tier, grade, idx };
  }

  root.Idle = { IDLE, BAL, isSBoss, mobAtk, bossAtk, chapterStart, stageNo, maxDur, breakPick, bossLose, SYMS, COMBO, UP, stat, mobHp, killGold, bossHp, newState, canBuy, buy, roll, evalSpin, coinGold, goldPerKill, avgDmg, goldPerSec, offline, onKill, bossReady, bossWin, mineOf, mobCard, FLOORS_PER_MINE };
})(typeof window !== 'undefined' ? window : globalThis);
