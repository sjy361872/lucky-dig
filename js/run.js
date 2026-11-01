// =====================================================
//  탐험 진행 화면 (슬롯 덱빌딩)
//   광산 → 층(몬스터) → [스핀 → 심볼 3택1] 반복 → 처치 → 층 보상(동료·심볼·회복) → … → 보스 → 정산
//   계산은 js/dig.js, 심볼·동료 목록은 js/relics.js, 그리기는 js/render.js, 팝업·저장은 ui.js(UIX)
// =====================================================
(function (root) {
  const C = root.CONFIG, D = root.Dig, RL = root.Relics, R = root.Render, Art = root.Art, Sound = root.Sound;
  const $ = s => document.querySelector(s);
  const fmt = R.fmt;
  const X = () => root.UIX;
  const FLOORS = C.RUN.FLOORS;
  const mineKeys = () => Object.keys(C.TIERS).sort((a, b) => a - b);
  const mineName = m => C.TIERS[mineKeys()[m]].name;
  const floorLabel = f => (f >= FLOORS ? '보스층' : `${f + 1}층`);
  const fM = n => (Math.round(n * 100) / 100).toString();

  let run = null, fl = null;

  // 도감에서 잡은 몬스터 → 동료 후보
  function collection() {
    const out = [];
    for (const key of Object.keys(X().S().dex || {})) {
      const p = key.split(':');
      if (p[0] === 'G') { const c = C.G_CARDS[+p[1]]; if (c) out.push({ ...c, grade: 'G', idx: +p[1], tier: 'G' }); continue; }
      const list = C.TIERS[p[0]] && C.TIERS[p[0]].cards[p[1]];
      if (list && list[+p[2]]) out.push({ ...list[+p[2]], grade: p[1], idx: +p[2], tier: p[0] });
    }
    return out;
  }

  // ---------- 화면 정보 ----------
  function showInfo() {
    if (!run) return;
    $('#playBet').textContent = `${floorLabel(run.floor)} / ${FLOORS}+보스`;
    $('#rerollText').textContent = `${run.deck.length}장${run.comps.length ? ' · 동료 ' + run.comps.length : ''}`;
    $('#heartText').innerHTML = '❤'.repeat(Math.max(0, run.hearts)) + `<span class="lost">${'❤'.repeat(Math.max(0, run.maxHearts - run.hearts))}</span>`;
    $('#monHearts').innerHTML = $('#heartText').innerHTML;
  }

  // ---------- 몬스터 표시 ----------
  let lastHp = 0;
  function showMonster(f) {
    const mo = f.monster, g = C.GRADES.find(x => x.id === mo.grade);
    const box = $('#monster');
    box.hidden = false;
    box.className = f.boss ? 'boss' : '';
    $('#monImg').src = C.cardImg(mo);
    $('#monGrade').textContent = mo.grade; $('#monGrade').style.background = g ? g.color : '#888';
    $('#monName').textContent = (f.boss ? '👑 ' : '') + mo.name;
    const gh = $('#monHpGhost'); gh.style.transition = 'none';
    lastHp = f.quota; setHp(0); setAtk(f.spins);
    void gh.offsetWidth; gh.style.transition = '';
  }
  function setHp(dmg) {
    if (!fl) return;
    const hp = Math.max(0, Math.round(fl.quota - dmg));
    $('#monHpFill').style.width = (hp / fl.quota * 100) + '%';
    $('#monHpGhost').style.width = (hp / fl.quota * 100) + '%';
    $('#monHpText').textContent = `${fmt(hp)} / ${fmt(fl.quota)}`;
    lastHp = hp;
  }
  function setAtk(n) {
    $('#monAtk').textContent = n;
    $('#monAtkBox').classList.toggle('danger', n <= 1);
  }
  R.onScore = v => { if (fl) setHp(v); };
  async function monsterAttack() {
    Sound.play('last');
    await R.monsterHit();
    R.floatText(140, 230, '-❤ 몬스터의 공격!', 'hurt', 1400);
    await R.wait(500);
    R.floatText(140, 270, '덱에 🪨 돌멩이가 들어왔어요', 'symf', 1500);
    showInfo();
    await R.wait(800);
  }

  // ---------- 심볼·동료 그리기 ----------
  const symIcon = (id, plus) => { const P = C.PICKS[id]; return `${Art.item(id)}${P ? `<span class="badge${plus ? ' up' : ''}">${P.power + (plus || 0)}</span>` : ''}`; };
  const compLine = c => `<div class="cp"><img src="${C.cardImg(c)}" alt=""><div><b>${c.name}</b> <small>${c.grade}상 · ${RL.COMP[c.elem] ? RL.COMP[c.elem].name : ''}</small><br>${RL.compText(c)}</div></div>`;
  function deckHtml(pickable) {
    const order = Object.keys(RL.SYMBOLS);
    const list = run.deck.map((d, i) => ({ ...d, i })).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id) || b.plus - a.plus);
    return `<div class="deckview ${pickable ? 'pick' : ''}">${list.map(d => `<div class="dc ${d.id === 'pebble' ? 'x' : ''}" data-i="${d.i}" title="${RL.SYMBOLS[d.id].name}: ${RL.SYMBOLS[d.id].desc}">${symIcon(d.id, d.plus)}</div>`).join('')}</div>`;
  }
  function openDeck() {
    if (!run) return;
    X().modal(`<p class="muted center">덱 ${run.deck.length}장 · 슬롯 20칸 (20장이 넘으면 무작위 20장만 나와요)${run.permMult ? `<br>영구 배율 +${fM(run.permMult)}` : ''}</p>
      ${deckHtml(false)}
      <div class="complist">${run.comps.length ? run.comps.map(compLine).join('') : '<small class="muted center">동료 없음 — 층을 깨면 잡은 몬스터를 동료로 데려갈 수 있어요</small>'}</div>`,
    { title: '내 덱 · 동료', cls: 'small' });
  }

  // ---------- 스핀 후: 심볼 3택1 (+ 3스핀마다 1장 빼기) ----------
  function draft() {
    return new Promise(done => {
      const opts = D.draftOffer(run), canRm = D.canRemove(run);
      if (R.state.auto) { D.addSymbol(run, opts[0]); showInfo(); return done(); }
      let removed = false;
      const m = X().modal(`<div class="draft">
        ${opts.map(id => { const s = RL.SYMBOLS[id]; return `<button class="opt r${s.rare}" data-id="${id}"><div class="ic">${symIcon(id)}</div><div><small class="rar">${RL.RARITY_NAME[s.rare] || ''}</small><b>${s.name}</b><span>${s.desc}</span></div></button>`; }).join('')}
        <div class="row2"><button class="rowbtn" id="dSkip">건너뛰기</button>${canRm ? '<button class="rowbtn" id="dRm">🗑 1장 빼기</button>' : ''}<button class="rowbtn" id="dDeck">덱 보기 (${run.deck.length})</button></div></div>`,
      { title: '덱에 넣을 심볼 하나', noClose: true, cls: 'small' });
      const after = async () => { m.close(); showInfo(); if (canRm && !removed) await removePrompt(true); done(); };
      m.el.querySelectorAll('.opt').forEach(b => b.onclick = () => { D.addSymbol(run, b.dataset.id); Sound.play('coin'); after(); });
      m.el.querySelector('#dSkip').onclick = () => { Sound.play('click'); after(); };
      m.el.querySelector('#dDeck').onclick = () => openDeck();
      const rm = m.el.querySelector('#dRm');
      if (rm) rm.onclick = async () => { removed = true; rm.remove(); await removePrompt(false); m.el.querySelector('#dDeck').textContent = `덱 보기 (${run.deck.length})`; };
    });
  }
  // 덱에서 1장 빼기 (optional = 건너뛸 수 있음)
  function removePrompt(optional) {
    return new Promise(done => {
      const m = X().modal(`<p class="muted center">뺄 심볼을 누르세요. 돌멩이(🪨)나 약한 곡괭이를 빼면 좋은 심볼이 더 자주 나와요</p>
        ${deckHtml(true)}<div style="display:flex;margin-top:8px"><button class="rowbtn" id="rmSkip" style="flex:1">${optional ? '안 빼기' : '취소'}</button></div>`,
      { title: '🗑 1장 빼기', noClose: true, cls: 'small' });
      m.el.querySelectorAll('.dc').forEach(b => b.onclick = () => { D.removeCard(run, +b.dataset.i); Sound.play('break', { type: 'stone' }); m.close(); showInfo(); done(); });
      m.el.querySelector('#rmSkip').onclick = () => { m.close(); done(); };
    });
  }

  // ---------- 한 층 ----------
  async function playFloor() {
    fl = D.createFloor(run);
    R.drawBoard(fl.initialBoard, fl.initialChests);
    R.clearSlot();
    R.resetScore(); R.setCM(0, 1 + run.permMult, true);
    showMonster(fl);
    showInfo();
    Sound.play(fl.boss ? 'drumroll' : 'click');
    await R.banner(fl.boss ? 'BOSS' : `${run.floor + 1}F`, fl.boss ? 'last' : '');
    X().toast(`${fl.monster.name} 등장! 체력 ${fmt(fl.quota)}`);
    R.setSpins(fl.spins);
    while (!D.floorDone(fl, run)) {
      const ev = D.startSpin(run, fl);
      setAtk(fl.spins + 1);
      await R.play([ev]);
      await R.play(D.resolveSpin(run, fl));
      showInfo();
      const t = D.endTurn(run, fl);
      if (t.attacked) await monsterAttack();
      setAtk(fl.spins); R.setSpins(fl.spins);
      if (t.refill) {
        X().toast('블록을 다 캤어요! 새 광맥이 열려요');
        await R.wait(500);
        R.drawBoard(fl.initialBoard, fl.initialChests);
        await R.wait(400);
      }
      if (!D.floorDone(fl, run)) await draft();
    }
    return D.floorResult(run, fl);
  }

  // ---------- 층 결과 ----------
  async function showFloorResult(res) {
    if (res.pass) {
      Sound.play(res.boss || res.perfect ? 'fanfare' : 'big');
      await R.monsterDie();
      R.floatText(140, 200, `${res.boss ? '보스 격파!' : '처치!'}${res.perfect ? ' 무피해 ★' : ''}`, 'kill', 1800);
      res.newCard = X().recordDex(res.monster);
      run.caught = (run.caught || []).concat([{ ...res.monster, isNew: res.newCard }]);
      X().save();
      await R.wait(1300);
      if (!R.state.auto) await cardGet(res);
    } else {
      Sound.play('last');
      R.floatText(140, 200, '쓰러졌어요…', 'hurt', 1800);
      await R.wait(1600);
    }
  }
  function cardGet(res) {
    return new Promise(done => {
      const m = X().modal(`<div class="newcard">${res.newCard ? '<b class="good">✨ 새 카드! 도감에 등록됐어요</b>' : '<small class="muted">이미 가진 카드예요 (도감 횟수 +1)</small>'}
        ${Art.card(res.monster)}${RL.COMP[res.monster.elem] ? `<small class="muted">동료 효과: ${RL.compText(res.monster)}</small>` : ''}<button class="rowbtn gold big" id="ncOk">계속</button></div>`, { title: `${res.monster.name} 포획!`, noClose: true, cls: 'small' });
      Sound.play('coin');
      m.el.querySelector('#ncOk').onclick = () => { Sound.play('click'); m.close(); done(); };
    });
  }

  // ---------- 층 보상 (큰 선택) ----------
  function optHtml(o, i) {
    if (o.kind === 'comp') return `<button class="opt rE" data-i="${i}"><img class="cpimg" src="${C.cardImg(o.card)}" alt=""><div><small class="rar">동료 · ${o.card.grade}상 · ${RL.COMP[o.card.elem].name}</small><b>${o.card.name}</b><span>${RL.compText(o.card)}</span></div></button>`;
    if (o.kind === 'sym') { const s = RL.SYMBOLS[o.id]; return `<button class="opt r${s.rare}" data-i="${i}"><div class="ic">${symIcon(o.id)}</div><div><small class="rar">심볼 · ${RL.RARITY_NAME[s.rare]}</small><b>${s.name}</b><span>${s.desc}</span></div></button>`; }
    if (o.kind === 'heal') return `<button class="opt rR" data-i="${i}"><div class="ic itememoji">❤️</div><div><small class="rar">회복</small><b>회복 물약</b><span>하트 +1 (가득 차 있으면 최대 하트 +1, 최대 5)</span></div></button>`;
    return `<button class="opt" data-i="${i}"><div class="ic itememoji">🧹</div><div><small class="rar">정화</small><b>덱 청소</b><span>돌멩이 2장을 빼요 (없으면 돌 곡괭이)</span></div></button>`;
  }
  function reward(res) {
    return new Promise(resolve => {
      const opts = D.rewardOffer(run, res, D.shopSize(res));
      if (R.state.auto) { D.takeReward(run, opts[0]); showInfo(); return resolve(); }
      const m = X().modal(`<p class="muted center">${res.turns}턴 만에 처치 · 하트 ${'❤'.repeat(run.hearts)}${res.perfect ? '<br><b class="good">★ 무피해 처치 보너스: 선택지 +1</b>' : ''}</p>
        <div class="draft">${opts.map(optHtml).join('')}</div>
        <div style="display:flex;margin-top:8px"><button class="rowbtn" id="rwDeck" style="flex:1">덱 · 동료 보기</button></div>`,
      { title: `${res.monster.name} 처치! 보상 하나`, noClose: true });
      m.el.querySelector('#rwDeck').onclick = () => openDeck();
      m.el.querySelectorAll('.opt').forEach(b => b.onclick = () => {
        const o = opts[+b.dataset.i];
        D.takeReward(run, o);
        Sound.play('coin'); m.close();
        X().toast(o.kind === 'comp' ? `${o.card.name}이(가) 동료가 됐어요!` : o.kind === 'heal' ? '하트 회복!' : o.kind === 'purge' ? '덱을 청소했어요' : `${RL.SYMBOLS[o.id].name} 획득!`);
        showInfo(); resolve();
      });
    });
  }

  // ---------- 정산 ----------
  function finish() {
    const S = X().S();
    const ore = D.oreFor(run);
    const passed = run.results.filter(r => r.pass).length;
    S.ore = (S.ore || 0) + ore;
    S.best[run.mine] = Math.max(S.best[run.mine] || 0, passed);
    let unlockedNew = false;
    if (run.cleared && run.mine + 1 < mineKeys().length && S.unlocked < run.mine + 1) { S.unlocked = run.mine + 1; unlockedNew = true; }
    S.runs = (S.runs || 0) + 1;
    X().save(); X().refreshIdle();
    return new Promise(res => {
      const m = X().modal(`<div class="runend ${run.cleared ? 'win' : ''}">
        <div class="re-title">${run.cleared ? '🏆 광산 정복!' : '탐험 종료'}</div>
        <p class="muted center">${mineName(run.mine)} · ${run.cleared ? '보스까지 클리어' : `${floorLabel(run.results.length - 1)}에서 쓰러짐`} · 스핀 ${run.spinsTotal}번</p>
        <div class="re-floors">${run.results.map((r, i) =>
          `<div class="${r.pass ? '' : 'fail'}"><small>${floorLabel(i)}</small><span class="chip" style="background:${r.perfect ? '#e8a317' : r.pass ? '#3a9a3a' : '#555'}">${r.perfect ? '★' : r.pass ? '✓' : '✕'}</span></div>`).join('')}</div>
        ${run.caught && run.caught.length ? `<small class="muted">잡은 몬스터 (${run.caught.filter(c => c.isNew).length}장 새로 등록)</small><div class="capt">${run.caught.map(c => Art.card(c)).join('')}</div>` : ''}
        <div class="re-ore">⛏ 광석 <b>+${fmt(ore)}</b></div>
        ${unlockedNew ? `<p class="good center">🔓 새 광산 해금: <b>${mineName(run.mine + 1)}</b></p>` : ''}
        <small class="muted">마지막 덱 (${run.deck.length}장)</small>${deckHtml(false)}
        ${run.comps.length ? `<div class="complist">${run.comps.map(compLine).join('')}</div>` : ''}
        <button class="rowbtn gold big" id="reOk">확인</button></div>`, { title: '탐험 결과', noClose: true });
      m.el.querySelector('#reOk').onclick = () => { Sound.play('click'); m.close(); res(); };
      if (R.state.auto) { document.title = `AUTORUN 끝 층${run.results.length} 정복:${run.cleared} 광석:${ore} 덱:${run.deck.length} 스핀:${run.spinsTotal}`; setTimeout(() => m.el.querySelector('#reOk').click(), 300); }
    });
  }

  // ---------- 시작 ----------
  async function start() {
    const ux = X();
    if (ux.isBusy()) return;
    const S = ux.S();
    ux.setBusy(true);
    Sound.unlock(); Sound.play('click');
    run = D.newRun({ mine: S.mine, collection: collection() });
    try {
      $('#panelIdle').hidden = true; $('#panelPlay').hidden = false;
      document.body.classList.add('battle');
      R.state.skipping = false;
      while (!run.over) {
        const res = await playFloor();
        D.advance(run, res);
        await showFloorResult(res);
        if (!run.over) await reward(res);
      }
      await finish();
    } catch (e) {
      console.error(e);
      $('#overlay').hidden = true;
      ux.toast('오류가 발생했습니다: ' + e.message);
      document.title = 'ERROR ' + e.message;
    } finally {
      run = null; fl = null;
      document.body.classList.remove('battle'); $('#monster').hidden = true;
      $('#spinActions').hidden = true;
      $('#panelIdle').hidden = false; $('#panelPlay').hidden = true;
      R.state.skipping = false;
      ux.setBusy(false);
      ux.refreshIdle();
    }
  }
  document.addEventListener('click', e => { if (e.target.closest('#deckBtn')) openDeck(); });

  root.Run = { start, mineName, mineKeys, current: () => run, floor: () => fl };
})(window);
