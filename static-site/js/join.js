(function () {
  var form = document.getElementById('joinForm');
  var nameInput = document.getElementById('nameInput');
  var errorBox = document.getElementById('errorBox');
  var playBtn = document.getElementById('playBtn');
  var playBtnText = document.getElementById('playBtnText');
  var code = window.DEFAULT_GAME_CODE || 'BINGO';

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
  }
  function hideError() {
    errorBox.style.display = 'none';
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var name = (nameInput.value || '').trim();
    if (!name) {
      showError('Please enter your name.');
      return;
    }
    hideError();
    playBtn.disabled = true;
    playBtnText.textContent = 'Joining...';

    try {
      var sb = window.getSupabase();
      var normalizedCode = code.trim().toUpperCase();
      var { data: session, error: sessionError } = await sb.from('sessions').select('*').eq('code', normalizedCode).single();

      if ((sessionError || !session) && normalizedCode === code) {
        await window.HB.ensureDefaultSession(normalizedCode);
        var retry = await sb.from('sessions').select('*').eq('code', normalizedCode).single();
        session = retry.data;
      }

      if (!session) {
        showError('Game not found. Please try again.');
        playBtn.disabled = false;
        playBtnText.textContent = 'Play';
        return;
      }

      var userId = crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now();
      var { error: playerError } = await sb.from('players').insert([{
        session_id: session.id,
        name: name,
        user_id: userId
      }]);

      if (playerError) {
        showError(playerError.message || 'Failed to join.');
        playBtn.disabled = false;
        playBtnText.textContent = 'Play';
        return;
      }

      var { data: prompts } = await sb.from('prompts').select('*');
      if (!prompts || prompts.length === 0) {
        showError('No prompts available.');
        playBtn.disabled = false;
        playBtnText.textContent = 'Play';
        return;
      }

      var shuffled = prompts.slice().sort(function () { return Math.random() - 0.5; });
      var cardPrompts = shuffled.slice(0, 25).map(function (p) { return p.id; });

      var { data: newPlayer } = await sb.from('players').select('id').eq('user_id', userId).eq('session_id', session.id).single();
      if (newPlayer) {
        var { error: cardError } = await sb.from('cards').insert([{
          player_id: newPlayer.id,
          session_id: session.id,
          card_data: cardPrompts
        }]);
        if (cardError) {
          showError(cardError.message || 'Failed to create card.');
          playBtn.disabled = false;
          playBtnText.textContent = 'Play';
          return;
        }
      }

      window.HB.setStored('gameCode', normalizedCode);
      window.HB.setStored('userId', userId);
      window.HB.setStored('playerName', name);
      window.location.href = 'play.html?code=' + encodeURIComponent(normalizedCode);
    } catch (err) {
      showError(err && err.message ? err.message : 'Failed to join.');
      playBtn.disabled = false;
      playBtnText.textContent = 'Play';
    }
  });
})();
