(function () {
  var params = new URLSearchParams(window.location.search);
  var gameCode = params.get('code') || window.DEFAULT_GAME_CODE || 'BINGO';

  var el = {
    loading: document.getElementById('loading'),
    notFound: document.getElementById('notFound'),
    content: document.getElementById('content'),
    playerName: document.getElementById('playerName'),
    confessionBlock: document.getElementById('confessionBlock'),
    confessionText: document.getElementById('confessionText'),
    momentsList: document.getElementById('momentsList'),
    resultsLink: document.getElementById('resultsLink')
  };

  (async function load() {
    var storedUserId = window.HB.getStored('userId');
    var storedName = window.HB.getStored('playerName');
    if (!storedUserId) {
      el.loading.style.display = 'none';
      el.notFound.style.display = 'flex';
      return;
    }
    try {
      var sb = window.getSupabase();
      var { data: session } = await sb.from('sessions').select('id').eq('code', gameCode).single();
      if (!session) { el.loading.style.display = 'none'; el.notFound.style.display = 'flex'; return; }
      var { data: player } = await sb.from('players').select('id, name, confession').eq('session_id', session.id).eq('user_id', storedUserId).single();
      if (!player) { el.loading.style.display = 'none'; el.notFound.style.display = 'flex'; return; }

      el.playerName.textContent = player.name || storedName || 'You';
      if (player.confession) {
        el.confessionBlock.style.display = 'block';
        el.confessionText.textContent = player.confession;
      }

      var { data: cardRow } = await sb.from('cards').select('id, card_data').eq('player_id', player.id).single();
      if (!cardRow || !cardRow.card_data) {
        el.loading.style.display = 'none';
        el.content.style.display = 'block';
        el.resultsLink.href = 'results.html?code=' + encodeURIComponent(gameCode);
        return;
      }
      var { data: marks } = await sb.from('card_marks').select('cell_index').eq('card_id', cardRow.id);
      var markedIndices = new Set((marks || []).map(function (m) { return m.cell_index; }));
      var cardData = cardRow.card_data;
      var promptIds = cardData.filter(function (_, i) { return markedIndices.has(i) && i !== 12; });
      if (promptIds.length === 0) {
        el.loading.style.display = 'none';
        el.content.style.display = 'block';
        el.resultsLink.href = 'results.html?code=' + encodeURIComponent(gameCode);
        return;
      }
      var { data: prompts } = await sb.from('prompts').select('id, text').in('id', promptIds);
      prompts = prompts || [];
      el.momentsList.innerHTML = prompts.map(function (p, i) {
        return '<li class="list-item"><span class="num">' + (i + 1) + '.</span><span>' + escapeHtml(p.text) + '</span></li>';
      }).join('');

      el.resultsLink.href = 'results.html?code=' + encodeURIComponent(gameCode);
      el.loading.style.display = 'none';
      el.content.style.display = 'block';
    } catch (e) {
      el.loading.style.display = 'none';
      el.notFound.style.display = 'flex';
    }
  })();

  function escapeHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
})();
