// 막힘 풀기 타이쿤 — 엔진 (계산만, 화면과 무관 → node 시뮬에서도 그대로 실행)
// 규칙 (docs/tycoon-mvp.md 2장):
//   라인: 캐기 → 가공1 → 가공2 → 출하. 각 기계 앞에 대기 칸(최대 BUF개).
//   앞에서 들어오는 양 > 그 기계 처리량 이면 대기 칸이 쌓임 = 막힘. BUF 넘치면 놓침.
//   막힌 기계 옆에 보조 기계를 붙이면 처리량 ×FIX → 쌓인 게 한꺼번에 빠지고, 그 뒤로 생산 영구 증가.
(function (root) {
  const CFG = {
    BUF: 120,               // 대기 칸 한도
    CAP: [6, 35, 200],      // 가공1 · 가공2 · 출하 처음 처리량(개/초)
    FIX: 200,               // 보조 기계 배율 (체험판: 한 번 풀면 판 끝까지 다시 안 막힘)
    SUP0: 3,                // 캐기 처음 공급(개/초)
    SUP_X: 1.15,            // 캐기 강화 1번당 공급 배율
    MILE: 3, MILE_N: 5,     // 캐기 Lv.5·10·15 마다 공급 ×3 → 이때 막힘이 생김
    SUP_COST0: 40, SUP_COST_X: 1.5,   // tools/sim/tune_tycoon.js: 막힘 ~117s·~204s·~273s
    PRICE0: 1, PRICE_ADD: 0.5,  // 판매가 강화 1번당 +0.5
    PRICE_COST0: 80, PRICE_COST_X: 2.2,
    JAM_MIN: 4,             // 대기 칸이 이만큼 넘으면 '막힘'
    END: 240,               // 판 길이(초) — 막힘 ~36s·~123s·~188s
    START_LV: 3, START_MONEY: 200,  // 시작하자마자 강화 1번 → 30초쯤 첫 막힘
  };
  const NAMES = ['캐기', '가공 1', '가공 2', '출하'];
  const IGA = ['캐기가', '가공 1이', '가공 2가', '출하가'], EUN = ['캐기는', '가공 1은', '가공 2는', '출하는'];

  function create() {
    return {
      t: 0, money: CFG.START_MONEY, shipped: 0, lost: 0,
      lv: { sup: CFG.START_LV, price: 0 },
      cap: CFG.CAP.slice(),          // 기계 1~3 처리량
      fixed: [false, false, false],
      buf: [0, 0, 0],                // 기계 1~3 앞 대기
      rateIn: [0, 0, 0, 0], rateOut: [0, 0, 0, 0], lostRate: 0, earnRate: 0,
      jams: [],                      // {m, start, fix, wrong}
      bonus: 0,                      // 막힘 해결 뒤 '쌓였던 것' 출하분 남은 양
      bonusGot: 0,
      ended: false,
    };
  }

  const supplyAt = lv => CFG.SUP0 * Math.pow(CFG.SUP_X, lv) * Math.pow(CFG.MILE, Math.floor(lv / CFG.MILE_N));
  const supply = st => supplyAt(st.lv.sup);
  const price = st => CFG.PRICE0 + CFG.PRICE_ADD * st.lv.price;
  const cost = (st, k) => k === 'sup'
    ? Math.round(CFG.SUP_COST0 * Math.pow(CFG.SUP_COST_X, st.lv.sup))
    : Math.round(CFG.PRICE_COST0 * Math.pow(CFG.PRICE_COST_X, st.lv.price));

  // 지금 막힌 기계(1~3) 하나 — 공급이 처리량보다 큰 첫 기계 (해결 직후 쌓인 게 빠지며 잠깐 몰리는 건 막힘 아님)
  function jammed(st) {
    const s = supply(st);
    for (let i = 0; i < 3; i++) if (st.cap[i] < s) return st.buf[i] >= CFG.JAM_MIN ? i + 1 : 0;
    return 0;
  }
  const openJam = st => st.jams.find(j => j.fix == null) || null;

  function tick(st, dt) {
    if (st.ended) return;
    st.t += dt;
    let flow = supply(st) * dt;          // 캐기에서 나온 양
    const a = 1 - Math.exp(-dt / 0.6);   // 표시용 부드러운 평균
    st.rateOut[0] += (flow / dt - st.rateOut[0]) * a;
    let lost = 0;
    for (let i = 0; i < 3; i++) {
      st.rateIn[i + 1] += (flow / dt - st.rateIn[i + 1]) * a;
      st.buf[i] += flow;
      const out = Math.min(st.buf[i], st.cap[i] * dt);
      st.buf[i] -= out;
      if (st.buf[i] > CFG.BUF) { lost += st.buf[i] - CFG.BUF; st.buf[i] = CFG.BUF; }
      flow = out;
      st.rateOut[i + 1] += (out / dt - st.rateOut[i + 1]) * a;
    }
    st.lost += lost;
    st.lostRate += (lost / dt - st.lostRate) * a;
    st.shipped += flow;
    const earn = flow * price(st);
    st.money += earn;
    st.earnRate += (earn / dt - st.earnRate) * a;
    if (st.bonus > 0) {             // 해결 직후: 쌓였던 게 빠지는 만큼을 '적체 보너스'로 셈
      const left = st.buf.reduce((s, x) => s + x, 0);
      if (left < st.bonus) { st.bonusGot += st.bonus - left; st.bonus = left; }
      if (left < 1) st.bonus = 0;
    }
    // 막힘 기록
    const m = jammed(st), oj = openJam(st);
    if (m && !oj) st.jams.push({ m, start: st.t, fix: null, wrong: 0 });
    if (oj && !m) { oj.fix = oj.fix ?? st.t; oj.self = true; } // (정상 흐름이면 생기지 않음)
    if (st.t >= CFG.END) st.ended = true;
  }

  function buy(st, k) {
    const c = cost(st, k);
    if (st.money < c) return false;
    st.money -= c; st.lv[k]++;
    return true;
  }

  // 보조 기계를 기계 m(1~3) 옆에 붙이기 → {ok, m, jam, before, after, reason}
  function place(st, m) {
    const oj = openJam(st);
    if (!oj) return { ok: false, reason: '지금은 막힌 곳이 없어요' };
    if (m !== oj.m) {
      oj.wrong++;
      return { ok: false, m, jam: oj.m,
        reason: `${EUN[m]} 여유 있어요 (${fmt(st.rateIn[m])} 들어오고 ${fmt(st.cap[m - 1])}까지 처리)` };
    }
    const before = st.rateOut[3];
    st.cap[m - 1] *= CFG.FIX; st.fixed[m - 1] = true;
    st.bonus += st.buf.reduce((s, x) => s + x, 0);
    oj.fix = st.t;
    return { ok: true, m, before, after: Math.min(supply(st), ...st.cap), backlog: st.bonus };
  }

  // 막힘 원인 한 줄
  function reason(st) {
    const m = jammed(st);
    if (!m) return '';
    return `${IGA[m]} 느려요: ${fmt(st.rateIn[m])} 들어오는데 ${fmt(st.cap[m - 1])}만 처리`;
  }

  const fmt = n => n >= 100 ? Math.round(n).toString() : n >= 10 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, '');

  const T = { CFG, NAMES, create, tick, buy, place, jammed, openJam, reason, supply, supplyAt, price, cost, fmt };
  if (typeof module !== 'undefined') module.exports = T; else root.T = T;
})(this);
