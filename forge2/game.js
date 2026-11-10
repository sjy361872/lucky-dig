// 곡괭이 장인 — 체험판 2 (docs/forge-pipeline.md)
// 부위 3개 → 약점 3타 → 등급 룰렛 → 스테이지(광물 7 + 보스, 완전 자동, 반격·내구도, 하단 로그) → 정비(수리·재련·제작·녹이기·바꿔 들기)
(() => {
  const R = window.RULES;
  const Q = new URLSearchParams(location.search);
  const W = 720;
  const BOX = document.getElementById('game').getBoundingClientRect();
  const H = Math.max(1100, Math.round(W * BOX.height / Math.max(1, BOX.width)));
  const FONT = '"Black Han Sans", sans-serif';
  const BASE_SPEED = 1.2;                      // 전투 기본 빠르기 (스테이지 30~45초 목표)
  const $ = id => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1); return w + ((c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28) ? a : b); };
  const r0 = x => Math.round(x);

  // ---------- 상태 ----------
  const G = {
    gold: R.START.gold, mats: Object.assign({}, R.START), picks: [null, null], eq: 0, stage: 0, revive: 1, speed: 1,
    failed: false, lastLoot: null, firstCraft: true, rec: { crafts: [], tries: [0, 0, 0], fails: 0 },
  };
  delete G.mats.gold;
  let nextId = 1;
  const eqPick = () => G.picks[G.eq];
  function fullStats(p) { return R.pickStats(p); }
  function mkPick(o) { const p = Object.assign({ id: nextId++, lv: 0 }, o); p.dur = fullStats(p).maxDur; return p; }
  const canPay = cost => Object.entries(cost).every(([k, n]) => (k === 'gold' ? G.gold : G.mats[k] || 0) >= n);
  const pay = cost => Object.entries(cost).forEach(([k, n]) => { if (k === 'gold') G.gold -= n; else G.mats[k] -= n; });
  const gain = loot => Object.entries(loot).forEach(([k, n]) => { if (k === 'gold') G.gold += n; else G.mats[k] = (G.mats[k] || 0) + n; });
  const lootTxt = loot => Object.entries(loot).filter(([, n]) => n > 0).map(([k, n]) => k === 'gold' ? `🪙${n}` : `${R.MATS[k].ico}${R.MATS[k].name} ${n}`).join(' · ');
  const resHtml = () => `<span class="g">🪙 ${G.gold}</span>` + Object.keys(R.MATS).map(k => `<span>${R.MATS[k].ico}${R.MATS[k].name} ${G.mats[k] || 0}</span>`).join('');
  const canCraftAny = () => (G.mats.steel || 0) >= 1 && Object.values(R.HEADS).some(h => G.mats[h.mat] > 0) && Object.values(R.GRIPS).some(g => G.mats[g.mat] > 0);

  // ---------- 효과음 ----------
  let AC = null;
  const ac = () => { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { } } if (AC && AC.state === 'suspended') AC.resume(); return AC; };
  function noise(dur, freq, vol, type = 'lowpass') {
    const a = ac(); if (!a) return;
    const n = a.createBufferSource(), b = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
    n.buffer = b; const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = a.createGain(); g.gain.value = vol; n.connect(f); f.connect(g); g.connect(a.destination); n.start();
  }
  function tone(f0, f1, dur, vol, type = 'sine', delay = 0) {
    const a = ac(); if (!a) return;
    const t0 = a.currentTime + delay, o = a.createOscillator(), g = a.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur);
  }
  const SFX = {
    hit: k => { noise(0.07, 1800 + 800 * k, 0.25 + 0.25 * k); tone(170 - 40 * k, 60, 0.12 + 0.08 * k, 0.3 + 0.3 * k); },
    armor: () => { tone(900, 700, 0.08, 0.08, 'square'); noise(0.05, 4000, 0.15, 'highpass'); },
    clink: () => tone(1800, 1200, 0.05, 0.06, 'triangle'),
    anvil: k => { tone(1500 + 300 * k, 1100, 0.25, 0.18, 'triangle'); tone(2400, 1800, 0.15, 0.08, 'sine'); noise(0.08, 3000, 0.3); },
    miss: () => { tone(220, 140, 0.18, 0.15, 'sawtooth'); },
    brk: big => { noise(big ? 0.45 : 0.22, 900, big ? 0.55 : 0.35); tone(big ? 110 : 160, 40, big ? 0.4 : 0.2, 0.45); },
    ouch: () => { tone(320, 180, 0.12, 0.12, 'square'); noise(0.06, 2500, 0.15); },
    slam: () => { noise(0.6, 500, 0.7); tone(90, 35, 0.6, 0.6); },
    warn: () => [0, 1, 2].forEach(i => tone(440, 430, 0.12, 0.1, 'square', i * 0.22)),
    sizzle: () => noise(0.6, 6000, 0.1, 'highpass'),
    tick: k => tone(500 + 120 * k, 560 + 120 * k, 0.04, 0.09, 'triangle'),
    fanfare: g => [0, 4, 7, 12, 16].slice(0, 2 + g).forEach((s, i) => tone(523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), 0.25, 0.14, 'triangle', i * 0.09)),
    coin: () => { tone(1300, 1300, 0.06, 0.07, 'square'); tone(1750, 1750, 0.1, 0.07, 'square', 0.06); },
    burn: () => noise(0.05, 1200, 0.05),
    win: () => [0, 4, 7, 12].forEach((s, i) => tone(392 * Math.pow(2, s / 12), 392 * Math.pow(2, s / 12), 0.2, 0.14, 'square', i * 0.1)),
    lose: () => [0, -3, -7].forEach((s, i) => tone(300 * Math.pow(2, s / 12), 280 * Math.pow(2, s / 12), 0.25, 0.12, 'triangle', i * 0.15)),
  };

  // ---------- 패널 ----------
  const PANELS = ['pStart', 'pParts', 'pTap', 'pRoul', 'pNew', 'pIntro', 'pFix', 'hud', 'log', 'pEnd'];
  const show = (...ids) => PANELS.forEach(p => $(p).classList.toggle('hide', !ids.includes(p)));
  const sF = () => game.scene.getScene('forge'), sM = () => game.scene.getScene('mine');
  function toForge(cb) { if (game.scene.isActive('mine')) game.scene.stop('mine'); if (game.scene.isActive('forge')) cb?.(); else { onForgeReady = cb; game.scene.start('forge'); } }
  function toMine(cb) { if (game.scene.isActive('forge')) game.scene.stop('forge'); if (game.scene.isActive('mine')) cb?.(); else { onMineReady = cb; game.scene.start('mine'); } }
  let onForgeReady = null, onMineReady = null;

  // 곡괭이 그림 (DOM 카드용)
  const pkHtml = p => `<div class="pk"><img class="gr" src="img/g_${p.grip}.png"><img class="hd ${p.head !== 'iron' ? 'tint-' + p.head : ''}" src="img/h_${p.blade}.png"></div>`;
  function cardHtml(p, opt = {}) {
    if (!p) return `<div class="pcard empty">빈 칸</div>`;
    const s = fullStats(p), g = R.GRADES[p.grade], pct = Math.max(0, p.dur / s.maxDur);
    return `<div class="pcard ${opt.eq ? 'eq' : ''}" data-i="${opt.i ?? ''}" style="border-color:${opt.eq ? '' : g.css + '88'}">
      ${opt.eq ? '<span class="tagEq">들고 있음</span>' : ''}${pkHtml(p)}
      <div class="nm"><span style="color:${g.css}">${g.name}</span>${p.lv ? ` <span style="color:var(--green)">+${p.lv}</span>` : ''}<br>${R.pickName(p)}</div>
      <div class="st">피해 <b>${r0(s.dmg)}</b> · 초당 ${(1 / s.every).toFixed(1)}회</div>
      <div class="durbar"><i style="width:${pct * 100}%;background:${pct > 0.5 ? 'var(--green)' : pct > 0.25 ? 'var(--gold)' : 'var(--red)'}"></i></div>
      <div class="st">내구도 ${r0(p.dur)}/${s.maxDur}</div></div>`;
  }

  // ===== 1. 부위 고르기 =====
  let draft = null;
  function startCraft(back) {
    draft = { head: null, blade: null, grip: null, back };
    toForge(() => { show('pParts'); renderParts(); sF().idle(); });
  }
  function renderParts() {
    $('partsRes').innerHTML = resHtml();
    const opt = (id, list, key, pic, has) => {
      $(id).innerHTML = Object.entries(list).map(([k, d]) => {
        const n = has(d), ok = n === null || n > 0;
        return `<button class="opt ${draft[key] === k ? 'sel' : ''}" data-k="${k}" ${ok ? '' : 'disabled'}>${n !== null ? `<span class="cnt">×${n}</span>` : ''}<div class="pic">${pic(k, d)}</div><b>${d.name}</b><small>${d.line}</small></button>`;
      }).join('');
      $(id).querySelectorAll('.opt').forEach(el => el.onclick = () => { ac(); draft[key] = el.dataset.k; SFX.clink(); renderParts(); });
    };
    opt('oHead', R.HEADS, 'head', (k, d) => `<span style="color:${d.css}">${d.ico}</span>`, d => G.mats[d.mat] || 0);
    opt('oBlade', R.BLADES, 'blade', k => `<img src="img/h_${k}.png">`, () => null);
    opt('oGrip', R.GRIPS, 'grip', k => `<img class="rot" src="img/g_${k}.png">`, d => G.mats[d.mat] || 0);
    const ready = draft.head && draft.blade && draft.grip;
    const p = ready ? Object.assign({ grade: 0, lv: 0 }, draft) : null;
    $('pName').innerHTML = ready ? R.pickName(p) : '<span style="color:var(--dim)">부위를 하나씩 골라요</span>';
    if (ready) {
      const cost = R.craftCost(p), s = fullStats(p);
      $('pCost').innerHTML = `재료: ${lootTxt(cost)} · 일반 등급 기준 피해 ${r0(s.dmg)} · 초당 ${(1 / s.every).toFixed(1)}회 · 내구도 ${s.maxDur}`;
      $('bForge').disabled = !canPay(cost) || (G.mats.steel || 0) < 1;
      if ((G.mats.steel || 0) < 1) $('pCost').innerHTML += '<br><span class="warn">강철이 없어요</span>';
    } else { $('pCost').textContent = '같은 부위라도 등급은 망치질 점수와 룰렛으로 정해져요'; $('bForge').disabled = true; }
    $('bPartsBack').classList.toggle('hide', !draft.back);
    sF()?.preview(ready ? p : draft);
  }
  $('bPartsBack').onclick = () => { ac(); draft = null; openFix(); };
  $('bForge').onclick = () => {
    ac(); const p = Object.assign({ grade: 0 }, draft);
    pay(R.craftCost(p));
    show('pTap'); drawScore([]);
    sF().beginTap(scores => {
      const sc = scores.reduce((a, b) => a + b, 0);
      const od = R.odds(sc), r = Math.random() * 100;
      let acc = 0, grade = 0; for (let i = 0; i < 5; i++) { acc += od[i]; if (r < acc) { grade = i; break; } }
      show('pRoul');
      $('roulTitle').innerHTML = `망치질 점수 <span style="color:var(--gold)">${sc}</span> / 9`;
      $('roulOdds').innerHTML = R.GRADES.map((g, i) => `<span style="color:${g.css}">${g.name} ${od[i].toFixed(0)}%</span>`).join('');
      G.rec.crafts.push({ sc, grade });
      sF().roulette(od, grade, () => newPick(mkPick({ head: p.head, blade: p.blade, grip: p.grip, grade, score: sc })));
    }, s => drawScore(s));
  };
  function drawScore(s) {
    const lab = n => n === 3 ? '완벽' : n === 2 ? '좋음' : n === 1 ? '보통' : '빗나감';
    $('tapScore').innerHTML = [0, 1, 2].map(i => `<span style="color:${s[i] == null ? '#776' : s[i] >= 3 ? 'var(--gold)' : s[i] ? '#fff' : 'var(--red)'}">${s[i] == null ? `${i + 1}타` : `${lab(s[i])} ${s[i]}`}</span>`).join('');
  }

  // ===== 2. 새 곡괭이 =====
  function newPick(p) {
    show('pNew');
    const s = fullStats(p), H = R.HEADS[p.head], B = R.BLADES[p.blade], Gp = R.GRIPS[p.grip];
    $('newCard').innerHTML = `<h2 style="text-align:center;color:${R.GRADES[p.grade].css};font-size:28px">${R.GRADES[p.grade].name} 곡괭이!</h2>
      <div style="font-weight:800">${R.pickName(p)}</div>
      <p class="sub" style="margin:6px 0">피해 <b>${r0(s.dmg)}</b> · 초당 <b>${(1 / s.every).toFixed(1)}</b>회 · 내구도 <b>${s.maxDur}</b><br>
      ${H.ico} ${H.line}<br>⛏ ${B.line}<br>✊ ${Gp.line}</p>`;
    const empty = G.picks.findIndex(x => !x);
    if (empty >= 0) {
      $('newBtns').innerHTML = `<button class="btn" id="bKeep">보관함에 넣고 들기</button>`;
      $('bKeep').onclick = () => { G.picks[empty] = p; G.eq = empty; afterCraft(); };
    } else {
      $('newBtns').innerHTML = `<p class="sub">보관함이 꽉 찼어요 (2칸). 하나를 눌러 녹이고 새 곡괭이를 넣어요 (재료 일부 회수).</p><div class="cards">${G.picks.map((q, i) => `<div class="melt" data-i="${i}">${cardHtml(q)}<div class="st" style="color:var(--fire);font-weight:800;margin-top:4px">↑ 이걸 녹이기</div></div>`).join('')}</div><button class="btn alt" id="bToss">새 곡괭이를 녹이기</button>`;
      $('newBtns').querySelectorAll('.melt').forEach(el => el.onclick = () => { const i = +el.dataset.i; gain(R.meltBack(G.picks[i])); G.picks[i] = p; G.eq = i; afterCraft(); });
      $('bToss').onclick = () => { gain(R.meltBack(p)); afterCraft(); };
    }
  }
  function afterCraft() {
    ac(); SFX.clink();
    if (G.firstCraft) { G.firstCraft = false; stageIntro(); } else openFix();
  }

  // ===== 3. 현장 소개 =====
  function stageIntro() {
    const S = R.STAGES[G.stage], B = R.BOSSES[S.boss];
    toMine(() => { sM().idle(); });
    show('pIntro');
    $('inTitle').innerHTML = `의뢰 ${S.id} · ${S.name}`;
    $('inInfo').innerHTML = S.info;
    $('inLine').innerHTML = S.ores.map(k => `<div><img src="img/${R.ORES[k].tex}.png">${R.ORES[k].name}</div>`).join('') + `<div class="boss"><img src="img/${B.tex}.png">보스</div>`;
    const p = eqPick();
    $('inPick').innerHTML = p ? `<div class="cards" style="grid-template-columns:1fr">${cardHtml(p, { eq: true })}</div>` : '';
    $('bGo').disabled = !p || p.dur <= 0;
    $('bGo').textContent = !p ? '곡괭이가 없어요' : p.dur <= 0 ? '곡괭이가 부서졌어요 → 정비' : '출발!';
  }
  $('bInFix').onclick = () => { ac(); openFix(); };
  $('bGo').onclick = () => { ac(); startBattle(); };

  // ===== 4. 전투 =====
  let battle = null;
  function startBattle() {
    const p = eqPick(); if (!p || p.dur <= 0) return;
    G.failed = false; G.rec.tries[G.stage]++;
    battle = new R.Battle(Object.assign({}, p), G.stage);
    show('hud', 'log'); clearLog();
    const S = R.STAGES[G.stage];
    $('hTtl').innerHTML = `${S.id} ${S.name}`;
    logLine(S.story[0], 'story');
    logLine(`⛏ ${josa(R.pickShort(p), '이', '가')} 출발했다!`, 'hit');
    toMine(() => sM().run(battle, p, endBattle));
  }
  function endBattle(result) {
    const p = eqPick();
    p.dur = battle.dur;
    const loot = Object.assign({}, battle.loot); gain(loot);
    G.lastLoot = loot;
    if (result === 'clear') {
      SFX.win();
      G.stage++;
      if (G.stage >= R.STAGES.length) return endGame();
      openFix({ clear: true, loot });
    } else {
      G.failed = true; G.rec.fails++;
      openFix({ fail: true, loot, killed: battle.killed });
    }
  }
  $('spd').onclick = () => { ac(); G.speed = G.speed === 1 ? 2 : 1; $('spd').textContent = '×' + G.speed; $('spd').classList.toggle('on', G.speed === 2); };
  function hudDur(dur, max) {
    const pct = Math.max(0, dur / max);
    $('hDurBar').style.width = pct * 100 + '%';
    $('hDurBar').style.background = pct > 0.5 ? 'var(--green)' : pct > 0.25 ? 'var(--gold)' : 'var(--red)';
    $('hDur').textContent = `${r0(dur)}/${max}`;
  }
  function hudProg(b) {
    const boss = b.boss ? (b.boss.hp > 0 ? `보스 ${R.BOSSES[b.S.boss].name} ${Math.ceil(b.boss.hp)}/${b.boss.max}` : '보스 격파!') : '보스 대기';
    $('hProg').innerHTML = `광물 ${b.killed}/${b.total} · ${boss} · 🪙 ${b.loot.gold}`;
  }

  // ---------- 하단 로그 ----------
  const LOG = [];
  function clearLog() { LOG.length = 0; $('log').innerHTML = ''; }
  function logLine(txt, cls = 'hit') {
    LOG.push(`<div class="c-${cls}">${txt}</div>`); while (LOG.length > 3) LOG.shift();
    $('log').innerHTML = LOG.join('');
  }

  // ===== 5. 정비 =====
  function openFix(o = {}) {
    if (o.clear !== undefined || o.fail !== undefined) G.fixCtx = o;
    const ctx = G.fixCtx || {};
    toMine(() => sM().idle(true));
    show('pFix');
    const S = R.STAGES[Math.min(G.stage, R.STAGES.length - 1)];
    if (ctx.clear) {
      const done = R.STAGES[G.stage - 1];
      $('fxTitle').innerHTML = `${done.id} ${done.name} 클리어!`;
      $('fxResult').innerHTML = `보상: <b>${lootTxt(ctx.loot)}</b><br><span class="sub">곡괭이 내구도는 그대로 이어져요. 수리할지, 재련할지, 새로 만들지 골라요.</span>`;
    } else if (ctx.fail) {
      $('fxTitle').innerHTML = `<span style="color:var(--red)">곡괭이가 부서졌어요…</span>`;
      $('fxResult').innerHTML = `${S.id} · 광물 ${ctx.killed}/${S.ores.length}에서 파손. 그래도 얻은 것: <b>${lootTxt(ctx.loot) || '없음'}</b>`;
    } else { $('fxTitle').textContent = '정비'; $('fxResult').innerHTML = ''; }
    // 부활
    const rv = $('bRevive');
    rv.classList.toggle('hide', !(ctx.fail && battle && !battle.revived && G.revive > 0));
    rv.innerHTML = `💖 부활 — 그 자리에서 이어서 (내구도 50%)<small>원래는 부활 티켓 · 체험판은 무료 ${G.revive}번</small>`;
    $('fxRes').innerHTML = resHtml();
    // 보관함
    $('fxCards').innerHTML = G.picks.map((p, i) => cardHtml(p, { eq: i === G.eq && !!p, i })).join('');
    $('fxCards').querySelectorAll('.pcard[data-i]').forEach(el => el.onclick = () => {
      const i = +el.dataset.i; if (G.picks[i] && G.eq !== i) { ac(); SFX.clink(); G.eq = i; openFix(); }
    });
    // 들고 있는 곡괭이 작업
    const p = eqPick();
    if (p) {
      const s = fullStats(p), rc = R.repairCost(p.dur, s.maxDur), uc = R.upCost(p.lv);
      const up = fullStats(Object.assign({}, p, { lv: p.lv + 1 }));
      const canFixSome = p.dur < s.maxDur && G.gold > 0;
      $('fxActs').innerHTML = `
        <button class="btn alt" id="aFix" ${canFixSome ? '' : 'disabled'}>🔧 수리<small>${p.dur >= s.maxDur ? '멀쩡함' : G.gold >= rc ? `🪙${rc} → 가득` : `🪙${G.gold} → +${G.gold * 3}`}</small></button>
        <button class="btn alt" id="aUp" ${G.gold >= uc ? '' : 'disabled'}>🔨 재련 +${p.lv + 1}<small>🪙${uc} · 피해 ${r0(s.dmg)}→${r0(up.dmg)}</small></button>
        <button class="btn alt" id="aMelt">🔥 녹이기<small>${lootTxt(R.meltBack(p))} 회수</small></button>`;
      $('aFix').onclick = () => { ac(); const pay2 = Math.min(G.gold, rc); G.gold -= pay2; p.dur = Math.min(s.maxDur, p.dur + pay2 * 3); SFX.anvil(0); openFix(); };
      $('aUp').onclick = () => { ac(); G.gold -= uc; p.lv++; p.dur += up.maxDur - s.maxDur; SFX.fanfare(1); sM()?.flashPick?.(); openFix(); };
      $('aMelt').onclick = () => {
        ac(); if (!confirm(`${R.pickName(p)}을(를) 녹일까요? 재료 일부만 돌아와요.`)) return;
        gain(R.meltBack(p)); G.picks[G.eq] = null; const other = G.picks.findIndex(x => x); G.eq = other >= 0 ? other : 0; SFX.sizzle(); openFix();
      };
    } else $('fxActs').innerHTML = '';
    // 새로 제작
    const full = G.picks.every(x => x);
    $('bCraft').disabled = !canCraftAny();
    $('bCraft').innerHTML = `⚒ 새로 제작 (등급 다시 뽑기)<small>재련은 0부터 · ${canCraftAny() ? `재료: 헤드 1 · 손잡이 1 · 강철 1${full ? ' · 보관함이 꽉 차면 하나를 녹여요' : ''}` : '재료가 모자라요 (강철·헤드·손잡이 재료)'}</small>`;
    // 막힘 방지: 쓸 곡괭이가 없고, 수리·제작도 못 하면 낡은 곡괭이
    const usable = G.picks.some(x => x && x.dur > 0);
    const canRepair = G.picks.some(x => x && x.dur < fullStats(x).maxDur) && G.gold > 0;
    const stuck = !usable && !canRepair && !canCraftAny();
    const nb = $('bNext');
    if (stuck) {
      nb.disabled = false; nb.innerHTML = '🎁 낡은 곡괭이 받기 (무료)<small>금화·재료가 바닥나서 막혔을 때만 나와요</small>';
      nb.onclick = () => {
        ac(); const q = mkPick({ head: 'iron', blade: 'point', grip: 'wood', grade: 0 });
        const i = G.picks.findIndex(x => !x || x.dur <= 0); if (G.picks[i]) gain(R.meltBack(G.picks[i]));
        G.picks[i] = q; G.eq = i; openFix();
      };
    } else {
      const ok = p && p.dur > 0;
      nb.disabled = !ok;
      nb.innerHTML = ok ? (ctx.fail ? `다시 도전: ${S.id} ${S.name} (첫 광물부터)` : `다음: ${S.id} ${S.name} →`) : '들고 있는 곡괭이가 부서졌어요 (수리하거나 바꿔 들기)';
      nb.onclick = () => { ac(); G.fixCtx = null; if (ctx.fail) startBattle(); else stageIntro(); };
    }
  }
  $('bRevive').onclick = () => {
    ac(); G.revive--; battle.revived = true;
    const p = eqPick(); G.fixCtx = null;
    // 이미 받은 보상은 지급됨 → 전투의 보상 기록은 비우고 이어서
    battle.loot = { gold: 0 }; battle.revive(); p.dur = battle.dur;
    show('hud', 'log'); logLine('💖 곡괭이가 다시 일어섰다! (내구도 50%)', 'good');
    toMine(() => sM().resume(battle, p, endBattle));
  };
  $('bCraft').onclick = () => { ac(); if (battle) battle.revived = true; startCraft(true); };

  function endGame() {
    show('pEnd'); SFX.fanfare(4);
    const p = eqPick();
    $('endTxt').innerHTML = `마지막 곡괭이: <b style="color:${R.GRADES[p.grade].css}">${R.GRADES[p.grade].name}</b> ${R.pickName(p)} ${p.lv ? '+' + p.lv : ''}<br>
      도전 횟수: ${G.rec.tries.map((t, i) => `${R.STAGES[i].id} ${t}번`).join(' · ')} · 파손 ${G.rec.fails}번<br>
      제작 기록: ${G.rec.crafts.map(c => `${c.sc}점→<span style="color:${R.GRADES[c.grade].css}">${R.GRADES[c.grade].name}</span>`).join(', ')}<br><br>
      <b>해 보고 알려 주세요</b><br>① 한 번 더 만들고 싶었나요?<br>② 고른 부위가 전투에서 보였나요?<br>③ 지켜보는 게 지루했나요?`;
  }
  $('bAgain').onclick = () => location.reload();
  $('bStart').onclick = () => { ac(); startCraft(false); };

  // ---------- 공용 텍스처 ----------
  function makeTextures(sc) {
    if (sc.textures.exists('chip')) return;
    const g = sc.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff); g.fillPoints([{ x: 4, y: 0 }, { x: 14, y: 3 }, { x: 16, y: 12 }, { x: 7, y: 16 }, { x: 0, y: 9 }], true); g.generateTexture('chip', 16, 16); g.clear();
    g.fillStyle(0xffffff); g.fillCircle(32, 32, 32); g.generateTexture('flash', 64, 64); g.clear();
    g.fillStyle(0xffffff); g.fillCircle(4, 4, 4); g.generateTexture('dot', 8, 8); g.clear();
    g.fillStyle(0x9ff7ff); g.fillPoints([{ x: 8, y: 0 }, { x: 16, y: 10 }, { x: 8, y: 26 }, { x: 0, y: 10 }], true);
    g.fillStyle(0xffffff); g.fillPoints([{ x: 8, y: 2 }, { x: 11, y: 10 }, { x: 8, y: 14 }], true); g.generateTexture('shard', 16, 26); g.clear();
    g.fillStyle(0xffd27a); g.fillPoints([{ x: 6, y: 0 }, { x: 12, y: 9 }, { x: 9, y: 16 }, { x: 3, y: 16 }, { x: 0, y: 9 }], true); g.generateTexture('flame', 12, 16); g.clear();
    // 바위 덩이 (낙석)
    g.fillStyle(0x6a5a50); g.fillPoints([{ x: 10, y: 2 }, { x: 34, y: 0 }, { x: 46, y: 16 }, { x: 40, y: 40 }, { x: 14, y: 44 }, { x: 0, y: 24 }], true);
    g.fillStyle(0x8a7a6e); g.fillPoints([{ x: 12, y: 6 }, { x: 30, y: 4 }, { x: 36, y: 14 }, { x: 16, y: 18 }], true); g.generateTexture('rock', 48, 46); g.clear();
    // 망치
    g.fillStyle(0x6b3f1f); g.fillRoundedRect(52, 40, 16, 120, 6); g.fillStyle(0x3a2412); g.fillRect(52, 130, 16, 30);
    g.fillStyle(0x8f98a3); g.fillRoundedRect(8, 4, 104, 44, 8); g.fillStyle(0xc9d2dc); g.fillRoundedRect(12, 8, 96, 14, 6); g.fillStyle(0x5d636c); g.fillRect(8, 40, 104, 8);
    g.generateTexture('hammer', 120, 162); g.destroy();
    const cv = sc.textures.createCanvas('glow', 64, 64), cx = cv.getContext(), rg = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = rg; cx.fillRect(0, 0, 64, 64); cv.refresh();
  }
  function preloadAll(sc) {
    sc.load.image('forge_bg', 'img/forge_bg.jpg');
    for (const t of ['soft', 'armor', 'guardian', 'cursed', 'main', 'reso']) sc.load.image(t, `img/${t}.png`);
    for (const t of ['h_point', 'h_flat', 'h_saw', 'g_wood', 'g_bone', 'g_metal']) sc.load.image(t, `img/${t}.png`);
  }
  // 곡괭이 = 손잡이 + 헤드(재질 색) 컨테이너. (0,0) = 손잡이 끝(쥐는 곳), 위쪽(−y)으로 L 만큼 가면 헤드 가운데
  function makePick(sc, p, L) {
    const c = sc.add.container(0, 0);
    const sG = L / (0.9 * 384), sH = (L * 0.82) / 384;
    const grip = sc.add.image(0, 0, 'g_' + (p.grip || 'wood')).setOrigin(0.5, 0.98).setScale(sG);
    const head = sc.add.image(0, -L, 'h_' + (p.blade || 'point')).setScale(sH);
    if (p.head && p.head !== 'iron') head.setTint(R.HEADS[p.head].col);
    if (!p.blade) head.setAlpha(0.25); if (!p.grip) grip.setAlpha(0.25);
    c.add([grip, head]); c.L = L; c.grip = grip; c.head = head;
    return c;
  }

  // ===================================================================
  // 대장간: 미리보기 · 약점 3타 · 등급 룰렛
  // ===================================================================
  class Forge extends Phaser.Scene {
    constructor() { super('forge'); }
    preload() { preloadAll(this); }
    create() {
      makeTextures(this);
      const bg = this.add.image(W / 2, H / 2, 'forge_bg');
      const s = Math.max(W / bg.width, H / bg.height); bg.setScale(s);
      const P = (ix, iy) => ({ x: W / 2 + (ix - bg.width / 2) * s, y: H / 2 + (iy - bg.height / 2) * s });
      this.anvil = P(470, 870); this.furnace = P(150, 760);
      this.cx = this.anvil.x - 15; this.cy = this.anvil.y + 5;
      this.fireGlow = this.add.image(this.furnace.x, this.furnace.y, 'glow').setScale(5).setTint(0xff8a3c).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: this.fireGlow, alpha: 0.55, scale: 5.6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.add.particles(0, 0, 'dot', { x: { min: this.furnace.x - 60, max: this.furnace.x + 60 }, y: this.furnace.y - 20, speedY: { min: -120, max: -40 }, speedX: { min: -20, max: 30 }, lifespan: 1600, scale: { start: 0.7, end: 0 }, tint: [0xffb04a, 0xff7a1a, 0xffe08a], frequency: 90, blendMode: 'ADD' });
      this.layer = this.add.container(0, 0);
      this.spark = this.add.particles(0, 0, 'dot', { emitting: false, speed: { min: 120, max: 420 }, angle: { min: 0, max: 360 }, gravityY: 900, lifespan: 550, scale: { start: 1, end: 0 }, tint: [0xffe08a, 0xffb04a, 0xffffff], blendMode: 'ADD' }).setDepth(40);
      this.input.on('pointerdown', () => ac());
      const cb = onForgeReady; onForgeReady = null; cb?.();
    }
    clear() { this.tapTimer?.remove(); this.layer.removeAll(true); this.pv = null; if (this.onTap) this.input.off('pointerdown', this.onTap, this); }
    idle() { this.clear(); }
    // 고르는 중인 곡괭이를 화면 위쪽에 크게
    preview(p) {
      if (!this.sys.isActive()) return;
      this.pv?.destroy(); this.pvGlow?.destroy();
      // 패널 위 빈 곳에 맞춰 크기·위치 (패널 윗변을 게임 좌표로)
      const cv = this.game.canvas.getBoundingClientRect(), top = ($('pParts').getBoundingClientRect().top - cv.top) * H / cv.height;
      const L = Phaser.Math.Clamp((top - 40) * 0.75, 110, 230), y = top - 25 - L;
      this.pvGlow = this.add.image(W / 2, y, 'glow').setScale(6).setAlpha(0.3).setTint(p.head ? R.HEADS[p.head].col : 0xffffff).setBlendMode(Phaser.BlendModes.ADD);
      this.layer.add(this.pvGlow);
      const c = this.pv = makePick(this, p, L); c.setPosition(W / 2, top - 25).setAngle(-12); this.layer.add(c);
      this.tweens.add({ targets: c, angle: 12, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      if (p.head === 'fire') { const f = this.add.particles(0, 0, 'flame', { follow: c.head, speedY: { min: -90, max: -30 }, x: { min: -60, max: 60 }, lifespan: 500, scale: { start: 1.3, end: 0 }, tint: [0xff8a3c, 0xffd27a], frequency: 60, blendMode: 'ADD' }); this.layer.add(f); f.startFollow(c, 0, -c.L); }
      if (p.head === 'crystal') { const f = this.add.particles(0, 0, 'shard', { x: { min: -70, max: 70 }, y: { min: -20, max: 20 }, lifespan: 700, scale: { start: 0.8, end: 0 }, frequency: 120, blendMode: 'ADD' }); this.layer.add(f); f.startFollow(c, 0, -c.L); }
    }
    // ---- 달군 금속 ----
    hotPoly(g, pts) {
      g.clear();
      const cx = 0, cy = 0, inset = t => pts.map(p => ({ x: cx + (p.x - cx) * t, y: cy + (p.y - cy) * t }));
      g.fillStyle(0x4a1404, 1); g.fillPoints(pts.map(p => ({ x: p.x, y: p.y + 14 })), true);
      const C = [0x8a2406, 0xb8380a, 0xe0540e, 0xff6f14, 0xff8a22, 0xffa338, 0xffbd55, 0xffd47a, 0xffe7a8, 0xfff4d6];
      C.forEach((col, i) => { g.fillStyle(col, 1); g.fillPoints(inset(1 - i * 0.085), true); });
      g.lineStyle(4, 0x2a0a02, 1); g.strokePoints(pts, true, true);
    }
    // ---- 약점 3타 ----
    beginTap(done, onScore) {
      this.clear();
      const slab = [{ x: -215, y: -92 }, { x: 215, y: -92 }, { x: 224, y: -72 }, { x: 224, y: 72 }, { x: 215, y: 88 }, { x: -215, y: 88 }, { x: -224, y: 72 }, { x: -224, y: -72 }];
      const glow = this.add.image(this.cx, this.cy, 'glow').setScale(9, 5).setTint(0xff7a1a).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD);
      const metal = this.add.graphics().setPosition(this.cx, this.cy); this.hotPoly(metal, slab);
      this.layer.add([glow, metal]); this.metal = metal; this.glowM = glow;
      this.tweens.add({ targets: glow, alpha: 0.85, duration: 500, yoyo: true, repeat: -1 });
      // 부위 그림을 금속 위에 흐릿하게 (무엇을 만드는지 보이게)
      const ghost = this.ghost = makePick(this, draft, 150); ghost.setPosition(this.cx - 60, this.cy + 40).setAngle(90).setAlpha(0.3); this.layer.add(ghost);
      const hammer = this.hammer = this.add.image(W + 100, this.cy - 300, 'hammer').setOrigin(0.5, 0.95).setScale(1.2).setDepth(30); this.layer.add(hammer);
      SFX.sizzle();
      const R0 = [62, 50, 40], LIFE = [1500, 1250, 1050];
      const scores = []; let k = -1, cur = null;
      const ring = this.add.graphics(); this.layer.add(ring);
      const next = () => {
        k++; if (k >= 3) return finish();
        const x = this.cx + rnd(-160, 160), y = this.cy + rnd(-50, 45);
        cur = { x, y, r: R0[k], born: this.time.now, life: LIFE[k], hit: false };
        this.tapCur = cur;
      };
      const draw = () => {
        ring.clear(); if (!cur || cur.hit) return;
        const t = (this.time.now - cur.born) / cur.life;
        if (t >= 1) { judge(null); return; }
        const rr = cur.r * (1 - 0.6 * t);
        ring.fillStyle(0xffffff, 0.18); ring.fillCircle(cur.x, cur.y, cur.r);       // 원래 크기 (보통 범위)
        ring.lineStyle(5, 0xffffff, 0.95); ring.strokeCircle(cur.x, cur.y, rr);       // 줄어드는 원 (남은 시간)
        ring.lineStyle(3, 0xfff1a0, 0.9); ring.strokeCircle(cur.x, cur.y, cur.r * 0.55);
        ring.fillStyle(0xffe14a, 0.95); ring.fillCircle(cur.x, cur.y, cur.r * 0.3);  // 완벽 범위
        ring.fillStyle(0xffffff, 1); ring.fillCircle(cur.x, cur.y, 4);
      };
      const judge = ptr => {
        if (!cur || cur.hit) return; cur.hit = true;
        const px = ptr ? ptr.x : null, py = ptr ? ptr.y : null;
        const d = ptr ? Math.hypot(px - cur.x, py - cur.y) / cur.r : 9;
        const n = d <= 0.3 ? 3 : d <= 0.55 ? 2 : d <= 1 ? 1 : 0;
        scores.push(n); onScore(scores.slice());
        const lab = ['빗나감', '보통', '좋음', '완벽!'][n], col = ['#ff5a5f', '#ffffff', '#9ff7a0', '#ffd54a'][n];
        ring.clear();
        if (ptr) {
          // 망치가 내려침
          hammer.setPosition(px + 70, py - 10).setAngle(50);
          this.tweens.add({ targets: hammer, angle: -8, duration: 70, ease: 'Quad.In', onComplete: () => this.tweens.add({ targets: hammer, angle: 40, duration: 220, ease: 'Sine.Out' }) });
          this.time.delayedCall(70, () => {
            this.cameras.main.shake(n >= 2 ? 160 : 90, n >= 2 ? 0.012 : 0.006);
            this.spark.explode(n * 12 + 6, px, py);
            n ? SFX.anvil(n) : SFX.miss();
            // 친 자리 · 중심 표시 (얼마나 빗나갔나)
            const mk = this.add.graphics(); this.layer.add(mk);
            mk.lineStyle(3, 0xffffff, 0.8); mk.strokeCircle(cur.x, cur.y, cur.r * 0.3);
            mk.lineStyle(3, n ? 0xffffff : 0xff5a5f, 0.9); mk.lineBetween(cur.x, cur.y, px, py);
            mk.fillStyle(n ? 0x2a0a02 : 0xff5a5f, 1); mk.fillCircle(px, py, 7);
            this.tweens.add({ targets: mk, alpha: 0, delay: 500, duration: 400, onComplete: () => mk.destroy() });
            // 금속에 자국
            metal.fillStyle(0x8a2406, 0.5); metal.fillEllipse(px - this.cx, py - this.cy, 26, 12);
          });
        } else SFX.miss();
        const t = this.add.text(cur.x, cur.y - 60, `${lab} ${n ? '+' + n : ''}`, { fontFamily: FONT, fontSize: n === 3 ? '52px' : '40px', color: col, stroke: '#000', strokeThickness: 8 }).setOrigin(0.5).setDepth(31);
        this.layer.add(t); this.tweens.add({ targets: t, y: t.y - 50, alpha: 0, delay: 300, duration: 600, onComplete: () => t.destroy() });
        this.time.delayedCall(650, next);
      };
      this.onTap = ptr => judge(ptr);
      this.time.delayedCall(400, () => { this.input.on('pointerdown', this.onTap, this); next(); });
      this.tapTimer = this.time.addEvent({ delay: 16, loop: true, callback: draw });
      const finish = () => {
        this.input.off('pointerdown', this.onTap, this); this.tapTimer.remove(); ring.clear();
        this.tweens.add({ targets: hammer, x: W + 120, duration: 300 });
        SFX.sizzle();
        const steam = this.add.particles(this.cx, this.cy - 30, 'glow', { speedY: { min: -160, max: -60 }, speedX: { min: -40, max: 40 }, lifespan: 1200, scale: { start: 0.6, end: 2.2 }, alpha: { start: 0.35, end: 0 }, quantity: 2, frequency: 30 });
        this.layer.add(steam); this.time.delayedCall(500, () => steam.stop());
        this.time.delayedCall(700, () => done(scores));
      };
    }
    // ---- 등급 룰렛 ----
    roulette(od, grade, cb) {
      const cx = W / 2, cy = Math.min(H * 0.42, this.cy - 180), rad = 210;
      const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55); this.layer.add(dim);
      const wheel = this.add.container(cx, cy); this.layer.add(wheel);
      const g = this.add.graphics(); wheel.add(g);
      const total = od.reduce((a, b) => a + b, 0); let a0 = -Math.PI / 2; const arcs = [];
      od.forEach((v, i) => {
        const a1 = a0 + Math.PI * 2 * v / total;
        g.fillStyle(R.GRADES[i].hex, 1); g.slice(0, 0, rad, a0, a1, false); g.fillPath();
        g.lineStyle(4, 0x1a1014, 1); g.slice(0, 0, rad, a0, a1, false); g.strokePath();
        if (v >= 4) { const am = (a0 + a1) / 2, t = this.add.text(Math.cos(am) * rad * 0.66, Math.sin(am) * rad * 0.66, R.GRADES[i].name, { fontFamily: FONT, fontSize: v >= 9 ? '30px' : '22px', color: '#1a1014' }).setOrigin(0.5).setRotation(am + Math.PI / 2); wheel.add(t); }
        arcs.push([a0, a1]); a0 = a1;
      });
      g.lineStyle(8, 0x2a1a12, 1); g.strokeCircle(0, 0, rad); g.fillStyle(0x2a1a12, 1); g.fillCircle(0, 0, 26); g.fillStyle(0xffd54a, 1); g.fillCircle(0, 0, 14);
      const ptr = this.add.triangle(cx, cy - rad - 6, 0, 0, 44, 0, 22, 40, 0xffffff).setStrokeStyle(4, 0x000000).setDepth(5); this.layer.add(ptr);
      // 바늘(위쪽, 각도 -90°)이 grade 칸 안쪽에 멈추도록 바퀴 회전량 계산
      const [s0, s1] = arcs[grade], m = (s1 - s0) * 0.18, land = s0 + m + Math.random() * (s1 - s0 - 2 * m);
      const final = -Math.PI / 2 - land + Math.PI * 2 * 6;
      const st = { r: 0 }; let lastSlice = -1;
      SFX.tick(0);
      this.tweens.add({ targets: st, r: final, duration: 3600, ease: 'Cubic.Out',
        onUpdate: () => {
          wheel.setRotation(st.r);
          let a = (-Math.PI / 2 - st.r) % (Math.PI * 2); if (a < -Math.PI / 2) a += Math.PI * 2;
          const idx = arcs.findIndex(([x, y]) => a >= x && a < y);
          if (idx !== lastSlice && idx >= 0) { lastSlice = idx; SFX.tick(idx); this.tweens.add({ targets: ptr, scaleY: 0.8, duration: 40, yoyo: true }); }
        },
        onComplete: () => this.time.delayedCall(250, () => this.reveal(grade, [dim, wheel, ptr], cb)) });
    }
    reveal(grade, junk, cb) {
      const g = R.GRADES[grade], c = Phaser.Display.Color.IntegerToRGB(g.hex);
      this.cameras.main.flash(220, c.r, c.g, c.b); SFX.fanfare(grade);
      if (grade >= 2) this.cameras.main.shake(200 + grade * 120, 0.005 * grade);
      junk.forEach(j => this.tweens.add({ targets: j, alpha: 0, duration: 250, onComplete: () => j.destroy() }));
      this.metal?.setVisible(false); this.glowM?.setVisible(false); this.ghost?.setVisible(false);
      const y = Math.min(H * 0.42, this.cy - 120);
      const ring = this.add.image(W / 2, y - 40, 'glow').setScale(3).setTint(g.hex).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9); this.layer.add(ring);
      this.tweens.add({ targets: ring, scale: 9 + grade * 2, alpha: 0.4, duration: 600 });
      const pk = makePick(this, draft, 250); pk.setPosition(W / 2, y + 110).setScale(0.2).setAngle(-15); this.layer.add(pk);
      this.tweens.add({ targets: pk, scale: 1, angle: 0, duration: 500, ease: 'Back.Out' });
      const label = this.add.text(W / 2, y - 230, g.name, { fontFamily: FONT, fontSize: '72px', color: g.css, stroke: '#000', strokeThickness: 12 }).setOrigin(0.5); this.layer.add(label);
      this.tweens.add({ targets: label, scale: { from: 1.8, to: 1 }, duration: 350, ease: 'Back.Out' });
      const burst = this.add.particles(W / 2, y, 'dot', { emitting: false, speed: { min: 200, max: 650 }, lifespan: 900, scale: { start: 1.3, end: 0 }, tint: [g.hex, 0xffffff], blendMode: 'ADD' }); this.layer.add(burst);
      burst.explode(30 + grade * 45);
      this.time.delayedCall(800, cb);
    }
  }

  // ===================================================================
  // 광산: 완전 자동 전투 (rules.js Battle 의 사건을 읽어 연출)
  // ===================================================================
  const OY = Math.round((H - 1100) * 0.62);
  const SLOT = [{ x: 140, y: 560 + OY, size: 185 }, { x: 360, y: 455 + OY, size: 225 }, { x: 580, y: 560 + OY, size: 185 }];
  const BOSS_POS = { x: 360, y: 470 + OY, size: 380 };
  const COLOR = { soft: 0xc0702c, armor: 0x5d636c, guardian: 0x8a6aa8, cursed: 0x6b4a8a, main: 0x8d8a86, reso: 0x3cc7c0 };
  class Mine extends Phaser.Scene {
    constructor() { super('mine'); }
    preload() { preloadAll(this); }
    create() {
      makeTextures(this);
      const g = this.add.graphics().setDepth(-10);
      for (let i = 0; i < 40; i++) { const t = i / 39; g.fillStyle(Phaser.Display.Color.GetColor(22 + 20 * t, 16 + 12 * t, 26 + 12 * t)); g.fillRect(0, H * t, W, H / 39 + 1); }
      g.fillStyle(0x0d0a10, 1);
      g.fillPoints([{ x: 0, y: 0 }, { x: 110, y: 0 }, { x: 60, y: 200 + OY }, { x: 85, y: 380 + OY }, { x: 30, y: 600 + OY }, { x: 0, y: 660 + OY }], true);
      g.fillPoints([{ x: W, y: 0 }, { x: 600, y: 0 }, { x: 660, y: 220 + OY }, { x: 625, y: 400 + OY }, { x: 690, y: 600 + OY }, { x: W, y: 680 + OY }], true);
      const fy = 690 + OY;
      g.fillStyle(0x2a1d22, 1); g.fillPoints([{ x: 0, y: fy + 25 }, { x: 180, y: fy }, { x: 360, y: fy + 15 }, { x: 540, y: fy - 3 }, { x: W, y: fy + 23 }, { x: W, y: H }, { x: 0, y: H }], true);
      this.add.image(W / 2, 500 + OY, 'glow').setScale(12).setAlpha(0.16).setTint(0xffa860).setDepth(-9);
      this.spr = new Map(); this.chips = {}; this.b = null; this.hsUntil = 0;
      this.flameFx = this.add.particles(0, 0, 'flame', { emitting: false, speedY: { min: -140, max: -60 }, speedX: { min: -30, max: 30 }, lifespan: 600, scale: { start: 1.6, end: 0 }, tint: [0xff8a3c, 0xffd27a, 0xff5a1a], blendMode: 'ADD' }).setDepth(7);
      this.spark = this.add.particles(0, 0, 'dot', { emitting: false, speed: { min: 120, max: 380 }, angle: { min: 0, max: 360 }, gravityY: 900, lifespan: 450, scale: { start: 0.9, end: 0 }, tint: [0xffe08a, 0xffffff], blendMode: 'ADD' }).setDepth(8);
      this.input.on('pointerdown', () => ac());
      const cb = onMineReady; onMineReady = null; cb?.();
    }
    idle(keep) {
      this.running = false;
      if (!keep) { this.spr.forEach(s => this.killSprite(s, true)); this.spr.clear(); this.pk?.destroy(); this.pk = null; }
    }
    // ---- 전투 시작 / 이어서 ----
    run(b, p, done) {
      this.spr.forEach(s => this.killSprite(s, true)); this.spr.clear();
      this.pk?.destroy(); this.aura?.destroy();
      this.b = b; this.p = p; this.done = done; this.lg = {}; this.lastTarget = null;
      this.pk = makePick(this, p, 235).setDepth(5);
      this.pk.setPosition(W / 2 + 120, 900 + OY).setRotation(0.6);
      const gc = R.GRADES[p.grade];
      if (p.grade >= 1) { this.aura = this.add.particles(0, 0, 'dot', { lifespan: 500, speed: 30, scale: { start: 0.9, end: 0 }, tint: gc.hex, frequency: Math.max(40, 160 - p.grade * 30), blendMode: 'ADD' }).setDepth(6); this.aura.startFollow(this.pk); }
      if (p.head === 'fire') { this.headFx = this.add.particles(0, 0, 'flame', { speedY: { min: -60, max: -20 }, lifespan: 380, scale: { start: 1.1, end: 0 }, tint: [0xff8a3c, 0xffd27a], frequency: 70, blendMode: 'ADD' }).setDepth(6); }
      else if (p.head === 'crystal') { this.headFx = this.add.particles(0, 0, 'dot', { lifespan: 450, scale: { start: 0.8, end: 0 }, tint: 0x9ff7ff, frequency: 100, speed: 30, blendMode: 'ADD' }).setDepth(6); }
      else { this.headFx?.destroy(); this.headFx = null; }
      this.running = true; this.ending = false; this.warned = {};
      hudDur(b.dur, b.st.maxDur); hudProg(b);
      const go = this.add.text(W / 2, H * 0.3, '시작!', { fontFamily: FONT, fontSize: '80px', color: '#ffd54a', stroke: '#000', strokeThickness: 12 }).setOrigin(0.5).setDepth(12);
      this.tweens.add({ targets: go, scale: { from: 1.6, to: 1 }, alpha: { from: 1, to: 0 }, duration: 900, onComplete: () => go.destroy() });
    }
    resume(b, p, done) {
      this.b = b; this.p = p; this.done = done; this.running = true; this.ending = false;
      if (!this.pk) this.pk = makePick(this, p, 235).setDepth(5);
      this.pk.setVisible(true).setAlpha(1).setScale(0.3).setPosition(W / 2 + 120, 900 + OY);
      this.pk.list.forEach(c => { this.tweens.killTweensOf(c); c.setPosition(c === this.pk.head ? 0 : 0, c === this.pk.head ? -this.pk.L : 0).setAngle(0).setAlpha(1); });
      this.tweens.add({ targets: this.pk, scale: 1, duration: 400, ease: 'Back.Out' });
      const f = this.add.image(this.pk.x, this.pk.y - 100, 'glow').setScale(2).setTint(0xff8fb0).setBlendMode(Phaser.BlendModes.ADD).setDepth(9);
      this.tweens.add({ targets: f, scale: 10, alpha: 0, duration: 700, onComplete: () => f.destroy() });
      hudDur(b.dur, b.st.maxDur);
    }
    flashPick() { }
    // ---- 위치 ----
    posOf(o) { return o.boss ? BOSS_POS : SLOT[o.slot]; }
    pose(o, phase) {   // phase: 0 = 들어 올림, 1 = 내려침
      const P = this.posOf(o), L = this.pk.L;
      const side = P.x > W / 2 + 5 ? -1 : 1;
      const ax = P.x + side * P.size * 0.1, ay = P.y - P.size * 0.02;
      const gx = ax + side * L * 0.62, gy = ay + L * 0.78;
      const strike = Math.atan2(ay - gy, ax - gx) + Math.PI / 2;
      return { gx, gy, ax, ay, rot: phase ? strike : strike + side * 1.0, side };
    }
    // ---- 사건 처리 ----
    update(time, delta) {
      if (!this.running || !this.b) return;
      const slow = time < this.hsUntil ? 0.06 : 1, k = BASE_SPEED * G.speed;
      this.tweens.timeScale = k * slow; this.time.timeScale = k * slow;
      const dt = Math.min(0.05, delta / 1000) * k * slow;
      this.b.step(dt);
      const evs = this.b.events.splice(0);
      for (const e of evs) this.handle(e);
      if (this.headFx && this.pk) { const a = this.pk.rotation; this.headFx.setPosition(this.pk.x + Math.sin(a) * this.pk.L, this.pk.y - Math.cos(a) * this.pk.L); }
      this.spr.forEach(s => { if (s.o.hp > 0) this.drawBar(s); });
      if ((this._h = (this._h || 0) + delta) > 120) { this._h = 0; hudProg(this.b); }
    }
    handle(e) {
      const o = e.o, s = o ? this.spr.get(o.id) : null, nm = o ? o.d.name : '';
      const pk = this.p, short = R.pickShort(pk);
      switch (e.type) {
        case 'spawn': this.spawnSprite(o); break;
        case 'bossCome': logLine(`🌋 땅이 울린다… ${josa(e.name, '이', '가')} 길을 막았다!`, 'warn'); this.banner('보스 등장!', '#ff5a5f'); SFX.warn(); this.cameras.main.shake(500, 0.008); break;
        case 'swing': this.swing(o); break;
        case 'hit': {
          const P = s ? { x: s.img.x, y: s.img.y } : this.posOf(o);
          const heavy = this.b.st.blade === 'flat', kk = heavy ? 0.85 : this.b.st.blade === 'saw' ? 0.4 : 0.2;
          this.hitFx(o, P.x + rnd(-20, 20), P.y + rnd(-20, 20), kk, e.blocked);
          this.num(P.x, P.y - 30, `${r0(e.n)}${e.blocked > 0 ? ` (−${e.blocked})` : ''}`, kk, e.blocked > e.n ? '#9fc4ff' : heavy ? '#ffd54a' : '#ffffff');
          this.hitStop(heavy ? 80 : 20);
          const verb = heavy ? '쾅! 내리찍었다' : this.b.st.blade === 'point' ? '콕콕 찔렀다' : '드르륵 긁었다';
          this.throttle('hit', 1.6, () => logLine(`${josa(short, '이', '가')} ${josa(nm, '을', '를')} ${verb}! ${r0(e.n)} 피해${e.blocked > 0 ? ` <span style="color:#9fc4ff">(단단해서 ${e.blocked} 막힘)</span>` : ''}`, 'hit'));
          break;
        }
        case 'dmg': {
          const P = s ? { x: s.img.x, y: s.img.y } : this.posOf(o);
          if (e.kind === 'burn') { this.flameFx.explode(5, P.x + rnd(-40, 40), P.y - 10); this.num(P.x + rnd(-30, 30), P.y - 50, r0(e.n), 0.05, '#ff9a4a'); SFX.burn(); this.throttle('burn' + o.id, 99, () => logLine(`🔥 ${josa(nm, '이', '가')} 불탄다!`, 'fx')); }
          else if (e.kind === 'splash') { this.scratch(P.x, P.y); this.num(P.x, P.y - 40, r0(e.n), 0.15, '#ffcf8a'); this.throttle('splash', 3, () => logLine(`⚙ 톱니가 ${nm}까지 긁었다! ${r0(e.n)}`, 'fx')); }
          break;
        }
        case 'shard': { this.fireShard(e.from, o, e.n); this.throttle('shard', 3, () => logLine(`💎 파편이 ${nm}에 꽂혔다! ${r0(e.n)}`, 'fx')); break; }
        case 'stagger': if (s) { this.tweens.add({ targets: s.img, angle: rnd(-8, 8), duration: 80, yoyo: true }); this.throttle('stg', 4, () => logLine(`💫 ${josa(nm, '이', '가')} 휘청했다! 반격이 늦어진다`, 'fx')); } break;
        case 'immune': this.throttle('imm' + o.id, 99, () => { logLine(`❄ ${nm}에는 불이 붙지 않는다!`, 'fx'); if (s) this.num(s.img.x, s.img.y - 70, '화상 안 통함', 0.1, '#9fd8ff'); }); break;
        case 'kill': this.killFx(o, e.loot); break;
        case 'atk': this.oreAttack(o, e.n, false); break;
        case 'warn': this.bossWarn(o); break;
        case 'slam': this.oreAttack(o, e.n, true); break;
        case 'summon': logLine(`🪨 ${josa(o.d.name, '이', '가')} ${josa(e.m.d.name, '을', '를')} 불러냈다!`, 'warn'); if (s) this.tweens.add({ targets: s.img, scale: s.sc * 1.08, duration: 120, yoyo: true }); break;
        case 'broken': this.breakPick(); break;
        case 'clear': this.clearStage(); break;
      }
      if (e.dur !== undefined) {
        hudDur(e.dur, this.b.st.maxDur);
        const pct = e.dur / this.b.st.maxDur;
        if (pct <= 0.5 && !this.warned.h) { this.warned.h = 1; logLine(`😰 곡괭이에 금이 갔다… (내구도 ${r0(e.dur)})`, 'hurt'); }
        if (pct <= 0.25 && !this.warned.q && e.dur > 0) { this.warned.q = 1; logLine(`⚠ 곡괭이가 삐걱댄다! 내구도 ${r0(e.dur)}`, 'warn'); }
      }
    }
    throttle(key, sec, fn) { const now = this.b.t; if ((this.lg[key] ?? -99) + sec <= now) { this.lg[key] = now; fn(); } }
    // ---- 광물 ----
    spawnSprite(o) {
      const P = this.posOf(o);
      const img = this.add.image(P.x, P.y, o.d.tex).setDepth(2);
      const sc = P.size / 256; img.setScale(0);
      if (o.key === 'b2') img.setTint(0xb8c4d0);
      this.tweens.add({ targets: img, scale: sc, duration: o.boss ? 600 : 260, ease: 'Back.Out' });
      if (o.boss) { this.tweens.add({ targets: img, scaleX: sc * 1.03, scaleY: sc * 0.97, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: 700 }); this.cameras.main.shake(400, 0.01); }
      const s = { o, img, sc, bar: this.add.graphics().setDepth(4), cracks: this.add.graphics().setDepth(3).setPosition(P.x, P.y),
        label: this.add.text(P.x, P.y + P.size * 0.5 + 6, o.d.name + (o.d.armor ? ` · 방어 ${o.d.armor}` : ''), { fontFamily: 'sans-serif', fontSize: '19px', fontStyle: 'bold', color: o.d.fireImmune ? '#9fd8ff' : '#e8d8c8', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 0).setDepth(4) };
      this.spr.set(o.id, s); this.drawBar(s);
      if (!o.boss && !o.minion && this.b.killed === 3 && !this.lg.mid) { this.lg.mid = 1; logLine(this.b.S.story[1], 'story'); }
    }
    drawBar(s) {
      const P = this.posOf(s.o), w = P.size * 0.75, y = P.y - P.size * 0.56;
      s.bar.clear(); s.bar.fillStyle(0x000000, 0.6); s.bar.fillRoundedRect(P.x - w / 2 - 3, y - 3, w + 6, 16, 8);
      s.bar.fillStyle(s.o.boss ? 0xff5a5f : 0x5be37d, 1); s.bar.fillRoundedRect(P.x - w / 2, y, Math.max(0, w * s.o.hp / s.o.max), 10, 5);
    }
    killSprite(s, instant) { [s.img, s.bar, s.cracks, s.label].forEach(x => x?.destroy()); }
    // ---- 곡괭이 휘두르기 ----
    swing(o) {
      if (!this.pk) return;
      const st = this.b.st, up = this.pose(o, 0), dn = this.pose(o, 1);
      const w = st.wind * 1000;
      this.tweens.killTweensOf(this.pk);
      this.tweens.chain({ targets: this.pk, tweens: [
        { x: up.gx, y: up.gy - (st.blade === 'flat' ? 30 : 8), rotation: up.rot, duration: Math.max(40, w * 0.7), ease: 'Sine.Out' },
        { x: dn.gx, y: dn.gy, rotation: dn.rot, duration: Math.max(30, w * 0.3), ease: 'Quad.In' },
        { rotation: dn.rot + dn.side * 0.45, duration: 140, ease: 'Sine.Out' },
      ] });
    }
    hitStop(ms) { this.hsUntil = this.game.loop.time + ms; }
    hitFx(o, x, y, k, blocked) {
      const s = this.spr.get(o.id); if (!s) return;
      s.img.setTintFill(0xffffff); this.time.delayedCall(40, () => { if (s.img.active) { s.img.clearTint(); if (o.key === 'b2') s.img.setTint(0xb8c4d0); } });
      const f = this.add.image(x, y, 'flash').setDepth(7).setScale(0.3 + 0.5 * k).setAlpha(0.9).setBlendMode(Phaser.BlendModes.ADD).setTint(blocked ? 0x9fc4ff : 0xfff1c0);
      this.tweens.add({ targets: f, scale: 0.9 + 1.3 * k, alpha: 0, duration: 150, onComplete: () => f.destroy() });
      this.chipFx(o, x, y, Math.round(4 + 10 * k));
      this.cameras.main.shake(k > 0.6 ? 120 : 50, k > 0.6 ? 0.01 : 0.003);
      blocked > 3 ? SFX.armor() : SFX.hit(k);
      if (Math.random() < 0.5) this.addCrack(s, x, y);
    }
    scratch(x, y) {
      const g = this.add.graphics().setDepth(7);
      for (let i = 0; i < 3; i++) { g.lineStyle(4, 0xffe0a0, 0.9); const yy = y - 20 + i * 18; g.lineBetween(x - 40, yy - 10, x + 40, yy + 10); }
      this.tweens.add({ targets: g, alpha: 0, duration: 300, onComplete: () => g.destroy() });
      SFX.clink();
    }
    addCrack(s, x, y) {
      const P = this.posOf(s.o), r = P.size * 0.34, g = s.cracks;
      let a = Math.random() * Math.PI * 2, px = Phaser.Math.Clamp(x - P.x, -r * 0.5, r * 0.5), py = Phaser.Math.Clamp(y - P.y, -r * 0.5, r * 0.5);
      const pts = [[px, py]];
      for (let i = 0; i < 3; i++) { a += rnd(-0.7, 0.7); px += Math.cos(a) * r * 0.15; py += Math.sin(a) * r * 0.15; if (Math.hypot(px, py) > r) break; pts.push([px, py]); }
      const path = (w, col, al) => { g.lineStyle(w, col, al); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.forEach(q => g.lineTo(q[0], q[1])); g.strokePath(); };
      path(5, 0x1a1222, 0.5); path(2, 0xfff2dc, 0.5);
    }
    chipFx(o, x, y, n) {
      const col = COLOR[o.d.tex] || 0x888888;
      if (!this.chips[col]) this.chips[col] = this.add.particles(0, 0, 'chip', { emitting: false, tint: [col, 0x3a3440], speed: { min: 160, max: 440 }, angle: { min: 190, max: 350 }, gravityY: 1300, lifespan: 700, scale: { min: 0.5, max: 1.3 }, rotate: { min: 0, max: 360 } }).setDepth(6);
      this.chips[col].explode(n, x, y);
    }
    num(x, y, n, k, col) {
      const t = this.add.text(x + rnd(-24, 24), y, String(n), { fontFamily: FONT, fontSize: `${Math.round(26 + 30 * k)}px`, color: col, stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(9);
      this.tweens.add({ targets: t, y: y - 60 - 40 * k, alpha: { from: 1, to: 0 }, duration: 700, ease: 'Cubic.Out', onComplete: () => t.destroy() });
    }
    fireShard(from, to, n) {
      const a = this.posOf(from), b = this.posOf(to);
      const x = a.x, y = a.y, tx = b.x + rnd(-30, 30), ty = b.y + rnd(-30, 20);
      const sh = this.add.image(x, y, 'shard').setDepth(8).setScale(1.5).setBlendMode(Phaser.BlendModes.ADD);
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x, y), new Phaser.Math.Vector2((x + tx) / 2 + rnd(-80, 80), Math.min(y, ty) - rnd(100, 200)), new Phaser.Math.Vector2(tx, ty));
      const s = { t: 0 };
      this.tweens.add({ targets: s, t: 1, duration: 280, ease: 'Sine.In',
        onUpdate: () => { const q = curve.getPoint(s.t), q2 = curve.getPoint(Math.min(1, s.t + 0.05)); sh.setPosition(q.x, q.y).setRotation(Math.atan2(q2.y - q.y, q2.x - q.x) + Math.PI / 2); },
        onComplete: () => { sh.destroy(); this.num(tx, ty - 20, r0(n), 0.15, '#9ff7ff'); this.spark.explode(6, tx, ty); } });
    }
    killFx(o, loot) {
      const s = this.spr.get(o.id); if (!s) return;
      const P = this.posOf(o), big = o.boss;
      [[0, 0, -1, -1], [128, 0, 1, -1], [0, 128, -1, 1], [128, 128, 1, 1]].forEach(([cx, cy, dx, dy]) => {
        const pc = this.add.image(s.img.x, s.img.y, o.d.tex).setScale(s.sc).setCrop(cx, cy, 128, 128).setDepth(6);
        if (o.key === 'b2') pc.setTint(0xb8c4d0);
        this.tweens.add({ targets: pc, x: P.x + dx * rnd(70, 150) * (big ? 1.5 : 0.8), y: P.y + dy * 40 + rnd(40, 150), angle: dx * rnd(25, 70), alpha: 0, duration: 650, ease: 'Cubic.Out', onComplete: () => pc.destroy() });
      });
      const f = this.add.image(P.x, P.y, 'flash').setDepth(7).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe9a8);
      this.tweens.add({ targets: f, scale: big ? 8 : 3, alpha: 0, duration: 300, onComplete: () => f.destroy() });
      this.chipFx(o, P.x, P.y, big ? 40 : 14);
      this.hitStop(big ? 200 : 50); this.cameras.main.shake(big ? 400 : 110, big ? 0.02 : 0.007); SFX.brk(big);
      this.killSprite(s); this.spr.delete(o.id);
      // 보상 튀어나오기
      const items = Object.entries(loot).filter(([, n]) => n > 0);
      items.forEach(([k, n], i) => {
        const t = this.add.text(P.x + (i - (items.length - 1) / 2) * 70, P.y, k === 'gold' ? `🪙+${n}` : `${R.MATS[k].ico}+${n}`, { fontFamily: FONT, fontSize: k === 'gold' ? '30px' : '36px', color: k === 'gold' ? '#ffd54a' : '#ffffff', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(10);
        this.tweens.chain({ targets: t, tweens: [{ y: P.y - 70, duration: 300, ease: 'Back.Out' }, { y: 60, x: W / 2, alpha: 0.2, scale: 0.6, delay: 350, duration: 450, ease: 'Quad.In', onComplete: () => t.destroy() }] });
      });
      SFX.coin();
      const mats = items.filter(([k]) => k !== 'gold');
      logLine(`💥 ${nm2(o)} 와르르! 🪙+${loot.gold}${mats.length ? ` <span class="c-find">· 반짝! ${mats.map(([k, n]) => `${R.MATS[k].ico}${R.MATS[k].name}${n > 1 ? ' ' + n : ''}`).join(', ')} 주웠다</span>` : ''}`, o.boss ? 'good' : 'hit');
      function nm2(o) { return o.d.name; }
    }
    oreAttack(o, n, big) {
      const s = this.spr.get(o.id); if (!s || !this.pk) return;
      const P = this.posOf(o), tx = this.pk.x + Math.sin(this.pk.rotation) * this.pk.L * 0.6, ty = this.pk.y - Math.cos(this.pk.rotation) * this.pk.L * 0.6;
      if (big) {
        // 낙석: 위에서 바위들이 떨어짐
        this.warnG?.destroy(); this.warnG = null; this.warnT?.destroy(); this.warnT = null;
        for (let i = 0; i < 5; i++) {
          const r = this.add.image(tx + rnd(-90, 90), -60 - i * 40, 'rock').setScale(rnd(1.2, 2)).setDepth(11).setAngle(rnd(0, 360));
          this.tweens.add({ targets: r, y: ty + rnd(-30, 30), angle: r.angle + 180, duration: 260 + i * 50, ease: 'Quad.In', onComplete: () => { this.chipFx(o, r.x, r.y, 8); r.destroy(); } });
        }
        this.time.delayedCall(300, () => {
          SFX.slam(); this.cameras.main.shake(450, 0.025); this.cameras.main.flash(180, 255, 60, 60);
          this.num(tx, ty - 40, `-${n}`, 1, '#ff5a5f'); this.pkHurt(true);
        });
        logLine(`💥 낙석이 곡괭이를 덮쳤다! 내구도 -${n}`, 'warn');
        return;
      }
      // 일반 반격: 광물이 움찔 → 파편이 곡괭이로
      s.img.setTint(0xff7070); this.time.delayedCall(120, () => { if (s.img.active) { s.img.clearTint(); if (o.key === 'b2') s.img.setTint(0xb8c4d0); } });
      this.tweens.add({ targets: s.img, scale: s.sc * 1.1, duration: 90, yoyo: true });
      const col = o.d.tex === 'reso' ? 0x9ff7ff : o.d.tex === 'cursed' ? 0xc77dff : COLOR[o.d.tex] || 0xcccccc;
      for (let i = 0; i < 3; i++) {
        const c = this.add.image(P.x, P.y, 'chip').setTint(col).setScale(1.4).setDepth(8);
        this.tweens.add({ targets: c, x: tx + rnd(-20, 20), y: ty + rnd(-20, 20), angle: 360, duration: 220 + i * 40, ease: 'Quad.In', onComplete: () => c.destroy() });
      }
      this.time.delayedCall(240, () => { this.num(tx + 30, ty - 20, `-${n}`, 0.25, '#ff7a7a'); this.pkHurt(false); SFX.ouch(); });
      this.throttle('atk' + o.id, 2.5, () => logLine(`${o.d.name}: ${o.d.hit}! 내구도 -${n}`, 'hurt'));
    }
    pkHurt(big) {
      if (!this.pk) return;
      this.pk.list.forEach(c => { c.setTintFill(0xff4040); });
      this.time.delayedCall(90, () => this.pk?.list.forEach(c => { c.clearTint(); if (c === this.pk.head && this.p.head !== 'iron') c.setTint(R.HEADS[this.p.head].col); }));
      this.tweens.add({ targets: this.pk, x: this.pk.x + (big ? 18 : 8), duration: 40, yoyo: true, repeat: big ? 3 : 1 });
    }
    bossWarn(o) {
      SFX.warn();
      logLine(`⚠ ${josa(o.d.name, '이', '가')} 흔들린다… 큰 게 온다!`, 'warn');
      this.banner('⚠ 낙석 주의!', '#ff5a5f');
      const s = this.spr.get(o.id); if (s) this.tweens.add({ targets: s.img, x: s.img.x + 6, duration: 50, yoyo: true, repeat: 20 });
      // 곡괭이 위로 커지는 그림자
      this.warnG?.destroy();
      const g = this.warnG = this.add.ellipse(this.pk.x, this.pk.y - this.pk.L * 0.5, 60, 24, 0x000000, 0.45).setDepth(4);
      this.tweens.add({ targets: g, scaleX: 3.5, scaleY: 3.5, alpha: 0.7, duration: o.d.warn * 1000, ease: 'Sine.In' });
      this.warnT?.destroy();
      const t = this.warnT = this.add.text(this.pk.x, this.pk.y - this.pk.L - 90, '⚠', { fontFamily: FONT, fontSize: '84px', color: '#ff5a5f', stroke: '#000', strokeThickness: 10 }).setOrigin(0.5).setDepth(12);
      this.tweens.add({ targets: t, alpha: 0.2, scale: 1.25, duration: 220, yoyo: true, repeat: -1 });
    }
    breakPick() {
      this.running = false; this.warnG?.destroy(); this.warnG = null; this.warnT?.destroy(); this.warnT = null;
      SFX.brk(true); this.cameras.main.shake(500, 0.02);
      logLine(`💔 ${josa(R.pickShort(this.p), '이', '가')} 부서졌다…`, 'warn');
      this.banner('곡괭이 파손!', '#ff5a5f');
      this.tweens.killTweensOf(this.pk);
      this.pk.list.forEach((c, i) => this.tweens.add({ targets: c, x: c.x + (i ? 120 : -100), y: c.y + 260, angle: (i ? 1 : -1) * 160, alpha: 0, duration: 900, ease: 'Quad.In' }));
      this.aura?.destroy(); this.aura = null; this.headFx?.destroy(); this.headFx = null;
      this.time.timeScale = 1; this.tweens.timeScale = 1;
      setTimeout(() => { SFX.lose(); this.done('broken'); }, 1600);
    }
    clearStage() {
      this.running = false; this.warnG?.destroy(); this.warnG = null; this.warnT?.destroy(); this.warnT = null;
      logLine(this.b.S.story[2], 'story');
      this.banner('의뢰 완료!', '#5be37d');
      this.time.timeScale = 1; this.tweens.timeScale = 1;
      this.tweens.add({ targets: this.pk, y: this.pk.y - 60, rotation: 0, duration: 400, yoyo: true, ease: 'Sine.Out' });
      setTimeout(() => this.done('clear'), 1800);
    }
    banner(text, color) {
      const t = this.add.text(W / 2, H * 0.22, text, { fontFamily: FONT, fontSize: '54px', color, stroke: '#000', strokeThickness: 10 }).setOrigin(0.5).setDepth(13).setScale(0.5);
      this.tweens.chain({ targets: t, tweens: [{ scale: 1.1, duration: 140, ease: 'Back.Out' }, { scale: 1, duration: 80 }, { alpha: 0, delay: 700, duration: 300, onComplete: () => t.destroy() }] });
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', backgroundColor: '#120e14',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY, width: W, height: H },
    scene: [Forge, Mine],
  });
  window.__f = { G, R, game, startCraft, stageIntro, openFix, get battle() { return battle; }, get draft() { return draft; } };
})();
