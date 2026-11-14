// 화면 자동 테스트 — index.html#uitest 로 열면 실행 (실제 버튼을 눌러서 확인)
(function () {
  // 항상 빈 기록에서 시작: 저장 데이터를 지우고 한 번 새로고침
  if (!sessionStorage.getItem('uitestReset')) { if (window.Rank) { clearTimeout(window.Rank._t); window.Rank._pending = null; window.Rank.me = null; } ['luckydig.v1', 'luckydig.rank.local', 'luckydig.profile'].forEach(k => localStorage.removeItem(k)); sessionStorage.setItem('uitestReset', '1'); location.reload(); return; }
  sessionStorage.removeItem('uitestReset');
  const C = window.CONFIG, R = window.Render;
  const $ = s => document.querySelector(s);
  const num = s => +String(s).replace(/[^0-9-]/g, '');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = [], fails = [];
  const check = (ok, msg) => { (ok ? log : fails).push((ok ? 'OK   ' : 'FAIL ') + msg); };
  async function until(fn, ms = 120000) { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('timeout'); await sleep(50); } }
  window.confirm = () => true;

  async function run() {
    R.state.speed = 40;
    await window.Rank.login('테스터');
    const st = () => window.Rank.me.stats;
    check(st().rankPoints === C.RANK_BASE, '랭크 포인트 시작 10,000');
    const ROUNDS = 8;
    for (let i = 0; i < ROUNDS; i++) {
      const P = num($('#pointsText').textContent), B = num($('#betText').textContent);
      $('#btnPlay').click();
      await sleep(20);
      check(num($('#pointsText').textContent) === P - B, `[${i}] 플레이 시 ${B}pt 차감`);
      await until(() => $('#keep'));
      const grade = $('.result .chip').textContent.replace('상', '');
      const value = num($('.rrow b').textContent);
      const score = num($('#scoreText').textContent);
      const gi = C.GRADES.findIndex(g => g.id === grade);
      const lo = C.GRADES[gi].need * B, hi = (gi === 0 ? C.S_CAP : C.GRADES[gi - 1].need) * B;
      check(score >= lo && score < hi, `[${i}] ${grade}상, 화면 스코어 ${score}가 구간 [${lo}, ${hi}) 안`);
      check(C.cardsFor(B, grade).some(c => ['mild', 'hard'].some(m => value === window.Engine.cardValue(C.GRADES[gi], c, B, m))), `[${i}] 환원 값 ${value}이 ${grade}상 카드 값 중 하나`);
      const sell = i % 2 === 0;
      if (sell) { $('#sell').click(); await until(() => $('#ok')); $('#ok').click(); }
      else $('#keep').click();
      await until(() => !$('#panelIdle').hidden);
      check(num($('#pointsText').textContent) === P - B + (sell ? value : 0), `[${i}] ${sell ? '교환' : '보관'} 후 포인트`);
    }
    // 랭킹 기록: 랭크 포인트 = 10,000 + 받은 합 − 쓴 합
    check(st().plays === ROUNDS, `랭킹 플레이 수 ${st().plays}`);
    check(st().rankPoints === C.RANK_BASE + st().earned - st().spent, `랭크 포인트 ${st().rankPoints} = 10,000 + ${st().earned} − ${st().spent}`);
    check(st().best && st().best.mult > 0, '최고 배율 기록됨');
    // 도감: 뽑은 카드 종류 수만큼 등록
    const saved0 = JSON.parse(localStorage.getItem('luckydig.v1'));
    check(Object.keys(saved0.dex).length >= 1 && Object.values(saved0.dex).reduce((a, d) => a + d.n, 0) === ROUNDS, `도감 등록 ${Object.keys(saved0.dex).length}종, 합계 ${ROUNDS}회`);
    // 보관함
    $('#btnBag').click();
    document.querySelectorAll('.tabs button')[1].click(); await sleep(100);
    check(document.querySelectorAll('.dexcard').length > 0 && document.querySelectorAll('.dexcard:not(.none)').length >= 1, '도감 화면: 얻은 카드 표시');
    document.querySelectorAll('.tabs button')[0].click(); await sleep(100);
    const n = document.querySelectorAll('.bagitem').length;
    const gifts = window.UI.state().inventory.filter(x => x.kind === 'gift').length; // 시간 선물 포인트 카드 (테스트 중 자동 지급)
    check(n === ROUNDS / 2 + gifts, `보관함 ${n}장 (기대 ${ROUNDS / 2} + 선물 ${gifts})`);
    const P1 = num($('#pointsText').textContent);
    const total = [...document.querySelectorAll('.bagitem small')].reduce((a, s) => a + num(s.innerHTML.split('<br>')[1]), 0);
    $('#sellAll').click();
    check(num($('#pointsText').textContent) === P1 + total, `전부 교환 +${total}pt`);
    check(document.querySelectorAll('.bagitem').length === 0, '보관함 비워짐');
    $('.closebtn').click();
    // 소비 포인트 변경 / 포인트 부족
    $('#betPlus').click();
    check(num($('#betText').textContent) === C.BETS[1], '+ 버튼으로 2,000pt');
    for (let i = 0; i < 20; i++) $('#betPlus').click();
    check(num($('#betText').textContent) === C.BETS[C.BETS.length - 1], '+ 끝까지 500,000pt');
    $('#btnPlay').click();
    await sleep(50);
    check(!document.querySelector('.chargegrid') && !$('#overlay').hidden === false, '일반 계정: 포인트 부족해도 충전 창 안 뜸');
    $('#pointsPill').click(); await sleep(50);
    check(!document.querySelector('.chargegrid'), '일반 계정: + 눌러도 충전 불가');
    check(getComputedStyle(document.querySelector('.pill .plus')).display === 'none', '일반 계정: + 버튼 숨김');
    // 관리자 지급: 관리자(관리자1)로 바꿔서 테스터에게 지급 → 테스터로 돌아와서 받기
    C.ADMINS.push('관리자1');
    const P2 = num($('#pointsText').textContent);
    const rpBefore = st().rankPoints;
    await window.Rank.login('관리자1');
    await window.Rank.grant('테스터', 500000);
    let gerr = ''; try { await window.Rank.grant('없는사람', 1000); } catch (e) { gerr = e.message; }
    check(gerr.includes('닉네임'), '없는 닉네임에는 지급 불가');
    await window.Rank.login('테스터');
    const got = await window.Rank.claimGrants();
    check(got.length === 1 && got[0].amount === 500000 && got[0].by === '관리자1', '관리자 지급 받기');
    check((await window.Rank.claimGrants()).length === 0, '같은 지급을 두 번 받지 않음');
    check(st().rankPoints === rpBefore, '지급 포인트는 랭크 포인트에 반영 안 됨');
    // 관리자는 직접 충전 가능 (테스터를 관리자로)
    C.ADMINS.push('테스터'); document.body.classList.add('admin');
    $('#btnPlay').click(); await sleep(50);
    check(!!document.querySelector('.chargegrid'), '관리자: 포인트 부족 → 충전 창');
    document.querySelector('.chargegrid button:last-child').click();
    check(num($('#pointsText').textContent) === P2 + C.CHARGE_AMOUNTS[C.CHARGE_AMOUNTS.length - 1], '관리자: 충전');
    check(st().rankPoints === rpBefore, '충전은 랭크 포인트에 반영 안 됨');
    $('.closebtn').click();
    // 고액 1판
    $('#btnPlay').click();
    await until(() => $('#keep'));
    $('#keep').click();
    await until(() => !$('#panelIdle').hidden);
    check(true, '500,000pt 1판 완료');
    // HARD 모드: 메뉴 → 타이틀 → HARD 선택 → 시작 → 1판
    $('#btnMenu').click(); $('#btnTitle').click();
    check(!$('#title').hidden, '메뉴에서 타이틀로 이동');
    document.querySelector('.mode-btn[data-mode=hard]').click();
    check($('#modeBadge').textContent === 'HARD', 'HARD 선택 시 배지 표시');
    $('#btnStart').click(); await sleep(700);
    check($('#title').hidden, '시작 후 타이틀 닫힘');
    for (let i = 0; i < 20; i++) $('#betMinus').click();
    $('#btnPlay').click();
    await until(() => $('#keep'));
    $('#keep').click();
    await until(() => !$('#panelIdle').hidden);
    check(true, 'HARD 1판 완료');
    // 보안: 서버에서 이상한 값이 와도 스크립트로 실행되지 않아야 함
    await window.Rank.store.addFeed({ nickname: '<b id=x1>해커</b>', mode: '<img id=x2 src=x>', grade: '<img id=x3 src=x onerror="window.__pwned=1">', card: '<i id=x4>c</i>', bet: 1, value: 2 });
    const db = JSON.parse(localStorage.getItem('luckydig.rank.local'));
    db.players['악당'] = { nickname: '악당', stats: { best: { mult: 9, grade: '<img id=x5 src=x>', mode: '<img id=x6 src=x>' }, grades: { mild: { S: '<img id=x7 src=x>' } } } };
    localStorage.setItem('luckydig.rank.local', JSON.stringify(db));
    // 랭킹 화면
    $('#btnRank').click(); await sleep(300);
    check(!!document.querySelector('.rrow2.me') && document.querySelector('.rrow2.me .rn').textContent === '테스터', '랭킹 보드에 내 기록 표시');
    for (let t = 0; t < 6; t++) { document.querySelectorAll('.tabs button')[t].click(); await sleep(250); }
    [...document.querySelectorAll('.tabs button')].find(b => b.textContent.includes('도감')).click(); await sleep(300);
    const dexRow = document.querySelector('.rrow2.me');
    const myDex = Object.keys(window.UI.state().dex).length;
    check(dexRow && dexRow.textContent.includes(`${myDex} / ${C.allCards().length}장`) && dexRow.textContent.includes('완성 광산'), `도감 수집 랭킹: 내 도감 ${myDex}장과 일치`);
    document.querySelector('.tabs button:last-child').click(); await sleep(300);
    check(!!document.querySelector('.frow'), '소식 탭 열림');
    check(!document.querySelector('#x1,#x2,#x3,#x4,#x5,#x6,#x7') && !window.__pwned, '이상한 값이 HTML로 실행되지 않음 (스크립트 삽입 차단)');
    $('.closebtn').click();
    // 출석 체크
    const U = window.UI, ST = U.state();
    const p0 = num($('#pointsText').textContent), rp0 = st().rankPoints;
    ST.attend = { last: '', streak: 0 };
    check(U.openDaily(false) && !!$('#dailyClaim'), '출석: 오늘 처음 → 출석 창');
    $('#dailyClaim').click(); await sleep(50);
    check(num($('#pointsText').textContent) === p0 + C.DAILY_REWARDS[0] && ST.attend.streak === 1, '출석 1일차 보상');
    check(U.openDaily(false) === false, '출석: 같은 날 두 번 안 뜸');
    check(st().rankPoints === rp0, '출석 보상은 랭크 포인트 제외');
    const yest = d => new Date(Date.parse(window.Rank.todayKST() + 'T00:00:00Z') - d * 86400000).toISOString().slice(0, 10);
    ST.attend = { last: yest(1), streak: 6 };
    U.openDaily(false); const p1 = num($('#pointsText').textContent); $('#dailyClaim').click(); await sleep(50);
    check(num($('#pointsText').textContent) === p1 + C.DAILY_REWARDS[6] && ST.attend.streak === 7, '어제 6일차 → 오늘 7일차 큰 보상');
    ST.attend = { last: yest(1), streak: 7 };
    check(U.dailyInfo().idx === 0, '7일 다음은 다시 1일차');
    ST.attend = { last: yest(3), streak: 4 };
    check(U.dailyInfo().idx === 0 && U.dailyInfo().streak === 0, '하루 빠지면 1일차부터');
    // 저장 유지
    const saved = JSON.parse(localStorage.getItem('luckydig.v1'));
    check(saved.points === num($('#pointsText').textContent), '저장된 포인트 = 화면 포인트');
    check(saved.mode === 'hard', '모드 저장됨');
  }
  run().catch(e => fails.push('ERROR ' + e.message)).finally(() => {
    const pre = document.createElement('pre');
    pre.id = 'uitest-result';
    pre.textContent = (fails.length ? 'UITEST FAIL' : 'UITEST PASS') + '\n' + fails.concat(log).join('\n');
    document.body.appendChild(pre);
  });
})();
