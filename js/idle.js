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
    BOSS_X: 8.5,               // 보스 체력 = 그 층 몬스터 체력 × 2.5 (공격 8번 안에 잡아야 하므로 이 정도가 첫판 승률 ~50%)
    BOSS_REROLLS: 3,           // 보스전 다시 돌리기 횟수
    MOB_HIT: 1.5,              // 일반 몬스터가 반격하는 간격(초)
    REGEN: 0.15,               // 몬스터를 잡을 때마다 내구도 회복(최대치의 15%)
    STAGES: 5,                 // 챕터(광산)마다 스테이지 수: 1-1 ~ 1-5
    RESPAWN: 0.35,             // 몬스터가 다시 나오기까지(초)
    GAUGE: 8,                  // 평소엔 곡괭이가 그냥 때림. 이만큼 때리면 슬롯 게이지가 꽉 참 → 큰 슬롯 한 번
    AUTO_PULL: 2.5,            // 게이지가 찬 뒤 이 시간(초) 안에 안 당기면 자동으로 당김
    SLOT_TIME: 2.2,            // 큰 슬롯 한 번에 걸리는 시간(초, 연출 포함 · 밸런스 계산용)
  };
  const SLOT_X = +(globalThis.process && process.env.SLOTX) || 3;
  const BASIC = +(globalThis.process && process.env.BASIC) || 1;     // 평소 한 대 = 슬롯 평균(잭팟·미믹 뺀) × 이 값 → 보석·상자 강화도 평타에 반영   // 큰 슬롯 대미지 배율 (가끔 오는 만큼 크게)
  // 슬롯 심볼: w = 나오는 비중, hit = 기본 타수, u = 해금 스테이지(최고 기록이 이 층 이상이면 슬롯에 등장)
  //  칸의 '위치'가 의미를 가짐: 💣은 양옆 칸 효과 2배, 🌈은 가장 많은 그림으로 변신
  const SYMS = {
    pick:  { name: '곡괭이', w: 40, hit: 1, u: 0, desc: '1타' },
    tnt:   { name: 'TNT', w: 12, hit: 2, u: 0, desc: '2타 · 양옆 칸 효과 2배' },
    gem:   { name: '보석', w: 10, hit: 0, u: 0, desc: '크리티컬 (강화로 타수 증가)' },
    coin:  { name: '코인', w: 10, hit: 0, u: 0, desc: '광석 획득' },
    chest: { name: '보물상자', w: 3, hit: 0, u: 0, desc: '대미지 배율' },
    wrench:{ name: '렌치', w: 6, hit: 0, u: 1, desc: '곡괭이 내구도 12% 수리' },
    glass: { name: '모래시계', w: 4, hit: 0, u: 2, desc: '한 번 더 공격 · 보스는 반격 못 함' },
    rainbow:{ name: '무지개', w: 4, hit: 0, u: 4, desc: '가장 많은 그림으로 변신 (콤보 만들기)' },
    egg:   { name: '용의 알', w: 5, hit: 0, u: 6, desc: '금이 30번 가면 새끼 용 부화 → 30번 동안 대미지 ×2' },
    mimic: { name: '미믹', w: 3, hit: 0, u: 8, desc: '70% 큰 배율 · 30% 곡괭이를 깨물어 내구도 -25%' },
    gold:  { name: '황금 곡괭이', w: 0, hit: 1, u: 0, desc: '3개 잭팟 · 4개 메가 잭팟 · 5개 그랜드 잭팟!' },
  };
  const COMBO = { 3: 2, 4: 4, 5: 10 };   // 같은 그림 n개 → 대미지 ×
  // 잭팟은 자주 터져야 재미 → 칸 수와 상관없이 약 80번에 한 번 꼴이 되도록 황금 곡괭이 비율을 칸 수에 맞춤
  //  (3칸이면 3개가 다 나와야 하니 비율을 높게, 5칸이면 낮게). 대신 3개 잭팟의 배율은 적당히, 4·5개는 아주 크게
  const JACKPOT = { 3: 10, 4: 30, 5: 100 };   // 황금 곡괭이 n개 → 콤보 대신 이 배율
  const JACK_SEC = { 3: 10, 4: 120, 5: 600 };  // 잭팟 광석 = 몇 초치 수입
  const GOLD_P = { 3: 0.4, 4: 0.25, 5: 0.19 }; // 슬롯 칸 수 → 황금 곡괭이가 나올 비율
  const EGG_N = 5, DRAGON_T = 30, DRAGON_X = 2, MIMIC_OK = 0.7, MIMIC_BITE = 0.25, WRENCH = 0.12;
  // 무지개가 여럿이 같은 개수일 때 우선 변신할 그림 (좋은 것부터)
  const WILD_PRI = ['gold', 'chest', 'gem', 'tnt', 'mimic', 'egg', 'glass', 'wrench', 'pick', 'coin'];

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
  const BAL = { HPB: env('HPB', 70), HPG: env('HPG', 1.22), HPE: env('HPE', 1.30), EF: env('EF', 20), GG: env('GG', 1.15), KG: env('KG', 2), BX: env('BX', IDLE.BOSS_X), SX: env('SX', 1.6) };
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
    return { egg: 0, dragon: 0, jackpots: 0, gold: 0, floor: 0, kills: 0, best: 0, lv: { atk: 0, spd: 0, gem: 0, chest: 0, coin: 0, cells: 0, dur: 0 }, dur: 100, auto: true, dex: {}, lastSeen: Date.now(), totalKills: 0, bossWins: 0, bossFails: 0, breaks: 0 };
  }
  const canBuy = (st, k) => st.lv[k] < UP[k].max && st.gold >= Math.ceil(UP[k].cost(st.lv[k]));
  function buy(st, k) {
    if (!canBuy(st, k)) return false;
    st.gold -= Math.ceil(UP[k].cost(st.lv[k]));
    st.lv[k]++;
    return true;
  }

  // ---------- 슬롯 ----------
  const unlocked = st => Object.keys(SYMS).filter(k => (st.best || 0) >= SYMS[k].u);
  function weights(st) {
    const list = unlocked(st).filter(k => k !== 'gold').map(k => [k, k === 'gem' ? stat.gemW(st.lv.gem) : k === 'chest' ? stat.chestW(st.lv.chest) : SYMS[k].w]);
    if ((st.best || 0) >= SYMS.gold.u) {
      const tot = list.reduce((a, e) => a + e[1], 0), p = GOLD_P[stat.cells(st.lv.cells)] || 0.1;
      list.push(['gold', tot * p / (1 - p)]);
    }
    return list;
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
  // 🌈 → 가장 많은 그림(같으면 좋은 그림)으로 바꾼 결과. 전부 무지개면 황금 곡괭이(= 잭팟)
  function resolveWild(syms) {
    const cnt = {};
    syms.forEach(s => { if (s !== 'rainbow') cnt[s] = (cnt[s] || 0) + 1; });
    let to = 'gold', best = 0;
    for (const k of WILD_PRI) if ((cnt[k] || 0) > best) { best = cnt[k]; to = k; }
    return syms.map(s => s === 'rainbow' ? to : s);
  }
  // 슬롯 결과 → 대미지와 효과
  //   rng 를 주면 미믹이 착한지(70%) 지금 정함. 안 주면(미리보기) 미정
  function evalSpin(st, syms, rng) {
    const atk = stat.atk(st.lv.atk), gemX = stat.gemX(st.lv.gem), chestX = stat.chestX(st.lv.chest);
    const res = resolveWild(syms), n = res.length;
    // 💣 TNT: 양옆 칸 효과 2배 (TNT 두 개 사이에 끼면 4배)
    const f = res.map(() => 1);
    res.forEach((s, i) => { if (s === 'tnt') { if (i > 0) f[i - 1] *= 2; if (i < n - 1) f[i + 1] *= 2; } });
    let hits = 0, chests = 0, chestMult = 1, coins = 0, repair = 0, respins = 0, cracks = 0, mimics = 0, mimicMult = 1;
    const cnt = {};
    const mimicOk = rng ? rng() < MIMIC_OK : null;
    res.forEach((s, i) => {
      cnt[s] = (cnt[s] || 0) + 1;
      const k = f[i];
      if (s === 'pick' || s === 'tnt' || s === 'gold') hits += SYMS[s].hit * k;
      else if (s === 'gem') hits += gemX * k;
      else if (s === 'chest') { chests++; chestMult *= chestX * k; }
      else if (s === 'coin') coins += k;
      else if (s === 'wrench') repair += WRENCH * k;
      else if (s === 'glass') respins += k;
      else if (s === 'egg') cracks += k;
      else if (s === 'mimic') { mimics++; if (mimicOk) mimicMult *= chestX * 3 * k; }
    });
    let best = 0, bestSym = null;
    for (const s of WILD_PRI) if ((cnt[s] || 0) > best) { best = cnt[s]; bestSym = s; }
    const jackpot = (cnt.gold || 0) >= 3;
    const combo = jackpot ? JACKPOT[Math.min(5, cnt.gold)] : (COMBO[best] || 1);
    const dragon = (st.dragon || 0) > 0;
    if (hits === 0) hits = 0.5;                                     // 빈손이어도 살짝
    const dmg = Math.max(1, Math.round(atk * hits * combo * chestMult * mimicMult * (dragon ? DRAGON_X : 1) * SLOT_X));
    const boosted = f.map(x => x > 1);
    return { atk, hits, combo, comboSym: combo > 1 ? (jackpot ? 'gold' : bestSym) : null, comboN: jackpot ? cnt.gold : best, chests, chestMult, coins, dmg,
      res, boosted, repair, respins, cracks, mimics, mimicOk: mimics ? mimicOk : null, mimicMult, dragon, jackpot };
  }
  // 평소 공격(슬롯 없이 곡괭이로 한 대): hit() 연출이 그대로 쓰도록 슬롯 결과와 같은 모양으로
  function basicHit(st, base) {
    const atk = stat.atk(st.lv.atk), dragon = (st.dragon || 0) > 0;
    return { basic: true, atk, hits: 1, combo: 1, comboSym: null, comboN: 1, chests: 0, chestMult: 1, coins: 0, dmg: Math.max(1, Math.round(base * BASIC * (dragon ? DRAGON_X : 1))),
      res: [], boosted: [], repair: 0, respins: 0, cracks: 0, mimics: 0, mimicOk: null, mimicMult: 1, dragon, jackpot: false };
  }
  // 공격 뒤 효과 적용: 수리 · 미믹 물기 · 알 금 · 용 · 잭팟 광석.  반환: { bite, hatched, jackGold }
  function applySpin(st, r) {
    const mx = maxDur(st), out = { bite: 0, hatched: false, jackGold: 0 };
    if (r.repair) st.dur = Math.min(mx, st.dur + mx * r.repair);
    if (r.mimics && r.mimicOk === false) { out.bite = Math.round(mx * MIMIC_BITE); st.dur -= out.bite; }
    if (r.dragon) st.dragon = Math.max(0, st.dragon - 1);
    if (r.cracks) {
      st.egg = (st.egg || 0) + r.cracks;
      if (st.egg >= EGG_N) { st.egg -= EGG_N; st.dragon = (st.dragon || 0) + DRAGON_T; out.hatched = true; }
    }
    if (r.jackpot) { out.jackGold = Math.ceil(goldPerSec(st) * JACK_SEC[Math.min(5, r.comboN)]); st.gold += out.jackGold; st.jackpots = (st.jackpots || 0) + 1; }
    return out;
  }
  const coinGold = (st, coins) => Math.ceil(coins * killGold(st.floor) * 0.3 * stat.coinX(st.lv.coin));
  const goldPerKill = st => Math.ceil(killGold(st.floor) * stat.coinX(st.lv.coin));

  // 평균 초당 대미지 (몬테카를로)
  function avgDmg(st, n = 600) {
    let seed = 12345; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let tot = 0, coins = 0;
    const s2 = Object.assign({}, st, { dragon: 0 });               // 용은 잠깐이라 평균에서 뺌
    let base = 0;
    for (let i = 0; i < n; i++) { const r = evalSpin(s2, roll(s2, rng), rng); tot += r.dmg * (1 + r.respins); coins += r.coins; base += r.dmg / SLOT_X / (r.jackpot ? r.combo : 1) / r.mimicMult; }
    base /= n;
    // 공격 한 번당 평균 = 평소 한 대 + 큰 슬롯 몫(GAUGE 번에 한 번)
    return { dmg: base * BASIC + tot / n / IDLE.GAUGE, coins: coins / n / IDLE.GAUGE, slot: tot / n, base };
  }
  // 초당 광석 (자동 사냥 기준)
  function goldPerSec(st) {
    const a = avgDmg(st), aps = stat.aps(st.lv.spd), hp = mobHp(st.floor);
    const attacksPerKill = Math.max(1, Math.ceil(hp / Math.max(1, a.dmg)));
    const killTime = attacksPerKill * (1 / aps + IDLE.SLOT_TIME / IDLE.GAUGE) + IDLE.RESPAWN;
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

  root.Idle = { SLOT_X, basicHit, weights, EGG_N, DRAGON_T, DRAGON_X, unlocked, resolveWild, applySpin, JACKPOT, IDLE, BAL, isSBoss, mobAtk, bossAtk, chapterStart, stageNo, maxDur, breakPick, bossLose, SYMS, COMBO, UP, stat, mobHp, killGold, bossHp, newState, canBuy, buy, roll, evalSpin, coinGold, goldPerKill, avgDmg, goldPerSec, offline, onKill, bossReady, bossWin, mineOf, mobCard, FLOORS_PER_MINE };
})(typeof window !== 'undefined' ? window : globalThis);
