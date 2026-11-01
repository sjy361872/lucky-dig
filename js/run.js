// =====================================================
//  탐험 진행 화면 — 광산 → 층(몬스터 전투) → 스핀(리롤·홀드) → 상점 → 보스 → 정산
//  블록을 캔 점수 = 몬스터에게 주는 대미지. 정해진 턴 안에 못 잡으면 몬스터가 공격해서 하트 -1
//  계산은 js/dig.js, 그리기는 js/render.js, 팝업·저장은 ui.js(UIX)
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

  let run = null, fl = null;

  // ---------- 화면 정보 ----------
  function showInfo() {
    if (!run) return;
    $('#playBet').textContent = `${floorLabel(run.floor)} / ${FLOORS}+보스`;
    $('#rerollText').textContent = run.rerolls + '회';
    $('#heartText').innerHTML = '❤'.repeat(Math.max(0, run.hearts)) + `<span class="lost">${'❤'.repeat(Math.max(0, run.maxHearts - run.hearts))}</span>`;
  }
  function setGaugeFor(quota) { R.setThresholds(D.thresholds(quota), quota * 0.2); }

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
    lastHp = f.quota; setHp(0); setAtk(f.spins);
  }
  function setHp(dmg) {
    if (!fl) return;
    const hp = Math.max(0, Math.round(fl.quota - dmg));
    $('#monHpFill').style.width = (hp / fl.quota * 100) + '%';
    $('#monHpText').textContent = `${fmt(hp)} / ${fmt(fl.quota)}`;
    if (hp < lastHp) { const b = $('#monster'); b.classList.remove('hurt'); void b.offsetWidth; b.classList.add('hurt'); }
    lastHp = hp;
  }
  function setAtk(n) {
    $('#monAtk').textContent = n;
    $('#monAtkBox').classList.toggle('danger', n <= 1);
  }
  R.onScore = v => { if (fl) setHp(v); };
  // 몬스터 공격 연출
  async function monsterAttack() {
    const b = $('#monster'), app = $('#app');
    b.classList.remove('attack'); void b.offsetWidth; b.classList.add('attack');
    await R.wait(220);
    Sound.play('last');
    app.classList.remove('shake'); void app.offsetWidth; app.classList.add('shake');
    R.floatText(140, 230, '-❤ 몬스터의 공격!', 'hurt', 1400);
    showInfo();
    await R.wait(900);
  }

  // ---------- 스핀 결정 (리롤 / 홀드 / 확정) ----------
  function decide() {
    return new Promise(res => {
      if (run.rerolls <= 0) return res();
      // 아쉬운 스핀(곡괭이 1개 이하, TNT·책 없음)일 때만 리롤을 물어봄. 괜찮은 스핀은 그대로 진행
      const g = fl.grid.flat();
      const weak = g.filter(D.isPick).length <= 1 && !g.some(x => x === 'tnt' || x === 'book' || x === 'superbook');
      if (!weak) return res();
      if (R.state.auto) {   // 테스트: 첫 열만 고정하고 리롤 1번
        if (run.rerolls > 1 && fl.spinCount === 1) { const ev = D.reroll(run, fl, [true, false, false, false, false]); showInfo(); return R.play([ev]).then(res); }
        return res();
      }
      const bar = $('#spinActions'), slot = $('#slot');
      const held = [false, false, false, false, false];
      const paint = () => {
        R.setHeld(held);
        $('#btnReroll').innerHTML = `🔄 리롤 <small>${run.rerolls}회 남음</small>`;
        $('#btnReroll').classList.toggle('disabled', run.rerolls <= 0);
        $('#holdHint').textContent = held.some(Boolean) ? `고정한 열 ${held.filter(Boolean).length}개는 그대로 두고 다시 돌려요` : '아쉬운 스핀! 다시 돌릴까요? (열을 누르면 고정)';
      };
      bar.hidden = false; paint();
      slot.classList.add('pickable');
      const onSlot = e => {
        const cell = e.target.closest('.slot-cell');
        if (!cell) return;
        const c = +cell.dataset.c;
        held[c] = !held[c]; Sound.play('click'); paint();
      };
      const done = () => { bar.hidden = true; slot.classList.remove('pickable'); slot.removeEventListener('click', onSlot); R.setHeld([]); };
      slot.addEventListener('click', onSlot);
      $('#btnConfirm').onclick = () => { Sound.play('click'); done(); res(); };
      $('#btnReroll').onclick = async () => {
        if (run.rerolls <= 0 || held.every(Boolean)) { X().toast(held.every(Boolean) ? '전부 고정하면 리롤할 수 없어요' : '리롤이 없어요'); return; }
        bar.hidden = true;
        const ev = D.reroll(run, fl, held);
        showInfo();
        R.setHeld(held);
        await R.play([ev]);
        if (run.rerolls <= 0) { done(); res(); return; }
        bar.hidden = false; paint();
      };
    });
  }

  // ---------- 한 층 ----------
  async function playFloor() {
    fl = D.createFloor(run);
    R.drawBoard(fl.initialBoard, fl.initialChests);
    R.clearSlot();
    setGaugeFor(fl.quota);
    R.resetScore();
    showMonster(fl);
    showInfo();
    Sound.play(fl.boss ? 'drumroll' : 'click');
    await R.banner(fl.boss ? 'BOSS' : `${run.floor + 1}F`, fl.boss ? 'last' : '');
    X().toast(`${fl.monster.name} 등장! 체력 ${fmt(fl.quota)}`);
    await R.play([{ type: 'init', spins: fl.spins }]);
    while (!D.floorDone(fl, run)) {
      const ev = D.startSpin(run, fl);
      setAtk(fl.spins + 1);
      await R.play([ev]);
      await decide();
      await R.play(D.resolveSpin(run, fl));
      const t = D.endTurn(run, fl);
      if (t.attacked) await monsterAttack();
      setAtk(fl.spins); R.setSpins(fl.spins);
      if (t.refill) {
        X().toast('블록을 다 캤어요! 새 광맥이 열려요');
        await R.wait(500);
        R.drawBoard(fl.initialBoard, fl.initialChests);
        await R.wait(400);
      }
    }
    return D.floorResult(run, fl);
  }

  // ---------- 층 결과 ----------
  async function showFloorResult(res) {
    if (res.pass) {
      $('#monster').classList.add('dead');
      Sound.play(res.boss || res.perfect ? 'fanfare' : 'big');
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
  // 잡은 몬스터 카드 보여주기
  function cardGet(res) {
    return new Promise(done => {
      const m = X().modal(`<div class="newcard">${res.newCard ? '<b class="good">✨ 새 카드! 도감에 등록됐어요</b>' : '<small class="muted">이미 가진 카드예요 (도감 횟수 +1)</small>'}
        ${Art.card(res.monster)}<button class="rowbtn gold big" id="ncOk">계속</button></div>`, { title: `${res.monster.name} 포획!`, noClose: true, cls: 'small' });
      Sound.play('coin');
      m.el.querySelector('#ncOk').onclick = () => { Sound.play('click'); m.close(); done(); };
    });
  }

  // ---------- 상점 ----------
  function itemIcon(it) { return it.icon ? `<span class="shop-ic">${Art.item(it.icon)}</span>` : `<span class="shop-ic emoji">${it.emoji}</span>`; }
  function ownedHtml() {
    if (!run.picks.length) return '<small class="muted">아직 고른 것이 없어요</small>';
    const cnt = {};
    run.picks.forEach(id => { cnt[id] = (cnt[id] || 0) + 1; });
    return Object.entries(cnt).map(([id, n]) => { const it = RL.byId[id]; return `<span class="owned" title="${it.desc}">${it.icon ? Art.item(it.icon) : it.emoji}${n > 1 ? `<b>×${n}</b>` : ''}</span>`; }).join('');
  }
  function shop(res) {
    return new Promise(resolve => {
      const opts = RL.offer(run, D.shopSize(res), run.rng);
      const m = X().modal(`
        <p class="muted center">${res.turns}턴 만에 처치 · 하트 ${'❤'.repeat(run.hearts)}
          ${res.perfect ? '<br><b class="good">★ 무피해 처치 보너스: 선택지 +1</b>' : ''}</p>
        <div class="shop">${opts.map(it => `<button class="shop-item r${it.rare}" data-id="${it.id}">${itemIcon(it)}
          <span class="shop-txt"><small class="rar">${RL.RARITY_NAME[it.rare]} · ${it.kind === 'symbol' ? '심볼' : it.kind === 'relic' ? '유물' : '회복'}</small><b>${it.name}</b><span>${it.desc}</span></span></button>`).join('')}</div>
        <div class="owned-row"><small>지금 가진 것 · 리롤 ${run.rerolls}회 · 하트 ${run.hearts}/${run.maxHearts}</small><div>${ownedHtml()}</div></div>`,
      { title: `${res.monster.name} 처치! 하나 고르세요`, noClose: true });
      if (R.state.auto) setTimeout(() => m.el.querySelector('.shop-item').click(), 200);
      m.el.querySelectorAll('.shop-item').forEach(b => b.onclick = () => {
        RL.take(run, b.dataset.id);
        Sound.play('coin');
        m.close();
        X().toast(`${RL.byId[b.dataset.id].name} 획득!`);
        showInfo();
        resolve();
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
        <p class="muted center">${mineName(run.mine)} · ${run.cleared ? '보스까지 클리어' : `${floorLabel(run.results.length - 1)}에서 쓰러짐`}</p>
        <div class="re-floors">${run.results.map((r, i) =>
          `<div class="${r.pass ? '' : 'fail'}"><small>${floorLabel(i)}</small><span class="chip" style="background:${r.perfect ? '#e8a317' : r.pass ? '#3a9a3a' : '#555'}">${r.perfect ? '★' : r.pass ? '✓' : '✕'}</span></div>`).join('')}</div>
        ${run.caught && run.caught.length ? `<small class="muted">잡은 몬스터 (${run.caught.filter(c => c.isNew).length}장 새로 등록)</small><div class="capt">${run.caught.map(c => Art.card(c)).join('')}</div>` : ''}
        <div class="re-ore">⛏ 광석 <b>+${fmt(ore)}</b></div>
        ${unlockedNew ? `<p class="good center">🔓 새 광산 해금: <b>${mineName(run.mine + 1)}</b></p>` : ''}
        <div class="owned-row"><small>이번 탐험에서 고른 것</small><div>${ownedHtml()}</div></div>
        <button class="rowbtn gold big" id="reOk">확인</button></div>`, { title: '탐험 결과', noClose: true });
      m.el.querySelector('#reOk').onclick = () => { Sound.play('click'); m.close(); res(); };
      if (R.state.auto) { document.title = `AUTORUN 끝 층${run.results.length} 정복:${run.cleared} 광석:${ore} 유물:${run.picks.join(',')}`; setTimeout(() => m.el.querySelector('#reOk').click(), 300); }
    });
  }

  // ---------- 시작 ----------
  async function start() {
    const ux = X();
    if (ux.isBusy()) return;
    const S = ux.S();
    ux.setBusy(true);
    Sound.unlock(); Sound.play('click');
    run = D.newRun({ mine: S.mine });
    try {
      $('#panelIdle').hidden = true; $('#panelPlay').hidden = false;
      document.body.classList.add('battle');
      R.state.skipping = false;
      while (!run.over) {
        const res = await playFloor();
        D.advance(run, res);
        await showFloorResult(res);
        if (!run.over) await shop(res);
      }
      await finish();
    } catch (e) {
      console.error(e);
      $('#overlay').hidden = true;
      ux.toast('오류가 발생했습니다: ' + e.message);
    } finally {
      run = null; fl = null;
      document.body.classList.remove('battle'); $('#monster').hidden = true;
      $('#spinActions').hidden = true; $('#slot').classList.remove('pickable');
      $('#panelIdle').hidden = false; $('#panelPlay').hidden = true;
      R.state.skipping = false;
      ux.setBusy(false);
      ux.refreshIdle();
    }
  }

  root.Run = { start, mineName, mineKeys, current: () => run, floor: () => fl };
})(window);
