// 보물상자 연출 확인용: index.html#fx<최소배율> (예: #fx10, #fx9, #fx7)
(function () {
  const min = +(location.hash.match(/fx(\d+)/) || [0, 10])[1];
  const C = window.CONFIG, R = window.Render;
  const board = Array.from({ length: C.ROWS }, () => Array.from({ length: C.COLS }, () => ({ type: 'stone' })));
  for (let r = 0; r < C.ROWS; r++) board[r][2] = null;
  const chests = [2, 3, min, 4, 5].map(m => ({ min: m, mult: m }));
  document.getElementById('panelIdle').hidden = true; document.getElementById('panelPlay').hidden = false;
  R.setBet(1000); R.drawBoard(board, chests);
  R.replay({ chests, board, events: [{ type: 'chest', c: 2, mult: min, min, before: 500, score: 500 * min, gm: min }, { type: 'end', score: 500 * min }] });
})();
