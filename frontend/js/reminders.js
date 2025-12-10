// Everett Miceli Virginia Tech Sprint 3
// Very basic reminder functionality, does not currently remind
// Saves reminders/configs to patient_reminders table and displays them
// TODO: future functionality/integration with whatever its deployed within (mobile app, ect)
(function () {
  var headerRole, logoutBtn, setReminderBtn, userId, email, token, reminderList;
  document.addEventListener('DOMContentLoaded', async function () {
    headerRole = document.getElementById('headerRole');
    logoutBtn = document.getElementById('logoutBtn');
    setReminderBtn = document.getElementById('setReminderBtn');
    reminderList = document.getElementById('reminderList');
    token = typeof getAccessToken === 'function' ? getAccessToken() : null;
    email = typeof getEmail === 'function' ? getEmail() : null;
    if (!token || !email) { window.location.href = 'home.html'; return; }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        try { if (typeof clearSession === 'function') clearSession(); } catch (_) {}
        window.location.href = 'home.html';
      });
    }
    try {
      var rows = await supabaseRequest({
        method: 'GET',
        path: 'user_accounts',
        accessToken: token,
        query: `?select=userid,fullname&email=eq.${encodeURIComponent(email)}&limit=1`
      });
      if (rows && rows[0]) {
        userId = rows[0].userid;
        if (headerRole) headerRole.textContent = 'Patient: ' + (rows[0].fullname || email);
      } else {
        if (headerRole) headerRole.textContent = 'Patient: ' + email;
      }
    } catch (_) {
      if (headerRole) headerRole.textContent = 'Patient: ' + email;
    }
    if (setReminderBtn) setReminderBtn.addEventListener('click', onSave);
    await loadReminders();
  });
  async function onSave() {
    if (!userId) return;
    var medication = (document.getElementById('rem_medication') || {}).value || '';
    var frequency = (document.getElementById('rem_frequency') || {}).value || 'once_daily';
    var times = (document.getElementById('rem_times') || {}).value || '';
    var withMeal = ((document.getElementById('rem_with_meal') || {}).value || 'false') === 'true';
    var notes = (document.getElementById('rem_notes') || {}).value || '';
    medication = medication.trim();
    times = times.trim();
    notes = notes.trim();
    if (!medication || !times) { alert('Enter medication and times.'); return; }
    try {
      await supabaseRequest({
        method: 'POST',
        path: 'patient_reminders',
        accessToken: token,
        body: [{
          patient_userid: userId,
          medication: medication,
          frequency: frequency,
          times: times,
          with_meal: withMeal,
          notes: notes
        }]
      });
      await loadReminders();
    } catch (_) {
      alert('Save failed.');
    }
  }
  async function loadReminders() {
    if (!userId || !reminderList) return;
    try {
      var rows = await supabaseRequest({
        method: 'GET',
        path: 'patient_reminders',
        accessToken: token,
        query: `?select=id,medication,frequency,times,with_meal,notes&patient_userid=eq.${encodeURIComponent(userId)}&order=id.desc`
      });
      render(rows || []);
    } catch (_) {
      render([]);
    }
  }
  function render(rows) {
    reminderList.innerHTML = '';
    if (!rows.length) {
      var li = document.createElement('li');
      li.textContent = 'No reminders yet.';
      reminderList.appendChild(li);
      return;
    }
    rows.forEach(function (r) {
      var li = document.createElement('li');
      var left = document.createElement('div');
      left.style.display = 'flex';
      left.style.flexDirection = 'column';
      left.style.alignItems = 'flex-start';
      left.innerHTML = '<strong>' + (r.medication || '') + '</strong>' +
        (r.times ? ('<div>Times: ' + r.times + '</div>') : '') +
        (r.frequency ? ('<div>Frequency: ' + r.frequency + '</div>') : '') +
        (r.with_meal ? '<div>With meal</div>' : '') +
        (r.notes ? ('<div>' + r.notes + '</div>') : '');
      var del = document.createElement('button');
      del.className = 'small-btn danger-btn';
      del.textContent = 'Remove';
      del.addEventListener('click', function () { removeReminder(r.id); });
      li.appendChild(left);
      li.appendChild(del);
      reminderList.appendChild(li);
    });
  }
  async function removeReminder(id) {
    if (!id) return;
    try {
      await supabaseRequest({
        method: 'DELETE',
        path: 'patient_reminders',
        accessToken: token,
        query: `?id=eq.${encodeURIComponent(id)}`
      });
      await loadReminders();
    } catch (_) {
      alert('Delete failed.');
    }
  }
})(); 
