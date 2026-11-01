// =====================================================
//  탐험 진행 화면 — 광산 → 층 → 스핀(리롤·홀드) → 상점 → 보스 → 정산
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
  }
  function setGaugeFor(quota) { R.setThresholds(D.thresholds(quota), quota * 0.2); }

  // ---------- 스핀 결정 (리롤 / 홀드 / 확정) ----------
  function decide() {
    return new Promise(res => {
      if (run.rerolls <= 0) return res();
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
        $('#holdHint').textContent = held.some(Boolean) ? `고정한 열 ${held.filter(Boolean).length}개는 그대로 두고 다시 돌려요` : '열을 눌러 고정(홀드)한 뒤 리롤할 수 있어요';
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
    showInfo();
    Sound.play(fl.boss ? 'drumroll' : 'click');
    await R.banner(fl.boss ? 'BOSS' : `${run.floor + 1}F`, fl.boss ? 'last' : '');
    X().toast(`${floorLabel(run.floor)} 목표 ${fmt(fl.quota)}점`);
    await R.play([{ type: 'init', spins: fl.spins }]);
    while (!D.floorDone(fl)) {
      const ev = D.startSpin(run, fl);
      await R.play([ev]);
      await decide();
      await R.play(D.resolveSpin(run, fl));
    }
    return D.floorResult(run, fl);
  }

  // ---------- 층 결과 ----------
  async function showFloorResult(res) {
    const g = C.GRADES.find(x => x.id === res.grade);
    if (res.pass) {
      Sound.play(res.gi <= 1 ? 'fanfare' : 'big');
      R.floatText(140, 200, `${res.boss ? '보스 격파!' : '통과!'} ${g.id}상`, 'chestmult t' + Math.max(0, 4 - res.gi), 1800);
    } else {
      Sound.play('last');
      R.floatText(140, 200, `실패… ${fmt(res.score)} / ${fmt(res.quota)}`, 'big', 1800);
    }
    await R.wait(1600);
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
      const g = C.GRADES.find(x => x.id === res.grade);
      const m = X().modal(`
        <p class="muted center"><span class="chip" style="background:${g ? g.color : '#888'}">${res.grade}상</span> ${fmt(res.score)}점 (목표 ${fmt(res.quota)})
          ${res.gi >= 0 && res.gi <= 2 ? '<br><b class="good">B상 이상 보너스: 선택지 +1</b>' : ''}</p>
        <div class="shop">${opts.map(it => `<button class="shop-item r${it.rare}" data-id="${it.id}">${itemIcon(it)}
          <span class="shop-txt"><small class="rar">${RL.RARITY_NAME[it.rare]} · ${it.kind === 'symbol' ? '심볼' : it.kind === 'relic' ? '유물' : '회복'}</small><b>${it.name}</b><span>${it.desc}</span></span></button>`).join('')}</div>
        <div class="owned-row"><small>지금 가진 것 · 리롤 ${run.rerolls}회</small><div>${ownedHtml()}</div></div>`,
      { title: `${floorLabel(run.floor - 1)} 통과! 하나 고르세요`, noClose: true });
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
        <p class="muted center">${mineName(run.mine)} · ${run.cleared ? '보스까지 클리어' : `${floorLabel(run.results.length - 1)}에서 멈춤`}</p>
        <div class="re-floors">${run.results.map((r, i) => { const g = C.GRADES.find(x => x.id === r.grade);
          return `<div class="${r.pass ? '' : 'fail'}"><small>${floorLabel(i)}</small><span class="chip" style="background:${g ? g.color : '#555'}">${r.pass ? r.grade : '✕'}</span></div>`; }).join('')}</div>
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
      $('#spinActions').hidden = true; $('#slot').classList.remove('pickable');
      $('#panelIdle').hidden = false; $('#panelPlay').hidden = true;
      R.state.skipping = false;
      ux.setBusy(false);
      ux.refreshIdle();
    }
  }

  root.Run = { start, mineName, mineKeys, current: () => run, floor: () => fl };
})(window);
