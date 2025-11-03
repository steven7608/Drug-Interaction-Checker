//admin page logic modeled after doctor.js but simplified
const logoutBtn = document.getElementById('logoutBtn');
const headerRole = document.getElementById('headerRole');
const myPatientsList = document.getElementById('myPatientsList');
const patientSearch = document.getElementById('patientSearch');
const patientDetails = document.getElementById('patientDetails');
const detailTitle = document.getElementById('detailTitle');
const detailsPanel = document.getElementById('detailsPanel');
const adminRoleSelect = document.getElementById('adminRoleSelect');
const saveRoleBtn = document.getElementById('saveRoleBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');

let selectedPatient = null;

init();

async function init() {
  const token = getAccessToken();
  const email = getEmail();
  if (!token || !email) { window.location.href = 'home.html'; return; }

  logoutBtn.addEventListener('click', () => { clearSession(); window.location.href = 'home.html'; });
  patientSearch.addEventListener('input', renderMyPatientsFiltered);
  saveRoleBtn.addEventListener('click', onSaveRole);
  deleteAccountBtn.addEventListener('click', onDeleteAccount);

  //gate: admin only
  const rows = await supabaseRequest({ method: 'GET', path: 'user_accounts', accessToken: token, query: `?select=userid,fullname,role&email=eq.${encodeURIComponent(email)}` });
  if (!rows || rows.length === 0) { alert('No profile found'); return; }
  const me = rows[0];
  const isAdmin = (me.role || '').toLowerCase() === 'administrator';
  if (!isAdmin) { alert('Administrator access required.'); window.location.href = 'home.html'; return; }
  headerRole.textContent = `Admin: ${me.fullname || email}`;

  await refreshLists();
}

async function refreshLists() {
  const token = getAccessToken();
  const users = await supabaseRequest({ method: 'GET', path: 'user_accounts', accessToken: token, query: `?select=userid,fullname,email,role&order=fullname.asc` });
  window.__myPatients = users;
  renderMyPatientsFiltered();
}

function renderMyPatientsFiltered() {
  const q = (patientSearch.value || '').toLowerCase();
  const list = (window.__myPatients || []).filter(p => {
    const t = `${p.fullname || ''} ${p.email || ''} ${p.userid || ''}`.toLowerCase();
    return t.includes(q);
  });
  myPatientsList.innerHTML = '';
  list.forEach(p => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `${p.fullname || p.email} (${p.role || 'patient'})`;
    const open = document.createElement('button'); open.textContent = 'View'; open.addEventListener('click', () => openPatient(p));
    const remove = document.createElement('button'); remove.textContent = 'Delete'; remove.className = 'small-btn'; remove.addEventListener('click', () => deleteAccount(p.userid));
    li.appendChild(label);
    li.appendChild(open);
    li.appendChild(remove);
    myPatientsList.appendChild(li);
  });
}

function clearDetails() {
  detailTitle.textContent = 'Account Details';
  patientDetails.textContent = 'Select an account to view details.';
  detailsPanel.style.display = 'none';
}

function openPatient(patient) {
  selectedPatient = patient;
  document.getElementById('overviewSection').style.display = 'none';
  detailsPanel.style.display = 'block';
  detailTitle.textContent = `Account — ${(patient.fullname || patient.email || patient.userid)}`;
  patientDetails.textContent = `${patient.userid} • ${patient.email}`;
  //set role
  const current = (patient.role || '').toLowerCase();
  adminRoleSelect.value = current === 'administrator' ? 'administrator' : (patient.role || 'patient');
}

async function onSaveRole() {
  if (!selectedPatient) return;
  const token = getAccessToken();
  const newRole = adminRoleSelect.value;
  await supabaseRequest({ method: 'PATCH', path: 'user_accounts', accessToken: token, query: `?userid=eq.${encodeURIComponent(selectedPatient.userid)}`, body: { role: newRole } });
  await refreshLists();
}

async function onDeleteAccount() {
  if (!selectedPatient) return;
  await deleteAccount(selectedPatient.userid);
}

async function deleteAccount(userid) {
  const token = getAccessToken();
  if (!confirm(`Delete account ${userid}? This cannot be undone.`)) return;
  await supabaseRequest({ method: 'DELETE', path: 'user_accounts', accessToken: token, query: `?userid=eq.${encodeURIComponent(userid)}` });
  selectedPatient = null;
  clearDetails();
  document.getElementById('overviewSection').style.display = 'grid';
  await refreshLists();
}



