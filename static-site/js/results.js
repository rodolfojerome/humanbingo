(function () {
  var params = new URLSearchParams(window.location.search);
  var gameCode = params.get('code') || window.DEFAULT_GAME_CODE || 'BINGO';

  var el = {
    loading: document.getElementById('loading'),
    content: document.getElementById('content'),
    gameCode: document.getElementById('gameCode'),
    winnersSection: document.getElementById('winnersSection'),
    winnersTitle: document.getElementById('winnersTitle'),
    winnersList: document.getElementById('winnersList'),
    confessionsSection: document.getElementById('confessionsSection'),
    confessionsList: document.getElementById('confessionsList'),
    playersCount: document.getElementById('playersCount'),
    playersList: document.getElementById('playersList')
  };

  (async function load() {
    try {
      var sb = window.getSupabase();
      var { data: session } = await sb.from('sessions').select('*').eq('code', gameCode).single();
      if (!session) {
        window.location.href = 'index.html';
        return;
      }
      var { data: players } = await sb.from('players').select('*').eq('session_id', session.id);
      players = players || [];
      var winners = players.filter(function (p) { return p.won; });
      var withConfession = players.filter(function (p) { return p.confession; });

      el.gameCode.textContent = gameCode;
      el.playersCount.textContent = players.length;

      if (winners.length > 0) {
        el.winnersSection.style.display = 'block';
        el.winnersTitle.textContent = winners.length === 1 ? '🏆 Winner' : '🏆 Winners';
        el.winnersList.innerHTML = winners.map(function (w) {
          return '<div class="p-5 rounded-2xl space-y-2" style="background: rgba(217,119,6,0.1); border: 1px solid rgba(217,119,6,0.3);">' +
            '<p class="text-2xl font-bold">' + escapeHtml(w.name) + '</p>' +
            (w.confession ? '<p class="text-sm text-muted">Their confession:</p><p class="text-lg italic">' + escapeHtml(w.confession) + '</p>' : '') +
            '</div>';
        }).join('');
      }

      if (withConfession.length > 0) {
        el.confessionsSection.style.display = 'block';
        el.confessionsList.innerHTML = withConfession.map(function (p) {
          return '<div class="p-4 glass-secondary rounded-xl">' +
            '<p class="font-semibold mb-2">' + escapeHtml(p.name) + (p.won ? ' <span class="text-accent text-xs font-normal">(BINGO!)</span>' : '') + '</p>' +
            '<p class="italic text-muted">' + escapeHtml(p.confession) + '</p></div>';
        }).join('');
      }

      el.playersList.innerHTML = players.map(function (p) {
        return '<div class="p-4 flex items-center justify-between glass-secondary rounded-xl">' +
          '<p class="font-semibold">' + escapeHtml(p.name) + '</p>' +
          (p.won ? '<span class="badge">BINGO!</span>' : '') + '</div>';
      }).join('');

      el.loading.style.display = 'none';
      el.content.style.display = 'block';
    } catch (e) {
      window.location.href = 'index.html';
    }
  })();

  function escapeHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
})();
