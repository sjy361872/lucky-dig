// 곡괭이 연출 확인용: index.html#picktest — 첫 스핀부터 곡괭이가 나오는 판을 골라 재생
(function () {
  const E = window.Engine, R = window.Render, C = window.CONFIG;
  const rng = E.makeRng(7);
  let sim;
  for (let i = 0; i < 500; i++) {
    sim = E.simulate(1000, 0.8, rng);
    const first = sim.events.find(e => e.type === 'spin');
    const picks = first.grid.flat().filter(t => t && t.startsWith('pick')).length;
    const other = first.grid.flat().filter(t => t && !t.startsWith('pick')).length;
    if (picks >= 3 && other === 0) break;
  }
  document.getElementById('panelIdle').hidden = true; document.getElementById('panelPlay').hidden = false;
  R.setBet(1000); R.drawBoard(sim.board, sim.chests); R.replay(sim);
})();
