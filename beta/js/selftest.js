// 엔진 검증: n판을 돌려 등급 분포·스코어 범위·환원율을 확인
(function (root) {
  function runSelfTest(n, bet, mode = 'mild') {
    const C = root.CONFIG, E = root.Engine;
    const cnt = {}, bad = [], tries = {}, t0 = Date.now();
    let paid = 0, back = 0;
    C.GRADES.forEach(g => { cnt[g.id] = 0; tries[g.id] = 0; });
    for (let i = 0; i < n; i++) {
      const r = E.playRound(bet, i + 1, mode);
      cnt[r.grade]++; tries[r.grade] += r.sim.tries;
      paid += bet; back += r.payout;
      const gi = E.gradeIndexForScore(r.sim.score, bet);
      if (gi !== r.gradeIndex) bad.push({ seed: i + 1, grade: r.grade, score: r.sim.score });
      // 재생 기록의 마지막 스코어와 엔진 스코어가 같은지
      const last = r.sim.events[r.sim.events.length - 1];
      if (last.score !== r.sim.score) bad.push({ seed: i + 1, reason: 'end score mismatch' });
    }
    const rows = C.GRADES.map(g => ({
      grade: g.id, expected: E.rateOf(g, mode).toFixed(1) + '%', actual: (cnt[g.id] / n * 100).toFixed(2) + '%',
      avgTries: cnt[g.id] ? (tries[g.id] / cnt[g.id]).toFixed(1) : '-',
    }));
    return { rows, bad, returnRate: (back / paid * 100).toFixed(1) + '%', ms: Date.now() - t0 };
  }
  root.runSelfTest = runSelfTest;
})(typeof window !== 'undefined' ? window : globalThis);
