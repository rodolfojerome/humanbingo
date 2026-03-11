(function () {
  var createClient = typeof supabase !== 'undefined' && supabase.createClient;
  if (!createClient) {
    window.getSupabase = function () {
      throw new Error('Supabase not loaded. Include script: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
    };
    return;
  }
  var url = window.SUPABASE_URL;
  var key = window.SUPABASE_ANON_KEY;
  if (!url || !key || url === 'https://your-project.supabase.co' || key === 'your-anon-key') {
    window.getSupabase = function () {
      throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY in js/config.js');
    };
    return;
  }
  window._supabase = createClient(url, key);
  window.getSupabase = function () { return window._supabase; };
})();

function checkBingo(markedSet) {
  var lines = [
    [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24],
    [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24],
    [0,6,12,18,24], [4,8,12,16,20]
  ];
  return lines.some(function(line) {
    return line.every(function(i) { return markedSet.has(i); });
  });
}

async function ensureDefaultSession(code) {
  var sb = window.getSupabase();
  await sb.from('sessions').upsert({
    code: code,
    admin_id: 'default',
    admin_password: '',
    status: 'waiting',
    current_prompt_index: 0,
    total_rounds: 40
  }, { onConflict: 'code' });
}

async function advanceToNextPromptClient(sessionId, currentIndex, totalRounds) {
  var sb = window.getSupabase();
  var nextIndex = currentIndex + 1;
  if (nextIndex >= totalRounds) {
    await sb.from('sessions').update({ status: 'ended' }).eq('id', sessionId);
    return false;
  }
  var { data: prompts } = await sb.from('prompts').select('id');
  if (!prompts || prompts.length === 0) return false;
  var randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
  await sb.from('rounds').insert({
    session_id: sessionId,
    round_number: nextIndex,
    prompt_id: randomPrompt.id
  });
  var { error } = await sb.from('sessions').update({
    current_prompt_index: nextIndex,
    updated_at: new Date().toISOString()
  }).eq('id', sessionId);
  return !error;
}

function playBingoSound() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {}
}

function getStored(key) {
  try { return sessionStorage.getItem(key); } catch (e) { return null; }
}
function setStored(key, val) {
  try { sessionStorage.setItem(key, val); } catch (e) {}
}

window.HB = window.HB || {};
window.HB.checkBingo = checkBingo;
window.HB.advanceToNextPromptClient = advanceToNextPromptClient;
window.HB.playBingoSound = playBingoSound;
window.HB.ensureDefaultSession = ensureDefaultSession;
window.HB.getStored = getStored;
window.HB.setStored = setStored;
