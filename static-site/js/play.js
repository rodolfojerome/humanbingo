(function () {
  var params = new URLSearchParams(window.location.search);
  var gameCode = params.get('code') || window.DEFAULT_GAME_CODE || 'BINGO';
  var isHost = params.get('host') === 'true';

  var state = {
    session: null,
    playerId: 0,
    cardId: null,
    cardData: [],
    prompts: {},
    markedCells: new Set([12]),
    currentPrompt: null,
    hasBingo: false,
    soundEnabled: true,
    playerName: ''
  };

  var el = {
    loading: document.getElementById('loading'),
    notFound: document.getElementById('notFound'),
    game: document.getElementById('game'),
    sessionCode: document.getElementById('sessionCode'),
    promptCard: document.getElementById('promptCard'),
    currentPromptText: document.getElementById('currentPromptText'),
    roundNum: document.getElementById('roundNum'),
    totalRounds: document.getElementById('totalRounds'),
    nextMessage: document.getElementById('nextMessage'),
    nextPromptBtn: document.getElementById('nextPromptBtn'),
    bingoGrid: document.getElementById('bingoGrid'),
    hostControls: document.getElementById('hostControls'),
    dashboardLink: document.getElementById('dashboardLink'),
    confessionCard: document.getElementById('confessionCard'),
    confessionInput: document.getElementById('confessionInput'),
    submitConfessionBtn: document.getElementById('submitConfessionBtn'),
    playerNameEl: document.getElementById('playerNameEl'),
    refreshCardBtn: document.getElementById('refreshCardBtn'),
    soundBtn: document.getElementById('soundBtn'),
    bingoBadge: document.getElementById('bingoBadge')
  };

  function showLoading() {
    el.loading.style.display = 'flex';
    el.notFound.style.display = 'none';
    el.game.style.display = 'none';
  }
  function showNotFound() {
    el.loading.style.display = 'none';
    el.notFound.style.display = 'flex';
    el.game.style.display = 'none';
  }
  function showGame() {
    el.loading.style.display = 'none';
    el.notFound.style.display = 'none';
    el.game.style.display = 'block';
  }

  function renderGrid() {
    el.bingoGrid.innerHTML = '';
    var prompts = state.prompts;
    state.cardData.forEach(function (promptId, index) {
      var prompt = prompts[promptId];
      var isMarked = state.markedCells.has(index);
      var isFree = index === 12;
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'bingo-cell' + (isFree ? ' bingo-cell-free' : '') + (isMarked ? ' bingo-cell-marked' : '');
      cell.dataset.index = index;
      if (isFree) cell.disabled = true;
      cell.innerHTML = '<span>' + (isFree ? 'FREE' : (prompt ? prompt.text : '?')) + '</span>';
      el.bingoGrid.appendChild(cell);
    });
  }

  function updatePromptUI() {
    var s = state.session;
    if (!s) return;
    el.sessionCode.textContent = s.code;
    el.roundNum.textContent = (s.current_prompt_index || 0) + 1;
    el.totalRounds.textContent = s.total_rounds || 40;
    if (state.currentPrompt) {
      el.promptCard.style.display = 'block';
      el.currentPromptText.textContent = state.currentPrompt.text;
      el.nextPromptBtn.disabled = s.current_prompt_index >= (s.total_rounds || 40) - 1;
    } else {
      el.promptCard.style.display = 'none';
    }
    if (isHost) {
      el.hostControls.style.display = 'block';
      el.dashboardLink.href = 'dashboard.html?code=' + encodeURIComponent(gameCode);
    }
    if (state.hasBingo) {
      el.bingoBadge.style.display = 'inline';
      el.confessionCard.style.display = 'block';
      el.playerNameEl.textContent = state.playerName;
    }
  }

  async function loadGame() {
    showLoading();
    var sb = window.getSupabase();
    try {
      var { data: sessionData } = await sb.from('sessions').select('*').eq('code', gameCode).single();
      if (!sessionData) {
        showNotFound();
        return;
      }
      state.session = sessionData;

      var { data: promptsData } = await sb.from('prompts').select('*');
      if (promptsData) {
        var map = {};
        promptsData.forEach(function (p) { map[p.id] = p; });
        state.prompts = map;
      }

      var storedName = window.HB.getStored('playerName') || 'Player';
      var storedUserId = window.HB.getStored('userId');
      state.playerName = storedName;

      if (!storedUserId) {
        showNotFound();
        return;
      }

      var { data: playerData } = await sb.from('players').select('id, cards(id, card_data)').eq('user_id', storedUserId).eq('session_id', sessionData.id).single();
      if (!playerData) {
        showNotFound();
        return;
      }
      state.playerId = playerData.id;
      if (playerData.cards && playerData.cards[0]) {
        state.cardId = playerData.cards[0].id;
        state.cardData = playerData.cards[0].card_data || [];
      }

      var { data: marksData } = await sb.from('card_marks').select('cell_index').eq('card_id', state.cardId);
      if (marksData) {
        state.markedCells = new Set(marksData.map(function (m) { return m.cell_index; }));
        state.markedCells.add(12);
      }

      if (sessionData.current_prompt_index < (sessionData.total_rounds || 40)) {
        var { data: roundData } = await sb.from('rounds').select('prompt_id, prompts(*)').eq('session_id', sessionData.id).eq('round_number', sessionData.current_prompt_index).single();
        if (roundData && roundData.prompts) state.currentPrompt = roundData.prompts;
      }

      showGame();
      renderGrid();
      updatePromptUI();

      sb.channel('session:' + gameCode).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: 'code=eq.' + gameCode }, async function (payload) {
        state.session = payload.new;
        if (state.session.current_prompt_index < (state.session.total_rounds || 40)) {
          var { data: rd } = await sb.from('rounds').select('prompt_id, prompts(*)').eq('session_id', state.session.id).eq('round_number', state.session.current_prompt_index).single();
          state.currentPrompt = rd && rd.prompts ? rd.prompts : null;
        } else state.currentPrompt = null;
        updatePromptUI();
      }).subscribe();
    } catch (err) {
      console.error(err);
      showNotFound();
    }
  }

  el.bingoGrid.addEventListener('click', async function (e) {
    var cell = e.target.closest('.bingo-cell');
    if (!cell || cell.disabled) return;
    var index = parseInt(cell.dataset.index, 10);
    if (index === 12) return;
    var sb = window.getSupabase();
    if (state.markedCells.has(index)) {
      state.markedCells.delete(index);
      await sb.from('card_marks').delete().eq('card_id', state.cardId).eq('cell_index', index);
    } else {
      state.markedCells.add(index);
      await sb.from('card_marks').insert([{ card_id: state.cardId, cell_index: index }]);
      if (window.HB.checkBingo(state.markedCells)) {
        state.hasBingo = true;
        window.HB.playBingoSound();
        if (window.confetti) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        updatePromptUI();
      }
    }
    renderGrid();
  });

  el.nextPromptBtn.addEventListener('click', async function () {
    if (!state.session || el.nextPromptBtn.disabled) return;
    el.nextPromptBtn.disabled = true;
    var advanced = await window.HB.advanceToNextPromptClient(state.session.id, state.session.current_prompt_index, state.session.total_rounds || 40);
    if (advanced) {
      state.session.current_prompt_index++;
      var msg = el.nextMessage;
      msg.textContent = 'Explain to the group why you skipped! HAHAHA';
      msg.style.display = 'block';
      setTimeout(function () { msg.style.display = 'none'; }, 5000);
      var { data: rd } = await window.getSupabase().from('rounds').select('prompt_id, prompts(*)').eq('session_id', state.session.id).eq('round_number', state.session.current_prompt_index).single();
      state.currentPrompt = rd && rd.prompts ? rd.prompts : null;
    }
    updatePromptUI();
    el.nextPromptBtn.disabled = state.session.current_prompt_index >= (state.session.total_rounds || 40) - 1;
  });

  el.submitConfessionBtn.addEventListener('click', async function () {
    var text = (el.confessionInput.value || '').trim();
    if (!text || !state.playerId) return;
    el.submitConfessionBtn.disabled = true;
    el.submitConfessionBtn.textContent = 'Saving...';
    await window.getSupabase().from('players').update({ confession: text, won: true }).eq('id', state.playerId);
    window.location.href = 'my-moments.html?code=' + encodeURIComponent(gameCode);
  });

  el.refreshCardBtn.addEventListener('click', async function () {
    if (!state.cardId || !state.playerId) return;
    el.refreshCardBtn.disabled = true;
    var sb = window.getSupabase();
    var { data: cardRow } = await sb.from('cards').select('id, card_data').eq('player_id', state.playerId).single();
    if (!cardRow || !cardRow.card_data) { el.refreshCardBtn.disabled = false; return; }
    var currentCard = cardRow.card_data;
    var keptIndices = new Set(state.markedCells);
    keptIndices.add(12);
    var keptIds = new Set(currentCard.filter(function (_, i) { return keptIndices.has(i); }));
    var { data: allPrompts } = await sb.from('prompts').select('id');
    if (!allPrompts || !allPrompts.length) { el.refreshCardBtn.disabled = false; return; }
    var availableIds = allPrompts.map(function (p) { return p.id; }).filter(function (id) { return !keptIds.has(id); });
    var shuffled = availableIds.slice().sort(function () { return Math.random() - 0.5; });
    var j = 0;
    var newCard = currentCard.map(function (id, i) {
      if (keptIndices.has(i)) return id;
      return shuffled[j++] !== undefined ? shuffled[j - 1] : id;
    });
    await sb.from('cards').update({ card_data: newCard }).eq('id', cardRow.id);
    state.cardData = newCard;
    renderGrid();
    el.refreshCardBtn.disabled = false;
  });

  el.soundBtn.addEventListener('click', function () {
    state.soundEnabled = !state.soundEnabled;
    el.soundBtn.textContent = state.soundEnabled ? '🔊' : '🔇';
  });

  loadGame();
})();
