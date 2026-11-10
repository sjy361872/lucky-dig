// 곡괭이 장인 v2 — 규칙·전투 계산 (화면과 무관 → 시뮬에서도 그대로 씀)
// 설계: docs/forge-pipeline.md
(function (root) {
  // ---------- 곡괭이 부위 ----------
  const HEADS = {   // 헤드 = 무슨 성질
    iron:    { name: '철',     mat: 'iron',    ico: '⬛', col: 0xdfe6ee, css: '#cfd8e2', dmg: 1.35, line: '한 방이 세다 (피해 ×1.35)' },
    crystal: { name: '수정',   mat: 'crystal', ico: '💎', col: 0x7fe8ff, css: '#7fe8ff', dmg: 1.0, shard: 0.35, line: '칠 때마다 파편이 옆 광물로 (35%)' },
    fire:    { name: '화염',   mat: 'fire',    ico: '🔥', col: 0xff9a5a, css: '#ff9a5a', dmg: 1.0, burn: 0.45, line: '화상: 2초 동안 추가 피해 (45%, 방어 무시)' },
  };
  const BLADES = {  // 날 = 어떻게 치나
    point: { name: '뾰족날', short: '뾰족', every: 0.62, dmg: 0.68, pierce: 0.7, wind: 0.12, line: '빠른 연타 · 방어를 70% 뚫음' },
    flat:  { name: '넓적날', short: '넓적', every: 1.45, dmg: 1.6, stagger: 0.5, wind: 0.36, line: '느린 강타 · 맞은 광물 반격이 0.5초 늦어짐' },
    saw:   { name: '톱니날', short: '톱니', every: 0.95, dmg: 0.95, splash: 0.6, wind: 0.18, line: '옆 광물들도 함께 긁음 (60%)' },
  };
  const GRIPS = {   // 손잡이 = 속도·내구도
    wood:  { name: '나무자루', mat: 'wood',  speed: 1.3,  dmg: 1.0,  dur: 100, line: '빠름 (속도 ×1.3) · 내구도 100' },
    bone:  { name: '뼈자루',   mat: 'bone',  speed: 1.0,  dmg: 1.0,  dur: 180, line: '튼튼 · 내구도 180' },
    metal: { name: '쇠자루',   mat: 'metal', speed: 0.85, dmg: 1.3,  dur: 130, line: '묵직 (피해 ×1.3, 속도 ×0.85) · 내구도 130' },
  };
  const GRADES = [
    { name: '일반', css: '#cfcfcf', hex: 0xcfcfcf, m: 1.0 },
    { name: '고급', css: '#5be37d', hex: 0x5be37d, m: 1.2 },
    { name: '희귀', css: '#4aa3ff', hex: 0x4aa3ff, m: 1.45 },
    { name: '영웅', css: '#c77dff', hex: 0xc77dff, m: 1.75 },
    { name: '전설', css: '#ffb020', hex: 0xffb020, m: 2.1 },
  ];
  // 약점 3타 점수(0~9) → 룰렛 칸 넓이 (%)
  const ODDS0 = [52, 30, 13, 4, 1], ODDS9 = [8, 22, 36, 24, 10];
  const odds = s => ODDS0.map((a, i) => a + (ODDS9[i] - a) * Math.max(0, Math.min(9, s)) / 9);

  const BASE_DMG = 14;
  function pickStats(p) {
    const H = HEADS[p.head], B = BLADES[p.blade], G = GRIPS[p.grip], gm = GRADES[p.grade].m, lv = p.lv || 0;
    const dmg = BASE_DMG * H.dmg * B.dmg * G.dmg * gm * (1 + 0.15 * lv);
    const every = B.every / G.speed;
    const maxDur = Math.round(G.dur * (1 + (gm - 1) * 0.6) * (1 + 0.08 * lv));
    return { dmg, every, dps: dmg / every, maxDur, head: p.head, blade: p.blade, grip: p.grip,
      shard: H.shard || 0, burn: H.burn || 0, pierce: B.pierce || 0, stagger: B.stagger || 0, splash: B.splash || 0, wind: B.wind };
  }
  const pickName = p => `${HEADS[p.head].name} ${BLADES[p.blade].name} ${GRIPS[p.grip].name} 곡괭이`;
  const pickShort = p => `${GRADES[p.grade].name} ${HEADS[p.head].name} 곡괭이`;

  // ---------- 재료 ----------
  const MATS = {
    iron: { name: '철', ico: '⬛' }, crystal: { name: '수정', ico: '💎' }, fire: { name: '화염석', ico: '🔥' },
    wood: { name: '나무', ico: '🪵' }, bone: { name: '뼈', ico: '🦴' }, metal: { name: '쇠막대', ico: '🔩' },
    steel: { name: '강철', ico: '⚙️' },
  };
  const START = { gold: 30, iron: 2, crystal: 2, fire: 2, wood: 2, bone: 2, metal: 2, steel: 3 };
  const craftCost = p => ({ [HEADS[p.head].mat]: 1, [GRIPS[p.grip].mat]: 1, steel: 1 });
  const upCost = lv => 20 + 15 * lv;
  const repairCost = (cur, max) => Math.ceil((max - cur) / 3);
  const meltBack = p => ({ [HEADS[p.head].mat]: 1, [GRIPS[p.grip].mat]: 1, gold: 5 * (p.lv || 0) });

  // ---------- 광물 · 보스 ----------
  const ORES = {
    rock:   { name: '돌덩이',   tex: 'soft',   hp: 45, armor: 0, atk: 2, every: 2.8, hit: '돌가루가 튀었다',   gold: 4, drop: [['wood', 0.3], ['bone', 0.15]] },
    iron:   { name: '철광석',   tex: 'armor',  hp: 70, armor: 7, atk: 3, every: 3.0, hit: '쇳조각이 튀었다',   gold: 6, drop: [['iron', 0.5], ['steel', 0.25]] },
    frost:  { name: '냉기 수정', tex: 'reso',   hp: 55, armor: 2, atk: 3, every: 2.6, hit: '얼음 가시가 박혔다', gold: 6, drop: [['crystal', 0.5]], fireImmune: true },
    cursed: { name: '저주석',   tex: 'cursed', hp: 60, armor: 3, atk: 5, every: 3.2, hit: '저주가 스며들었다', gold: 8, drop: [['fire', 0.4], ['bone', 0.2]] },
  };
  const BOSSES = {
    b1: { name: '거대 바위',   tex: 'main',     hp: 420, armor: 2, atk: 4, every: 2.6, slam: 12, slamEvery: 10, warn: 2.5, minion: 'rock', sumEvery: 11, hit: '바위 부스러기가 쏟아졌다', gold: 40, boss: true },
    b2: { name: '강철 광맥',   tex: 'armor',    hp: 460, armor: 9, atk: 5, every: 2.6, slam: 15, slamEvery: 10, warn: 2.5, minion: 'iron', sumEvery: 12, hit: '강철 파편이 날아왔다', gold: 60, boss: true },
    b3: { name: '광맥 수호자', tex: 'guardian', hp: 650, armor: 4, atk: 5, every: 2.4, slam: 16, slamEvery: 9, warn: 2.5, minion: 'frost', sumEvery: 10, hit: '수호자가 몸을 부딪쳤다', gold: 90, boss: true, fireResist: 0.5 },
  };
  const STAGES = [
    { id: '1-1', name: '막힌 갱도', ores: ['rock', 'rock', 'iron', 'rock', 'rock', 'iron', 'rock'], boss: 'b1', bossDrop: { steel: 2, iron: 1, wood: 1 },
      info: '무른 <b>돌덩이</b>가 대부분. <b>철광석</b>은 단단해요(방어 7).',
      story: ['의뢰인: 갱도가 막혀서 광부들이 못 들어가요!', '늙은 광부: 오, 바람이 통한다. 거의 다 왔어!', '의뢰인: 고마워요! 이제 다들 일하러 갈 수 있겠어요.'] },
    { id: '1-2', name: '철광 지대', ores: ['iron', 'rock', 'iron', 'iron', 'rock', 'iron', 'rock'], boss: 'b2', bossDrop: { steel: 2, iron: 1, metal: 1 },
      info: '<b>철광석</b>이 많아요(방어 7). 보스 <b>강철 광맥</b>은 방어 9! <span class="warn">뾰족날·넓적날</span>이 유리해요.',
      story: ['대장장이 조합: 철이 모자라요. 철광 지대를 뚫어 주세요!', '꼬마 광부: 와, 철이 반짝반짝해!', '대장장이 조합: 이 철이면 한 달은 버티겠네요!'] },
    { id: '1-3', name: '냉기 동굴', ores: ['frost', 'cursed', 'frost', 'rock', 'frost', 'cursed', 'frost'], boss: 'b3', bossDrop: { steel: 2, fire: 1, bone: 1 },
      info: '<b>냉기 수정</b>엔 <span class="warn">화상이 안 통해요</span>. <b>저주석</b>은 반격이 아파요(5). 보스 <b>광맥 수호자</b>는 화상 절반.',
      story: ['마을 촌장: 동굴 깊은 곳에서 이상한 소리가 나요…', '늙은 광부: 춥다… 곡괭이 놓치지 마!', '마을 촌장: 수호자를 쓰러뜨리다니! 당신은 진짜 장인이야.'] },
  ];

  // ---------- 전투 (완전 자동) ----------
  // step(dt) 를 부르면 events 배열에 일어난 일을 쌓음 → 화면은 그걸 읽어서 연출
  class Battle {
    constructor(pick, stageIdx, rng = Math.random) {
      this.p = pick; this.st = pickStats(pick); this.S = STAGES[stageIdx]; this.rng = rng;
      this.dur = pick.dur; this.t = 0; this.events = []; this.queue = this.S.ores.slice(); this.total = this.queue.length;
      this.slots = [null, null, null]; this.pending = []; this.burns = []; this.boss = null; this.done = null; this.killed = 0;
      this.swingT = 0.6; this.bossDue = -1; this.spawnT = [0.2, 0.5, 0.8];
      this.loot = { gold: 0 }; this.uid = 0;
    }
    ev(type, o = {}) { this.events.push(Object.assign({ type, t: this.t }, o)); }
    alive() { return this.slots.filter(o => o && o.hp > 0); }
    spawn(i, key, boss) {
      const d = boss ? BOSSES[key] : ORES[key];
      const o = { id: ++this.uid, key, d, slot: i, hp: d.hp, max: d.hp, atkT: d.every * (0.8 + 0.4 * this.rng()), boss: !!boss };
      if (boss) { o.slamT = d.slamEvery * 0.7; o.warnLeft = -1; o.sumT = d.sumEvery * 0.6; }
      this.slots[i] = o; this.ev('spawn', { o });
      return o;
    }
    target() { return this.alive().sort((a, b) => a.hp - b.hp)[0] || null; }
    revive() { this.dur = Math.round(this.st.maxDur * 0.5); this.done = null; this.ev('revive'); }
    step(dt) {
      if (this.done) return;
      this.t += dt;
      // 등장
      for (let i = 0; i < 3; i++) {
        if (this.slots[i] || this.boss) continue;
        if (this.spawnT[i] > 0) { this.spawnT[i] -= dt; continue; }
        if (this.queue.length) { this.spawn(i, this.queue.shift()); this.spawnT[i] = 0.7; }
      }
      if (!this.queue.length && !this.alive().length && !this.boss) {
        if (this.bossDue < 0) { this.bossDue = 1.4; this.ev('bossCome', { name: BOSSES[this.S.boss].name }); }
        this.bossDue -= dt;
        if (this.bossDue <= 0) { this.slots = [null, null, null]; this.boss = this.spawn(1, this.S.boss, true); }
      }
      // 휘두르기
      this.swingT -= dt;
      if (this.swingT <= 0) {
        const tg = this.target();
        if (tg) { this.swingT += this.st.every; this.pending.push({ left: this.st.wind, o: tg }); this.ev('swing', { o: tg }); }
        else this.swingT = 0.05;
      }
      for (const h of this.pending) { h.left -= dt; if (h.left <= 0) this.land(h.o); }
      this.pending = this.pending.filter(h => h.left > 0);
      // 화상
      for (const b of this.burns) {
        if (b.o.hp <= 0) { b.left = 0; continue; }
        const d = Math.min(b.left, b.rate * dt); b.left -= d; b.acc = (b.acc || 0) + d;
        if (b.acc >= 1 || b.left <= 0.001) { this.hurt(b.o, b.acc, 'burn'); b.acc = 0; }
      }
      this.burns = this.burns.filter(b => b.left > 0.001);
      // 반격
      for (const o of this.alive()) {
        o.atkT -= dt;
        if (o.atkT <= 0) { o.atkT += o.d.every; this.wear(o.d.atk, o, 'atk'); if (this.done) return; }
        if (o.boss) {
          o.sumT -= dt;
          if (o.sumT <= 0) {
            o.sumT = o.d.sumEvery;
            const free = [0, 2].filter(i => !this.slots[i]);
            if (free.length) { const m = this.spawn(free[0], o.d.minion); m.minion = true; this.ev('summon', { o, m }); }
          }
          if (o.warnLeft >= 0) {
            o.warnLeft -= dt;
            if (o.warnLeft < 0) { this.wear(o.d.slam, o, 'slam'); if (this.done) return; o.slamT = o.d.slamEvery; }
          } else {
            o.slamT -= dt;
            if (o.slamT <= 0) { o.warnLeft = o.d.warn; this.ev('warn', { o }); }
          }
        }
      }
    }
    wear(n, o, kind) {
      this.dur = Math.max(0, this.dur - n);
      this.ev(kind, { o, n, dur: this.dur });
      if (this.dur <= 0) { this.done = 'broken'; this.ev('broken', { o }); }
    }
    land(o) {
      if (o.hp <= 0) { o = this.target(); if (!o) return; }
      const s = this.st, armor = o.d.armor * (1 - s.pierce);
      const raw = s.dmg, dealt = Math.max(1, raw - armor);
      this.ev('hit', { o, n: dealt, blocked: Math.round(Math.min(raw - 1, armor)) });
      this.hurt(o, dealt, 'hit');
      if (s.stagger && o.hp > 0) { o.atkT += s.stagger; this.ev('stagger', { o }); }
      if (s.burn) {
        const res = o.d.fireImmune ? 1 : (o.d.fireResist || 0);
        if (res >= 1) this.ev('immune', { o });
        else { const tot = dealt * s.burn * (1 - res); this.burns.push({ o, left: tot, rate: tot / 2 }); }
      }
      if (s.shard) {
        const others = this.alive().filter(x => x !== o);
        const to = others.length ? others[Math.floor(this.rng() * others.length)] : (o.hp > 0 ? o : null);
        if (to) { const n = raw * s.shard * (others.length ? 1 : 0.5); this.ev('shard', { from: o, o: to, n }); this.hurt(to, n, 'shard'); }
      }
      if (s.splash) for (const x of this.alive().filter(x => x !== o)) {
        const n = Math.max(1, raw * s.splash - x.d.armor * (1 - s.pierce)); this.ev('splash', { from: o, o: x, n }); this.hurt(x, n, 'splash');
      }
    }
    hurt(o, n, kind) {
      if (o.hp <= 0 || this.done) return;
      o.hp -= n;
      if (kind !== 'hit') this.ev('dmg', { o, n, kind });
      if (o.hp <= 0) {
        o.hp = 0; this.killed += o.boss || o.minion ? 0 : 1;
        const loot = { gold: o.d.gold };
        if (o.boss) Object.assign(loot, this.S.bossDrop);
        else for (const [m, p] of o.d.drop) if (this.rng() < p) loot[m] = (loot[m] || 0) + 1;
        for (const k in loot) this.loot[k] = (this.loot[k] || 0) + loot[k];
        this.ev('kill', { o, loot });
        this.slots[o.slot] = null;
        if (o.boss) { this.done = 'clear'; this.slots = [null, null, null]; this.ev('clear'); }
      }
    }
  }

  const R = { HEADS, BLADES, GRIPS, GRADES, odds, pickStats, pickName, pickShort, MATS, START, craftCost, upCost, repairCost, meltBack, ORES, BOSSES, STAGES, Battle };
  if (typeof module !== 'undefined') module.exports = R; else root.RULES = R;
})(this);
