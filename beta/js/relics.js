// =====================================================
//  탐험 상점: 층을 통과할 때마다 3개 중 1개를 고름
//   - 심볼: 슬롯에 나오는 심볼 비중을 바꿈 (run.pool)
//   - 유물: 탐험 내내 적용되는 효과 (run.mods)
//   - 회복: 리롤 충전
// =====================================================
(function (root) {
  // 효과 기본값 (아무 유물도 없을 때)
  function baseMods() {
    return {
      pickBonus: 0,      // 모든 곡괭이 타격 횟수 +
      exDmg: 2,          // 폭발 광석이 주변에 주는 대미지
      tntDmg: 2,         // TNT 대미지
      chestMin: 0,       // 상자 배율 +
      blockMult: {},     // 블록 종류별 점수 배율 (기본 1)
      hpMinus: {},       // 블록 종류별 내구도 −
      firstPicks: 0,     // 층 첫 스핀에 곡괭이 최소 개수
      startSpins: 0,     // 층 시작 스핀 +
      chestSpin: 0,      // 상자가 열릴 때 스핀 +
      clearTop: 0,       // 층 시작 시 맨 윗줄(풀) 제거
    };
  }

  const R = { C: 60, R: 30, E: 10 }; // 등장 비중: 일반 / 희귀 / 영웅
  const RARITY_NAME = { C: '일반', R: '희귀', E: '영웅' };
  const ITEMS = [
    // ---- 심볼 ----
    { id: 's_pick2', kind: 'symbol', rare: 'C', icon: 'pick2', name: '철 곡괭이 늘리기', desc: '철 곡괭이(2타)가 더 자주 나와요', max: 5, apply: r => { r.pool.pick2 += 4; } },
    { id: 's_pick3', kind: 'symbol', rare: 'C', icon: 'pick3', name: '금 곡괭이 늘리기', desc: '금 곡괭이(3타)가 더 자주 나와요', max: 5, apply: r => { r.pool.pick3 += 3; } },
    { id: 's_pick5', kind: 'symbol', rare: 'R', icon: 'pick5', name: '다이아 곡괭이 늘리기', desc: '다이아 곡괭이(5타)가 더 자주 나와요', max: 4, apply: r => { r.pool.pick5 += 1.6; } },
    { id: 's_pick7', kind: 'symbol', rare: 'E', icon: 'pick7', name: '흑요석 곡괭이 늘리기', desc: '흑요석 곡괭이(7타)가 더 자주 나와요', max: 3, apply: r => { r.pool.pick7 += 0.7; } },
    { id: 's_tnt', kind: 'symbol', rare: 'C', icon: 'tnt', name: 'TNT 보급', desc: 'TNT가 더 자주 나와요', max: 4, apply: r => { r.pool.tnt += 1.5; } },
    { id: 's_book', kind: 'symbol', rare: 'R', icon: 'book', name: '강화의 책 늘리기', desc: '같은 열 곡괭이를 다이아로 바꾸는 책이 더 자주', max: 3, apply: r => { r.pool.book += 0.9; } },
    { id: 's_super', kind: 'symbol', rare: 'E', icon: 'superbook', name: '초강화의 책 늘리기', desc: '같은 열 곡괭이를 흑요석으로 바꾸는 책이 더 자주', max: 2, apply: r => { r.pool.superbook += 0.35; } },
    { id: 's_spin', kind: 'symbol', rare: 'C', icon: 'spin', name: '행운의 스핀', desc: '스핀 심볼(몬스터 공격 1턴 늦춤)이 더 자주 나와요', max: 4, apply: r => { r.pool.spin += 1.1; } },
    { id: 's_trim', kind: 'symbol', rare: 'C', icon: 'pick1', name: '빈칸 정리', desc: '슬롯의 빈칸이 15% 줄어요', max: 4, apply: r => { r.pool.empty *= 0.85; } },
    { id: 's_upg', kind: 'symbol', rare: 'R', icon: 'pick2', name: '곡괭이 개량', desc: '돌 곡괭이(1타)가 모두 철 곡괭이(2타)로', max: 1, apply: r => { r.pool.pick2 += r.pool.pick1; r.pool.pick1 = 0; } },
    // ---- 유물 ----
    { id: 'r_handle', kind: 'relic', rare: 'E', emoji: '🔨', name: '단단한 손잡이', desc: '모든 곡괭이 타격 +1', max: 2, apply: r => { r.mods.pickBonus += 1; } },
    { id: 'r_map', kind: 'relic', rare: 'R', emoji: '🗺️', name: '보물 지도', desc: '모든 상자 배율 +1', max: 3, apply: r => { r.mods.chestMin += 1; } },
    { id: 'r_powder', kind: 'relic', rare: 'C', emoji: '💥', name: '화약 강화', desc: '폭발 광석·TNT 대미지 +1', max: 3, apply: r => { r.mods.exDmg += 1; r.mods.tntDmg += 1; } },
    { id: 'r_ruby', kind: 'relic', rare: 'C', emoji: '🔴', name: '루비 감정사', desc: '루비 점수 ×2', max: 3, apply: r => { mul(r, 'ruby', 2); } },
    { id: 'r_gold', kind: 'relic', rare: 'C', emoji: '🟡', name: '금 세공사', desc: '금 점수 ×2', max: 3, apply: r => { mul(r, 'gold', 2); } },
    { id: 'r_dia', kind: 'relic', rare: 'R', emoji: '💎', name: '다이아 연마사', desc: '다이아 점수 ×2', max: 3, apply: r => { mul(r, 'diamond', 2); } },
    { id: 'r_obs', kind: 'relic', rare: 'R', emoji: '🟣', name: '흑요석 균열', desc: '흑요석 내구도 −2, 다이아 −1', max: 2, apply: r => { r.mods.hpMinus.obsidian = (r.mods.hpMinus.obsidian || 0) + 2; r.mods.hpMinus.diamond = (r.mods.hpMinus.diamond || 0) + 1; } },
    { id: 'r_clover', kind: 'relic', rare: 'R', emoji: '🍀', name: '네잎클로버', desc: '몬스터 공격 간격 +1턴', max: 2, apply: r => { r.mods.startSpins += 1; } },
    { id: 'r_sense', kind: 'relic', rare: 'C', emoji: '👁️', name: '광부의 감', desc: '층 첫 스핀에 곡괭이 최소 3개', max: 1, apply: r => { r.mods.firstPicks = Math.max(r.mods.firstPicks, 3); } },
    { id: 'r_chest', kind: 'relic', rare: 'R', emoji: '🎁', name: '상자 속 스핀', desc: '상자가 열릴 때마다 몬스터 공격까지 +1턴', max: 2, apply: r => { r.mods.chestSpin += 1; } },
    { id: 'r_mower', kind: 'relic', rare: 'C', emoji: '🌿', name: '풀 베기', desc: '층 시작 시 맨 윗줄 풀이 사라져요', max: 1, apply: r => { r.mods.clearTop = 1; } },
    // ---- 회복 ----
    { id: 'h_heart', kind: 'heal', rare: 'R', emoji: '❤️', name: '회복 물약', desc: '하트 +1 (최대 하트도 +1, 최대 5)', max: 99, apply: r => { r.maxHearts = Math.min(5, r.maxHearts + 1); r.hearts = Math.min(r.maxHearts, r.hearts + 1); } },
    { id: 'h_reroll', kind: 'heal', rare: 'C', emoji: '🔄', name: '리롤 충전', desc: '리롤 +2', max: 99, apply: r => { r.rerolls += 2; } },
  ];
  function mul(r, type, x) { r.mods.blockMult[type] = (r.mods.blockMult[type] || 1) * x; }
  const byId = Object.fromEntries(ITEMS.map(it => [it.id, it]));

  // 상점 선택지 n개 (같은 것 중복 없음, 최대 개수 넘은 것 제외)
  function offer(run, n, rng) {
    const pickW = root.Engine._.pickWeighted;
    const owned = id => run.picks.filter(x => x === id).length;
    let cands = ITEMS.filter(it => owned(it.id) < it.max);
    const out = [];
    while (out.length < n && cands.length) {
      const it = pickW(rng, cands.map(c => [c, R[c.rare]]));
      out.push(it);
      cands = cands.filter(c => c !== it);
    }
    return out;
  }
  function take(run, id) {
    const it = byId[id];
    if (!it) return;
    it.apply(run);
    run.picks.push(id);
  }

  root.Relics = { ITEMS, byId, baseMods, offer, take, RARITY_NAME };
})(typeof window !== 'undefined' ? window : globalThis);
