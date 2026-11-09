// =====================================================
//  곡괭이 키우기 (방치형) — 계산만 하는 엔진 (화면과 무관, tools/sim/sim_idle.js 에서도 그대로 실행)
//   곡괭이가 자동으로 몬스터를 때림. 평타 8번마다 '광맥 탐지'(3~5칸) 한 번 = 큰 한 방
//   탐지 칸 4종 (docs/slot-4.md): 광석은 더하기 · 💣 TNT는 곱하기 · ⭐ 황금 3개 이상 = 황금 광맥(×10 + 관통)
// =====================================================
(function (root) {
  const IDLE = {
    // 스테이지 v2 (docs/stages-v2.md): 스테이지 1개 = 몬스터 1마리. 챕터 10스테이지, x-5 중간 보스, x-10 챕터 보스
    OFFLINE_MAX: 8 * 3600,     // 접속 안 해도 쌓이는 최대 시간(초)
    OFFLINE_RATE: 0.5,         // 자리 비운 동안은 평소의 50%
    BOSS_X: 5,               // 보스 체력 = 그 층 몬스터 체력 × 2.5 (공격 8번 안에 잡아야 하므로 이 정도가 첫판 승률 ~50%)
    BOSS_REROLLS: 3,           // 보스전 '준비' 횟수 (다시 탐지 또는 수리에 나눠 씀)
    MOB_HIT: 1.5,              // 일반 몬스터가 반격하는 간격(초)
    REGEN: +(globalThis.process && process.env.REGEN) || 0.25,              // 몬스터를 잡을 때마다 내구도 회복(최대치의 25%)
    STAGES: 10,                // 챕터(광산)마다 스테이지 수: 1-1 ~ 1-10
    SC: +(globalThis.process && process.env.SC) || 0.5,   // 스테이지 → 밸런스 단계 환산 (스테이지 2개 = 예전 1층 만큼 세짐)
    RESPAWN: 0.35,             // 몬스터가 다시 나오기까지(초)
    GAUGE: 8,                  // 평소엔 곡괭이가 그냥 때림. 이만큼 때리면 게이지가 꽉 참 → 광맥 탐지 한 번
    AUTO_PULL: 0,              // 게이지가 차면 바로 자동으로 돌아감 (터치 필요 없음)
    SLOT_TIME: 1.9,            // 광맥 탐지 한 번에 걸리는 시간(초, 연출 포함 · 밸런스 계산용)
    PIERCE: 9,                 // 황금 광맥 관통 (docs/jackpot-pierce.md): 최대 몇 마리 — 보스 앞에서 멈추므로 사실상 '보스 앞까지'
  };
  const env0 = k => globalThis.process && process.env[k];
  const SLOT_X = +env0('SLOTX') || 6;            // 탐지 피해 배율 (가끔 오는 만큼 크게 · 시뮬로 맞춤)
  const BASIC = +env0('BASIC') || 1;             // 평소 한 대 = 탐지 평균(황금 광맥 뺀) × 이 값 → 보석·TNT 강화도 평타에 반영
  // 탐지 그림 4종: hit = 더하는 피해(공격력 ×). 보석 값은 GEM_V (사다리·강화)
  const SYMS = {
    stone: { name: '돌', hit: 1, desc: '피해를 더해요 (공격력 ×1)' },
    gem:   { name: '다이아', hit: 0, desc: '피해를 크게 더해요 (공격력 ×3)' },
    tnt:   { name: 'TNT', hit: 1, desc: '피해 ×1을 더하고 · 전체 피해 ×2' },
    gold:  { name: '황금 곡괭이', hit: 1, desc: '3개 이상이면 황금 광맥! 피해 ×10 + 다음 몬스터 관통' },
  };
  // 칸 수별 그림 비중 (돌·보석·TNT·황금 %) — 칸이 늘면 보석·황금 완성 기회가 같이 좋아짐
  const W4 = { 3: [35, 15, 10, 40], 4: [39, 22, 10, 29], 5: [40, 27, 10, 23] };
  // 보석 사다리: 그림 수는 그대로, 보석 자리만 더 비싼 광석으로 교체 (보스 보상)
  const LADDER = [ { at: 0, name: '다이아', icon: 'assets/blocks/diamond.png', v: 3 },
                   { at: 20, name: '루비', icon: 'assets/blocks/ruby.png', v: 4 },        // 2-10 보스를 잡으면
                   { at: 40, name: '흑요석', icon: 'assets/blocks/obsidian.png', v: 5 } ]; // 4-10 보스를 잡으면
  const ladderOf = st => { const b = Math.max(st.best || 0, st.allBest || 0); let L = LADDER[0]; for (const x of LADDER) if (b >= x.at) L = x; return L; };
  const TNT_X = st => 2 + 0.025 * ((st.lv && st.lv.chest) || 0) + abil.tnt(st);   // TNT 곱하기: 강화 'TNT 화력' + 폭파 곡괭이
  const GEM_V = st => ladderOf(st).v + 0.25 * ((st.lv && st.lv.gem) || 0) + abil.gem(st);   // 보석 한 칸 = 공격력 × 이만큼
  const JACKPOT = 10;      // 황금 광맥 배율
  const JACK_SEC = 10;     // 황금 광맥 광석 = 몇 초치 수입
  const KILL_X = +env0('KILL4') || 2;   // 처치 광석 배율 (예전 코인 칸 몫)

  // 강화: cost(lv) = 다음 레벨 가격, max = 최대 레벨
  const UP = {
    atk:   { name: '곡괭이 공격력', icon: 'pick3', max: 1e9, cost: lv => 5 * Math.pow(1.13, lv) },
    spd:   { name: '휘두르기 속도', icon: 'spin', max: 20, cost: lv => 40 * Math.pow(1.55, lv) },
    gem:   { name: '보석 감정', icon: 'gem', max: 40, cost: lv => 60 * Math.pow(1.28, lv) },
    chest: { name: 'TNT 화력', icon: 'tnt', max: 40, cost: lv => 150 * Math.pow(1.3, lv) },   // 저장 키는 예전 이름(chest) 그대로
    coin:  { name: '광석 수집', icon: 'coin', max: 1e9, cost: lv => 30 * Math.pow(1.2, lv) },
    cells: { name: '탐지 칸 늘리기', icon: 'slot', max: 2, cost: lv => [400, 30000][lv] },
    dur:   { name: '곡괭이 내구도', icon: 'dur', max: 1e9, cost: lv => 8 * Math.pow(1.14, lv) },
  };
  // 💠 광맥 결정: 환생할 때 받음. 지금까지 받은 결정 1개당 대미지·광석 +2%(써도 유지), 상점에서 영구 강화
  const CUP = {
    pow:  { name: '광맥의 힘', icon: '⛏', desc: '모든 대미지 +25%', cost: lv => Math.ceil(2 * Math.pow(1.5, lv)) },
    rich: { name: '광맥의 부', icon: '🪙', desc: '모든 광석 +25%', cost: lv => Math.ceil(2 * Math.pow(1.5, lv)) },
    grip: { name: '단단한 손잡이', icon: '🛠️', desc: '곡괭이 내구도 +20%', cost: lv => Math.ceil(3 * Math.pow(1.6, lv)) },
    rest: { name: '긴 휴식', icon: '💤', desc: '방치 보상 최대 +2시간', cost: lv => Math.ceil(5 * Math.pow(2, lv)), max: 8 },
  };
  const cLv = (st, k) => (st.cup && st.cup[k]) || 0;
  const holdX = st => 1 + (+(globalThis.process && process.env.HOLD) || 0.02) * (st.cTotal || 0);   // 지금까지 받은 결정 총량 기준 → 상점에 써도 줄지 않음
  const dmgX = st => holdX(st) * (1 + 0.25 * cLv(st, 'pow'));
  const goldX = st => holdX(st) * (1 + 0.25 * cLv(st, 'rich')) * abil.gold(st);

  // ---------- ⛏ 곡괭이 합성 v2 (docs/pickaxe-merge-v2.md) ----------
  //  곡괭이 = 종류(능력) × 등급(공격력). 같은 종류·같은 등급 2개 → 다음 등급. 무지개 다음은 ★로 끝없이
  //  곡괭이 하나 = { t: 종류 0~4, g: 등급 0~ }
  const PICK = {
    SLOTS: 20, X: +(globalThis.process && process.env.PX) || 1.5,      // 등급마다 공격력 ×1.5
    DROP: +(globalThis.process && process.env.PDROP) || 0.012,         // 일반 처치 시 떨어질 확률
    JACK: 0.05,                                                         // 황금 광맥 때 (황금 4개 이상이면 확정 +1등급)
    FRAG: 10,                                                           // 조각 10개 → 나무 곡괭이 1개 (종류 선택)
    BOX_UP: 0.15,                                                       // 상자에서 한 등급 높은 게 나올 확률
    grades: ['나무', '구리', '철', '황금', '크리스탈', '용암', '번개', '무지개'],
    types: [
      { k: 'bomb', e: '💣', name: '폭파', c: '#ff7a3a' },
      { k: 'gem', e: '💎', name: '보석', c: '#4fc8ff' },
      { k: 'luck', e: '⭐', name: '행운', c: '#ffd34a' },
      { k: 'smith', e: '🔧', name: '장인', c: '#7fe07a' },
      { k: 'miner', e: '🪙', name: '광부', c: '#e0a060' },
    ],
  };
  const gradeName = g => g < 8 ? PICK.grades[g] : `무지개★${g - 7}`;
  const pickName = p => `${PICK.types[p.t].e} ${gradeName(p.g)} ${PICK.types[p.t].name} 곡괭이`;
  // 종류별 능력: 등급이 높을수록 강해짐
  const abil = {
    tnt: st => { const e = st.eq; return e && e.t === 0 ? Math.min(1, 0.1 * (e.g + 1)) : 0; },
    gem: st => { const e = st.eq; return e && e.t === 1 ? 0.5 * (e.g + 1) : 0; },
    luck: st => { const e = st.eq; return e && e.t === 2 ? Math.min(2, 1 + 0.06 * (e.g + 1)) : 1; },
    dur: st => { const e = st.eq; return e && e.t === 3 ? 1 + 0.1 * (e.g + 1) : 1; },
    rep: st => { const e = st.eq; return e && e.t === 3 ? 1 + 0.15 * (e.g + 1) : 1; },
    gold: st => { const e = st.eq; return e && e.t === 4 ? 1 + 0.15 * (e.g + 1) : 1; },
  };
  function abilText(p) {
    const g = p.g + 1;
    return [`TNT 곱하기 +${+Math.min(1, 0.1 * g).toFixed(2)}`, `보석 +${+(0.5 * g).toFixed(1)}`, `황금 광맥 확률 ×${+Math.min(2, 1 + 0.06 * g).toFixed(2)}`,
      `내구도 +${Math.round(10 * g)}% · 처치 회복 ×${+(1 + 0.15 * g).toFixed(2)}`, `광석 +${Math.round(15 * g)}%`][p.t];
  }
  // 도감: 5종 × 8등급, 처음 만든 칸마다 공격력 +2%
  const dexCount = st => Object.keys(st.pkDex || {}).length;
  const pickMult = st => Math.pow(PICK.X, st.eq ? st.eq.g : 0) * (1 + 0.02 * dexCount(st));
  function noteDex(st, p) {
    st.pkDex = st.pkDex || {}; st.pkStar = st.pkStar || {};
    let fresh = false;
    if (p.g < 8 && !st.pkDex[`${p.t}:${p.g}`]) { st.pkDex[`${p.t}:${p.g}`] = 1; fresh = true; }
    st.pkStar[p.t] = Math.max(st.pkStar[p.t] || 0, p.g);
    return fresh;
  }
  // 떨어지는 등급: 10챕터(50스테이지)마다 +1 (최대 철)
  const dropGrade = f => Math.min(2, Math.floor(f / 100));
  function addPick(st, p) {
    let i = st.picks.indexOf(null);
    if (i < 0) { autoMerge(st); i = st.picks.indexOf(null); }
    if (i < 0) return false;
    st.picks[i] = p; noteDex(st, p);
    return true;
  }
  const same = (a, b) => a && b && a.t === b.t && a.g === b.g;
  // 두 칸 합치기 (같은 종류·같은 등급) → 결과 곡괭이, 안 되면 null
  function mergePicks(st, a, b) {
    const A = st.picks[a], B = st.picks[b];
    if (a === b || !same(A, B)) return null;
    const n = { t: A.t, g: A.g + 1 };
    st.picks[a] = null; st.picks[b] = n; noteDex(st, n);
    return n;
  }
  // 낮은 등급부터 같은 것끼리 전부 합침 → 새로 만든 곡괭이 목록
  function autoMerge(st) {
    const made = [];
    for (let guard = 0; guard < 500; guard++) {
      let pair = null;
      for (let i = 0; i < st.picks.length && !pair; i++) {
        if (!st.picks[i]) continue;
        for (let j = i + 1; j < st.picks.length; j++) if (same(st.picks[i], st.picks[j])) { pair = [i, j]; break; }
      }
      if (!pair) break;
      // 가장 낮은 등급 짝부터
      let best = pair;
      for (let i = 0; i < st.picks.length; i++) for (let j = i + 1; j < st.picks.length; j++)
        if (same(st.picks[i], st.picks[j]) && st.picks[i].g < st.picks[best[0]].g) best = [i, j];
      made.push(mergePicks(st, best[0], best[1]));
    }
    return made;
  }
  // 장착: 칸 i 의 곡괭이와 지금 낀 곡괭이를 바꿈
  function equipPick(st, i) {
    const p = st.picks[i]; if (!p) return false;
    st.picks[i] = st.eq || null; st.eq = p;
    return true;
  }
  const randPick = (st, rng, up) => ({ t: Math.floor(rng() * PICK.types.length), g: dropGrade(st.floor) + (up || 0) });
  // 몬스터·잭팟 드롭 → 얻은 곡괭이 or null.  강적 보스는 상자(st.boxes)
  function rollDrop(st, rng, kind) {
    if (kind === 'boss') {
      // 처음 하는 사람: 1-5 · 1-10 보스에서 ⭐행운 나무 곡괭이 확정 → 3분 안에 첫 합성 경험 (docs/onboarding.md)
      if (!(st.rb > 0) && (st.floor === 4 || st.floor === 9) && st.floor >= (st.best || 0) && (st.starter || 0) < 2) {
        const p = { t: 2, g: 0 }; if (addPick(st, p)) { st.starter = (st.starter || 0) + 1; return p; }
      }
      if (st.floor >= (st.best || 0) && isSBoss(st.floor)) { st.boxes = (st.boxes || 0) + 1; return 'box'; }
      return null;
    }
    const pr = kind === 'mega' ? 1 : kind === 'jack' ? PICK.JACK : PICK.DROP;
    if (rng() >= pr) return null;
    const p = randPick(st, rng, kind === 'mega' ? 1 : 0);
    return addPick(st, p) ? p : null;
  }
  // 🎁 곡괭이 상자: 광석으로 사거나(가격은 깊이·구매 수에 따라) 강적 보스에게서 받음
  const boxPrice = st => Math.ceil(killGold(st.floor) * 30 * Math.pow(1.1, st.boxN || 0));
  function openBox(st, rng, buy) {
    if (!st.picks.includes(null)) { autoMerge(st); if (!st.picks.includes(null)) return null; }
    if (buy) { const c = boxPrice(st); if (st.gold < c) return null; st.gold -= c; st.boxN = (st.boxN || 0) + 1; }
    else { if (!(st.boxes > 0)) return null; st.boxes--; }
    const p = randPick(st, rng, rng() < PICK.BOX_UP ? 1 : 0);
    addPick(st, p);
    return p;
  }
  // 판매 · 분해 · 제작 (별 등급은 숫자가 너무 커지지 않게 2^등급을 2^12 에서 멈춤)
  const pw = g => Math.pow(2, Math.min(12, g));
  const sellPrice = (st, p) => Math.ceil(killGold(st.floor) * 20 * pw(p.g));
  function sellPick(st, i) { const p = st.picks[i]; if (!p) return 0; const v = sellPrice(st, p); st.gold += v; st.picks[i] = null; return v; }
  function scrapPick(st, i) { const p = st.picks[i]; if (!p) return 0; const v = 3 * pw(p.g); st.frags = (st.frags || 0) + v; st.picks[i] = null; return v; }
  function craftPick(st, t) {
    if ((st.frags || 0) < PICK.FRAG || !st.picks.includes(null)) return null;
    st.frags -= PICK.FRAG; const p = { t, g: 0 }; addPick(st, p); return p;
  }
  // v1 저장(곡괭이 = 등급 숫자) → v2(종류 × 등급). 기존 곡괭이는 종류 무작위, 장착 중이던 건 ⭐행운
  function migratePicks(st, rng) {
    if (typeof st.eq === 'number') st.eq = { t: 2, g: st.eq };
    if (!st.eq) st.eq = { t: 2, g: 0 };
    const old = (st.picks || []).map(x => typeof x === 'number' ? { t: Math.floor(rng() * 5), g: x } : x);
    st.picks = Array(PICK.SLOTS).fill(null);
    old.filter(Boolean).slice(0, PICK.SLOTS).forEach((p, i) => st.picks[i] = p);
    noteDex(st, st.eq); st.picks.forEach(p => p && noteDex(st, p));
  }
  const ATB = +(globalThis.process && process.env.ATB) || 5;   // 공격력 시작값
  // 강화 레벨 → 실제 수치
  const stat = {
    atk: lv => ATB + lv,                                                // 강화로 오르는 기본 공격력 (곡괭이 등급 배율은 atkOf 에서 곱함)
    aps: lv => 0.8 + 0.08 * lv,                                         // 초당 공격
    coinX: lv => 1 + 0.2 * lv,
    cells: lv => 3 + lv,
    dur: lv => Math.round(100 * Math.pow(+(globalThis.process && process.env.DURG) || 1.062, lv)),   // 곡괭이 내구도(= 체력)
  };
  // 밸런스 숫자 (tools/sim_idle.js 에서 환경변수로 바꿔 시험 가능)
  const env = (k, d) => +(globalThis.process && process.env[k]) || d;
  //  HPE: 초반(EF층까지) 체력 증가율 — 초반엔 강화가 빨리 쌓이므로 체력도 더 빨리 올려야 '한 방 컷'이 안 됨
  const BAL = { HPB: env('HPB', 70), HPG: env('HPG', 1.22), HPE: env('HPE', 1.30), EF: env('EF', 20), GG: env('GG', 1.15), KG: env('KG', 2), BX: env('BX', IDLE.BOSS_X), SX: env('SX', 1.3) };
  // ---------- 💠 환생 ----------
  //  환생 단계(rb)마다 몬스터가 단단해짐. 계산 함수들이 층(f)만 받으므로 지금 판의 단계를 여기 둠
  const RB = { D: +(globalThis.process && process.env.RBD) || 1.1, OPEN: 40, rb: 0 };   // 환생 열림: 5-1 (스테이지 40)
  const setRun = st => { RB.rb = st.rb || 0; };
  const diff = () => Math.pow(RB.D, RB.rb);
  const lx = s => s * IDLE.SC;                     // 스테이지 → 밸런스 단계
  const mobHp = s => { const f = lx(s); return Math.round(diff() * BAL.HPB * Math.pow(BAL.HPE, Math.min(f, BAL.EF)) * Math.pow(BAL.HPG, Math.max(0, f - BAL.EF))); };
  const killGold = s => Math.ceil(BAL.KG * Math.pow(BAL.GG, lx(s)));
  const isBossStage = s => s % 5 === 4;            // x-5 중간 보스 · x-10 챕터 보스
  const isSBoss = s => s % 10 === 9;               // 챕터 보스 = 강적
  // 반격: 일반 몬스터 한 대 · 보스 한 턴 (곡괭이 내구도를 깎음)
  BAL.DA = env('DA', 6); BAL.DG = env('DG', 1.095); BAL.BA = env('BA', 0.9);
  //  처음 두 챕터(10스테이지)는 반격이 약하게 시작해서 서서히 세짐 → 1-1에서 부러지는 일 없게
  const mobAtk = s => { const f = lx(s); return Math.max(1, Math.round(diff() * BAL.DA * Math.pow(BAL.DG, f) * Math.min(1, 0.35 + 0.065 * f))); };
  const bossAtk = f => Math.max(1, Math.round(mobAtk(f) * BAL.BA * (isSBoss(f) ? 1.2 : 1)));
  // 스테이지 번호: 챕터(광산) - 스테이지
  const chapterStart = f => f - f % IDLE.STAGES;
  const stageNo = f => `${Math.floor(f / IDLE.STAGES) + 1}-${f % IDLE.STAGES + 1}`;
  const maxDur = st => Math.round(stat.dur(st.lv.dur || 0) * (1 + 0.2 * cLv(st, 'grip')) * abil.dur(st));
  // 곡괭이가 부러짐 → 그 챕터 첫 스테이지(x-1)로 돌아가서 다시 사냥
  function breakPick(st) { st.floor = chapterStart(st.floor); st.dur = maxDur(st); st.breaks = (st.breaks || 0) + 1; }                                   // 5층마다 S급 보스 = 더 단단한 벽
  const bossHp = f => Math.round(mobHp(f) * BAL.BX * (isSBoss(f) ? BAL.SX : env('MID', 0.75)));   // x-5 중간 보스는 가볍게, x-10 챕터 보스는 벽

  function newState() {
    return { stv: 2, tabs: ['up'], tips: {}, allUp: false, starter: 0, rb: 0, crystals: 0, cup: {}, allBest: 0, start: 0, picks: Array(PICK.SLOTS).fill(null), eq: { t: 2, g: 0 }, pkDex: { '2:0': 1 }, pkStar: {}, frags: 0, boxes: 0, boxN: 0, jackpots: 0, gold: 0, floor: 0, best: 0, lv: { atk: 0, spd: 0, gem: 0, chest: 0, coin: 0, cells: 0, dur: 0 }, dur: 100, auto: true, dex: {}, lastSeen: Date.now(), totalKills: 0, bossWins: 0, bossFails: 0, breaks: 0 };
  }
  const canBuy = (st, k) => st.lv[k] < UP[k].max && st.gold >= Math.ceil(UP[k].cost(st.lv[k]));
  function buy(st, k) {
    if (!canBuy(st, k)) return false;
    st.gold -= Math.ceil(UP[k].cost(st.lv[k]));
    st.lv[k]++;
    return true;
  }

  // ---------- 광맥 탐지 ----------
  const unlocked = () => Object.keys(SYMS);        // 4종은 처음부터 전부 (해금 재미는 보석 사다리로)
  function weights(st) {
    const n = stat.cells(st.lv.cells), w = W4[n] || W4[3];
    const gem = w[1] * (1 + 0.02 * (st.lv.gem || 0)), base = w[0] + gem + w[2];
    const p = Math.min(0.6, w[3] / 100 * abil.luck(st));            // 황금이 나올 비율 (행운 곡괭이로 ↑)
    return [['stone', w[0]], ['gem', gem], ['tnt', w[2]], ['gold', base * p / (1 - p)]];
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
  // 탐지 결과 → 피해: 칸 피해를 다 더하고 → TNT마다 ×2 → 황금 3개 이상이면 ×10
  //  화면은 cellDmg(칸별)·base(곱하기 전 합)·tntMult 를 그대로 보여 줌 (따로 계산하지 않게)
  function evalSpin(st, syms) {
    const atk = stat.atk(st.lv.atk) * pickMult(st) * dmgX(st), gv = GEM_V(st), tx = TNT_X(st);
    const res = syms.slice(), val = res.map(s => s === 'gem' ? gv : SYMS[s] ? SYMS[s].hit : 0);
    const nT = res.filter(s => s === 'tnt').length, golds = res.filter(s => s === 'gold').length;
    const sum = val.reduce((a, b) => a + b, 0), tntMult = Math.pow(tx, nT), jackpot = golds >= 3;
    const combo = jackpot ? JACKPOT : 1;
    const dmg = Math.max(1, Math.round(atk * sum * tntMult * combo * SLOT_X));
    return { atk, hits: sum, combo, comboN: jackpot ? golds : 1, dmg, res, jackpot, tx, tntMult, nT, golds,
      cellDmg: val.map(v => atk * v * SLOT_X), base: atk * sum * SLOT_X };
  }
  // 평소 공격(탐지 없이 곡괭이로 한 대): hit() 연출이 그대로 쓰도록 탐지 결과와 같은 모양으로
  function basicHit(st, base) {
    const atk = stat.atk(st.lv.atk) * pickMult(st) * dmgX(st);
    return { basic: true, atk, hits: 1, combo: 1, comboN: 1, dmg: Math.max(1, Math.round(base * BASIC)), res: [], jackpot: false, tntMult: 1 };
  }
  // 공격 뒤 효과: 황금 광맥 광석.  반환: { jackGold }
  function applySpin(st, r) {
    const out = { jackGold: 0 };
    if (r.jackpot) { out.jackGold = Math.ceil(goldPerSec(st) * JACK_SEC); st.gold += out.jackGold; st.jackpots = (st.jackpots || 0) + 1; }
    return out;
  }
  const goldPerKill = st => Math.ceil(killGold(st.floor) * stat.coinX(st.lv.coin) * goldX(st) * KILL_X);

  // 평균 대미지 (몬테카를로): 공격 한 번당 평균 = 평소 한 대 + 탐지 몫(GAUGE 번에 한 번)
  function avgDmg(st, n = 600) {
    let seed = 12345; const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let tot = 0, base = 0;
    for (let i = 0; i < n; i++) { const r = evalSpin(st, roll(st, rng)); tot += r.dmg; base += r.dmg / SLOT_X / r.combo; }
    base /= n;
    return { dmg: base * BASIC + tot / n / IDLE.GAUGE, slot: tot / n, base };
  }
  // 초당 광석 (자동 사냥 기준)
  function goldPerSec(st) {
    const a = avgDmg(st), aps = stat.aps(st.lv.spd), hp = mobHp(st.floor);
    const attacksPerKill = Math.max(1, Math.ceil(hp / Math.max(1, a.dmg)));
    const killTime = attacksPerKill * (1 / aps + IDLE.SLOT_TIME / IDLE.GAUGE) + IDLE.RESPAWN;
    return goldPerKill(st) / killTime;
  }
  // 접속 안 한 동안 쌓인 광석
  function offline(st, now = Date.now()) {
    const sec = Math.min(IDLE.OFFLINE_MAX + 2 * 3600 * cLv(st, 'rest'), Math.max(0, (now - (st.lastSeen || now)) / 1000));
    if (sec < 60) return { sec, gold: 0 };
    return { sec, gold: Math.floor(goldPerSec(st) * sec * IDLE.OFFLINE_RATE) };
  }

  // 몬스터 한 마리 처치 → 광석. 보스 문 열림 여부
  //  일반 스테이지면 다음 스테이지로. 보스 스테이지에서 기다리는 중(자동 도전 OFF)이면 제자리에서 광석만
  function onKill(st) {
    const g = goldPerKill(st);
    st.gold += g; st.totalKills++;
    st.dur = Math.min(maxDur(st), st.dur + maxDur(st) * IDLE.REGEN * abil.rep(st));
    if (!isBossStage(st.floor)) advance(st);
    return g;
  }
  function advance(st) {
    st.floor++;
    st.best = Math.max(st.best || 0, st.floor);
    st.allBest = Math.max(st.allBest || 0, st.floor);
  }
  const bossReady = st => isBossStage(st.floor);
  // 보스 '준비' 한 번 = 다시 탐지 또는 수리 (docs/slot-4.md). 수리는 최대 내구도의 20%
  const BOSS_REPAIR = 0.2;
  function bossRepair(st) { const mx = maxDur(st), before = st.dur; st.dur = Math.min(mx, st.dur + mx * BOSS_REPAIR); return st.dur - before; }
  // 자동 보스 판단 (게임·시뮬 공용): 잡을 수 있으면 공격 → 반격에 부러질 것 같으면 수리 → 황금 2개면 황금 노림 → 돌만 다시 → 아니면 공격
  function bossPlan(st, syms, rer, hp) {
    const r = evalSpin(st, syms), atkB = bossAtk(st.floor);
    if (r.dmg >= hp || rer <= 0) return { act: 'attack' };
    if (st.dur <= atkB && st.dur < maxDur(st) * 0.9) return { act: 'repair' };
    if (r.jackpot) return { act: 'attack' };
    const golds = syms.filter(s => s === 'gold').length;
    const held = syms.map(s => s === 'gold' || s === 'tnt' || s === 'gem');
    if (golds >= 2 && held.some(h => !h)) return { act: 'reroll', held };
    if (rer >= 2 && syms.some(s => s === 'stone')) return { act: 'reroll', held };   // 1번은 수리용으로 남겨 둠
    return { act: 'attack' };
  }
  const pierceMax = () => env0('PIERCE') === '0' ? 0 : IDLE.PIERCE;
  // 보스에게 지면 챕터 처음(x-1)으로
  function bossLose(st) { st.floor = chapterStart(st.floor); st.bossFails++; st.dur = maxDur(st); }
  function bossWin(st) {
    st.bossWins++; st.dur = maxDur(st);
    advance(st);
    const g = Math.ceil(killGold(st.floor) * 5 * goldX(st));
    st.gold += g;
    return g;
  }

  // 환생으로 받을 결정: 이번 판 최고 깊이가 깊을수록 급증, 어려운 단계일수록 더 많이
  const crystalsFor = st => {
    const b = st.best || 0;
    if (b < RB.OPEN || b < (st.start || 0) + IDLE.STAGES) return 0;      // 5-1 이전 · 시작 지점에서 한 챕터도 안 내려갔으면 없음
    // 깊이 한 칸마다 ×CRX (몬스터 체력이 층마다 곱으로 늘어나니, 보상도 곱으로 늘어야 환생할수록 더 깊이 감)
    return Math.max(1, Math.floor(Math.pow(+(globalThis.process && process.env.CRX) || 1.15, lx(b) - 15) * (1 + 0.25 * (st.rb || 0))));
  };
  const canPrestige = st => crystalsFor(st) > 0;
  // 환생: 스테이지·광석·강화 초기화 / 곡괭이·도감·결정·기록 유지 / 지난 최고 기록의 절반에서 시작
  function prestige(st) {
    const got = crystalsFor(st); if (!got) return 0;
    st.crystals = (st.crystals || 0) + got; st.cTotal = (st.cTotal || 0) + got;
    st.allBest = Math.max(st.allBest || 0, st.best || 0);
    st.rb = (st.rb || 0) + 1;
    const start = chapterStart(Math.floor(st.allBest / 2));
    Object.keys(st.lv).forEach(k => st.lv[k] = 0);
    Object.assign(st, { gold: 0, floor: start, best: start, start, boxN: 0 });
    st.dur = maxDur(st);
    setRun(st);
    return got;
  }
  function buyC(st, k) {
    const U = CUP[k], lv = cLv(st, k);
    if (U.max && lv >= U.max) return false;
    const c = U.cost(lv); if ((st.crystals || 0) < c) return false;
    st.crystals -= c; st.cup = st.cup || {}; st.cup[k] = lv + 1;
    return true;
  }

  // 예전 스테이지(챕터 5개) → v2(챕터 10개): 같은 챕터, 비슷한 위치
  const oldToV2 = f => Math.floor(f / 5) * 10 + (f % 5) * 2;
  function migrateStages(st) {
    if (st.stv === 2) return false;
    for (const k of ['floor', 'best', 'allBest', 'start']) if (st[k] != null) st[k] = oldToV2(st[k]);
    st.floor = chapterStart(st.floor);
    st.stv = 2; delete st.kills;
    return true;
  }

  // ---------- 층 → 광산(카드 묶음) · 몬스터 ----------
  //  광산 11곳(55스테이지)을 지나면 '심층 구역': 같은 광산이 색만 바뀌어 다시 나옴 → 끝없이 내려감
  const FLOORS_PER_MINE = IDLE.STAGES;
  function mineOf(C, f) {
    const keys = Object.keys(C.TIERS).sort((a, b) => a - b);
    return keys[Math.floor(f / FLOORS_PER_MINE) % keys.length];
  }
  const zoneOf = (C, f) => Math.floor(f / (FLOORS_PER_MINE * Object.keys(C.TIERS).length));
  function mobCard(C, f, rng, boss) {
    const tier = mineOf(C, f), inMine = f % FLOORS_PER_MINE;
    const grade = boss ? (isSBoss(f) ? 'S' : ['C', 'B', 'A'][Math.floor(rng() * 3)]) : ['F', 'E', 'D'][Math.floor(rng() * 3)];
    const list = C.TIERS[tier].cards[grade];
    const idx = Math.floor(rng() * list.length);
    return { ...list[idx], tier, grade, idx };
  }

  root.Idle = {
    IDLE, BAL, UP, CUP, PICK, RB, SYMS, LADDER, SLOT_X, JACKPOT, BOSS_REPAIR, FLOORS_PER_MINE, stat,
    // 탐지
    weights, roll, evalSpin, basicHit, applySpin, unlocked, ladderOf, TNT_X, GEM_V, avgDmg,
    // 스테이지·몬스터·보스
    lx, mobHp, mobAtk, bossHp, bossAtk, killGold, goldPerKill, goldPerSec, isBossStage, isSBoss, bossReady, chapterStart, stageNo, advance, onKill,
    bossWin, bossLose, bossRepair, bossPlan, pierceMax, maxDur, breakPick, mineOf, zoneOf, mobCard, offline,
    // 강화·환생
    newState, canBuy, buy, dmgX, goldX, holdX, cLv, buyC, crystalsFor, canPrestige, prestige, setRun, diff, migrateStages,
    // 곡괭이
    pickMult, pickName, gradeName, abilText, dexCount, noteDex, dropGrade, addPick, mergePicks, autoMerge, equipPick, rollDrop,
    boxPrice, openBox, sellPrice, sellPick, scrapPick, craftPick, migratePicks,
  };
})(typeof window !== 'undefined' ? window : globalThis);
