// =====================================================
//  슬롯 덱빌딩: 심볼(덱에 넣는 카드)과 동료 몬스터(판 전체 효과)
//   - 심볼: 스핀하면 덱의 심볼이 슬롯 20칸에 무작위로 깔림
//   - 동료: 도감에서 잡은 몬스터. 속성 = 효과 종류, 등급 = 효과 크기
//   설계표: design/SYMBOLS.md
// =====================================================
(function (root) {
  const RARITY_NAME = { C: '일반', R: '희귀', E: '영웅', L: '전설', X: '저주' };
  const RW = { C: 60, R: 28, E: 9 };   // 스핀 후 3택1 등장 비중

  // icon: assets/items/<icon>.png 가 있으면 그림, 없으면 emoji
  const SYMBOLS = {
    pick1:  { rare: 'S', icon: 'pick1', name: '돌 곡괭이', desc: '자기 열 블록을 1번 때려요' },
    pick2:  { rare: 'C', icon: 'pick2', name: '철 곡괭이', desc: '자기 열 블록을 2번 때려요' },
    pick3:  { rare: 'R', icon: 'pick3', name: '금 곡괭이', desc: '자기 열 블록을 3번 때려요' },
    pick5:  { rare: 'E', icon: 'pick5', name: '다이아 곡괭이', desc: '자기 열 블록을 5번 때려요' },
    pick7:  { rare: 'L', icon: 'pick7', name: '흑요석 곡괭이', desc: '자기 열 블록을 7번 때려요' },
    tnt:    { rare: 'C', icon: 'tnt', name: 'TNT', desc: '자기 열 맨 위 블록 중심으로 3×3 폭발 (2대미지)' },
    book:   { rare: 'C', icon: 'book', name: '강화의 책', desc: '같은 열 아래쪽 곡괭이들이 이번 스핀 +2번 더 때려요' },
    anvil:  { rare: 'R', emoji: '🔨', name: '모루', desc: '바로 위 칸 곡괭이를 영구히 +1 강화해요 (덱에 남음)' },
    clover: { rare: 'C', emoji: '🍀', name: '클로버', desc: '배율 +0.5. 슬롯에 클로버가 3개 이상이면 각각 +1' },
    torch:  { rare: 'C', emoji: '🔥', name: '횃불', desc: '같은 열에서 깬 광석(루비·금·다이아·흑요석·?) 칩 ×2' },
    magnet: { rare: 'R', emoji: '🧲', name: '자석', desc: '바로 옆 열에서 깬 블록 하나당 칩 +5' },
    bolt:   { rare: 'R', emoji: '⚡', name: '번개병', desc: '무작위 3개 열의 맨 위 블록에 번개 (1대미지)' },
    spin:   { rare: 'C', icon: 'spin', name: '모래시계', desc: '몬스터 공격을 1턴 늦춰요 (한 번 쓰면 사라짐)' },
    pebble: { rare: 'X', emoji: '🪨', name: '돌멩이', desc: '저주: 아무 효과 없이 칸만 차지해요. 몬스터에게 맞으면 덱에 들어와요' },
  };
  const DRAFT_POOL = ['pick2', 'pick3', 'pick5', 'tnt', 'book', 'anvil', 'clover', 'torch', 'magnet', 'bolt', 'spin'];

  // 3택1 (같은 심볼 중복 없이). 깊은 층일수록 희귀 비중 ↑
  function draft(run, n, rng) {
    const deep = run.floor / 6;
    const pool = DRAFT_POOL.map(id => [id, RW[SYMBOLS[id].rare] * (SYMBOLS[id].rare === 'C' ? 1 - deep * 0.4 : 1 + deep)]);
    const out = [];
    while (out.length < n && pool.length) {
      const tot = pool.reduce((a, x) => a + x[1], 0);
      let r = rng() * tot, i = 0;
      for (; i < pool.length - 1; i++) { r -= pool[i][1]; if (r < 0) break; }
      out.push(pool[i][0]); pool.splice(i, 1);
    }
    return out;
  }

  // ---------- 동료 몬스터 ----------
  // 등급 계수: 같은 속성이면 높은 등급일수록 효과가 큼 (여러 마리면 합산)
  const GF = { G: 1, F: 1.2, E: 1.4, D: 1.6, C: 1.9, B: 2.2, A: 2.6, S: 3 };
  const f1 = n => (Math.round(n * 10) / 10).toString();
  const COMP = {
    stone:    { name: '돌 다루기', text: f => `흙·풀·돌 블록 칩 +${f1(7 * f)}` },
    ruby:     { name: '루비 사냥', text: f => `루비를 깰 때마다 이번 스핀 배율 +${f1(f)}` },
    gold:     { name: '여백의 미', text: f => `슬롯 빈칸 하나당 배율 +${f1(0.8 * f)}` },
    diamond:  { name: '보석 감정', text: f => `금·다이아 블록 칩 ×${f1(1 + 0.5 * f)}` },
    sapphire: { name: '선봉', text: f => `매 스핀 첫 번째 곡괭이 +${Math.round(4 * f)}타` },
    clover:   { name: '행운의 친구', text: f => `클로버 하나당 배율 +${f1(f)} 추가` },
    lava:     { name: '대폭발', text: f => `TNT 폭발 범위 3×3 → 5×5` },
    thunder:  { name: '번개 소환', text: f => `매 스핀 번개 ${Math.max(1, Math.round(2 * f))}번` },
    void:     { name: '비움', text: f => `덱에서 심볼을 뺄 때마다 영구 배율 +${f1(0.4 * f)}` },
    rainbow:  { name: '무지개 상자', text: f => `보물상자가 열리면 층 배율 +${f1(0.5 * f)} 추가` },
    obsidian: { name: '흑요석 날', text: f => `모든 곡괭이 +${Math.max(1, Math.floor(f))}타` },
  };
  const compFactor = card => GF[card.grade] || 1;
  const compText = card => (COMP[card.elem] ? COMP[card.elem].text(compFactor(card)) : '');
  // 이 속성 동료들의 계수 합 (없으면 0)
  const cv = (run, elem) => run.comps.reduce((a, c) => a + (c.elem === elem ? compFactor(c) : 0), 0);

  const symbol = id => SYMBOLS[id];
  root.Relics = { SYMBOLS, DRAFT_POOL, RARITY_NAME, symbol, draft, COMP, GF, compFactor, compText, cv };
})(typeof window !== 'undefined' ? window : globalThis);
