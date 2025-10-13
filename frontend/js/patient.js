const logoutBtn = document.getElementById('logoutBtn');
const headerRole = document.getElementById('headerRole');
const doctorInfo = document.getElementById('doctorInfo');
const rxList = document.getElementById('rxList');

init();

async function init() {
  const token = getAccessToken();
  const email = getEmail();
  if (!token || !email) { window.location.href = 'home.html'; return; }
  logoutBtn.addEventListener('click', () => { clearSession(); window.location.href = 'home.html'; });

  // Resolve current user
  const users = await supabaseRequest({ method: 'GET', path: 'user_accounts', accessToken: token, query: `?select=userid,fullname,role&email=eq.${encodeURIComponent(email)}` });
  if (!users || users.length === 0) { alert('No profile'); return; }
  const me = users[0];
  headerRole.textContent = `Patient: ${me.fullname || email}`;

  // Doctor assignment
  const assigns = await supabaseRequest({ method: 'GET', path: 'patient_doctor_assignments', accessToken: token, query: `?select=doctor_userid,patient_userid&patient_userid=eq.${encodeURIComponent(me.userid)}` });
  if (assigns && assigns.length > 0) {
    const docId = assigns[0].doctor_userid;
    const docs = await supabaseRequest({ method: 'GET', path: 'user_accounts', accessToken: token, query: `?select=fullname,email&userid=eq.${encodeURIComponent(docId)}` });
    if (docs && docs[0]) doctorInfo.textContent = `Doctor: ${docs[0].fullname || docs[0].email}`; else doctorInfo.textContent = 'Doctor: Unknown';
  } else {
    doctorInfo.textContent = 'Doctor: Not assigned';
  }

  // Prescriptions list
  const meds = await supabaseRequest({ method: 'GET', path: 'medications', accessToken: token, query: '?select=id,name' });
  const medsById = {}; meds.forEach(m => medsById[m.id] = m.name);
  const rx = await supabaseRequest({ method: 'GET', path: 'user_medications', accessToken: token, query: `?select=medicationid,dosage_mg,form,notes,start_date,end_date&userid=eq.${encodeURIComponent(me.userid)}&order=id.desc` });
  rxList.innerHTML = '';
  rx.forEach(r => {
    const li = document.createElement('li');
    const name = medsById[r.medicationid] || `#${r.medicationid}`;
    const title = document.createElement('div');
    title.style.fontWeight = '600';
    title.textContent = name;
    // Multi-line meta
    const parts = [r.dosage_mg ? `${r.dosage_mg}mg` : null, r.form, r.start_date ? `start ${r.start_date}` : null, r.end_date ? `end ${r.end_date}` : null].filter(Boolean);
    const notes = document.createElement('div');
    notes.style.opacity = '0.85';
    notes.textContent = r.notes ? r.notes : '';
    li.appendChild(title);
    parts.forEach(line => { const d = document.createElement('div'); d.textContent = line; li.appendChild(d); });
    li.appendChild(notes);
    rxList.appendChild(li);
  });
}


