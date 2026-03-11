(function () {
  var params = new URLSearchParams(window.location.search);
  var gameCode = params.get('code') || window.DEFAULT_GAME_CODE || 'BINGO';

  var state = { session: null, players: [], currentPrompt: null, allPrompts: [] };

  var el = {
    loading: document.getElementById('loading'),
    notFound: document.getElementById('notFound'),
    dashboard: document.getElementById('dashboard'),
    sessionCode: document.getElementById('sessionCode'),
    playingCard: document.getElementById('playingCard'),
    currentPromptText: document.getElementById('currentPromptText'),
    roundNum: document.getElementById('roundNum'),
    totalRounds: document.getElementById('totalRounds'),
    playingActions: document.getElementById('playingActions'),
    nextPromptBtn: document.getElementById('nextPromptBtn'),
    endGameBtn: document.getElementById('endGameBtn'),
    endedMsg: document.getElementById('endedMsg'),
    waitingCard: document.getElementById('waitingCard'),
    waitingText: document.getElementById('waitingText'),
    startGameBtn: document.getElementById('startGameBtn'),
    playersCount: document.getElementById('playersCount'),
    playersList: document.getElementById('playersList'),
    gameBoardLink: document.getElementById('gameBoardLink')
  };

  function showLoading() {
    el.loading.style.display = 'flex';
    el.notFound.style.display = 'none';
    el.dashboard.style.display = 'none';
  }
  function showNotFound() {
    el.loading.style.display = 'none';
    el.notFound.style.display = 'flex';
    el.dashboard.style.display = 'none';
  }
  function showDashboard() {
    el.loading.style.display = 'none';
    el.notFound.style.display = 'none';
    el.dashboard.style.display = 'block';
  }

  function render() {
    var s = state.session;
    if (!s) return;
    el.sessionCode.textContent = s.code;
    el.playersCount.textContent = state.players.length;
    el.gameBoardLink.href = 'play.html?code=' + encodeURIComponent(gameCode) + '&host=true';

    var gameStarted = s.status === 'playing' || s.status === 'ended';
    if (gameStarted) {
      el.playingCard.style.display = 'block';
      el.waitingCard.style.display = 'none';
      el.currentPromptText.textContent = state.currentPrompt ? state.currentPrompt.text : 'Loading...';
      el.roundNum.textContent = (s.current_prompt_index || 0) + 1;
      el.totalRounds.textContent = s.total_rounds || 40;
      if (s.status === 'playing') {
        el.playingActions.style.display = 'flex';
        el.endedMsg.style.display = 'none';
      } else {
        el.playingActions.style.display = 'none';
        el.endedMsg.style.display = 'block';
      }
    } else {
      el.playingCard.style.display = 'none';
      el.waitingCard.style.display = 'block';
      el.waitingText.textContent = state.players.length > 0
        ? state.players.length + ' player(s) joined. Ready to start?'
        : 'Waiting for players to join...';
      el.startGameBtn.disabled = state.players.length === 0;
    }

    el.playersList.innerHTML = state.players.length > 0
      ? state.players.map(function (p) {
          return '<div class="p-4 rounded-xl ' + (p.won ? 'bg-accent/30 border border-accent' : 'glass-secondary') + '">' +
            '<div class="flex items-center justify-between"><p class="font-semibold">' + escapeHtml(p.name) + '</p>' +
            (p.won ? '<span class="text-sm font-bold text-accent">BINGO!</span>' : '') + '</div></div>';
        }).join('')
      : '<p class="text-muted text-center py-8">No players yet</p>';
  }

  function escapeHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  async function load() {
    showLoading();
    var sb = window.getSupabase();
    try {
      var { data: sessionData } = await sb.from('sessions').select('*').eq('code', gameCode).single();
      if (!sessionData) {
        showNotFound();
        return;
      }
      state.session = sessionData;

      var { data: playersData } = await sb.from('players').select('*').eq('session_id', sessionData.id);
      state.players = playersData || [];

      var { data: promptsData } = await sb.from('prompts').select('*');
      state.allPrompts = promptsData || [];

      if (sessionData.status === 'playing' || sessionData.status === 'ended') {
        var { data: roundData } = await sb.from('rounds').select('prompt_id, prompts(*)')
          .eq('session_id', sessionData.id)
          .eq('round_number', sessionData.current_prompt_index)
          .single();
        state.currentPrompt = roundData && roundData.prompts ? roundData.prompts : null;
      }

      showDashboard();
      render();

      sb.channel('session:' + gameCode).on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: 'code=eq.' + gameCode }, function (payload) {
        state.session = payload.new;
        render();
      }).subscribe();

      sb.channel('players:' + sessionData.id).on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: 'session_id=eq.' + sessionData.id }, async function () {
        var { data } = await sb.from('players').select('*').eq('session_id', sessionData.id);
        state.players = data || [];
        render();
      }).subscribe();
    } catch (e) {
      console.error(e);
      showNotFound();
    }
  }

  el.startGameBtn.addEventListener('click', async function () {
    if (!state.session || !state.allPrompts.length) return;
    var sb = window.getSupabase();
    await sb.from('sessions').update({ status: 'playing' }).eq('id', state.session.id);
    var randomPrompt = state.allPrompts[Math.floor(Math.random() * state.allPrompts.length)];
    await sb.from('rounds').insert([{ session_id: state.session.id, round_number: 0, prompt_id: randomPrompt.id }]);
    state.session.status = 'playing';
    state.currentPrompt = randomPrompt;
    render();
  });

  el.nextPromptBtn.addEventListener('click', async function () {
    if (!state.session || !state.allPrompts.length) return;
    var nextIndex = (state.session.current_prompt_index || 0) + 1;
    var total = state.session.total_rounds || 40;
    var sb = window.getSupabase();
    if (nextIndex >= total) {
      await sb.from('sessions').update({ status: 'ended' }).eq('id', state.session.id);
      state.session.status = 'ended';
      state.session.current_prompt_index = nextIndex;
      render();
      return;
    }
    var randomPrompt = state.allPrompts[Math.floor(Math.random() * state.allPrompts.length)];
    await sb.from('rounds').insert([{ session_id: state.session.id, round_number: nextIndex, prompt_id: randomPrompt.id }]);
    await sb.from('sessions').update({ current_prompt_index: nextIndex }).eq('id', state.session.id);
    state.session.current_prompt_index = nextIndex;
    state.currentPrompt = randomPrompt;
    render();
  });

  el.endGameBtn.addEventListener('click', async function () {
    if (!state.session) return;
    await window.getSupabase().from('sessions').update({ status: 'ended' }).eq('id', state.session.id);
    state.session.status = 'ended';
    render();
  });

  load();
})();
