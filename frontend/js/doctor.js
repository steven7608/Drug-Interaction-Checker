// Utility to truncate long text for drug interactions display
function truncate(text, maxLength = 150) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

function toggleInteraction(btn) {
  const container = btn.closest(".interaction-item");
  const shortText = container.querySelector(".short-text");
  const fullText = container.querySelector(".full-text");

  if (fullText.style.display === "none") {
    fullText.style.display = "inline";
    shortText.style.display = "none";
    btn.textContent = "Show Less";
  } else {
    fullText.style.display = "none";
    shortText.style.display = "inline";
    btn.textContent = "Show More";
  }
}

const logoutBtn = document.getElementById('logoutBtn');
const headerRole = document.getElementById('headerRole');
const unassignedList = document.getElementById('unassignedList');
const myPatientsList = document.getElementById('myPatientsList');
const patientSearch = document.getElementById('patientSearch');
const patientDetails = document.getElementById('patientDetails');
const detailTitle = document.getElementById('detailTitle');
const rxMedication = document.getElementById('rxMedication');
const rxDosage = document.getElementById('rxDosage');
const rxForm = document.getElementById('rxForm');
const rxNotes = document.getElementById('rxNotes');
const rxStart = document.getElementById('rxStart');
const rxEnd = document.getElementById('rxEnd');
const rxSave = document.getElementById('rxSave');
const notesList = document.getElementById('notesList');
const newNote = document.getElementById('newNote');
const addNoteBtn = document.getElementById('addNoteBtn');
const rxList = document.getElementById('rxList');

let doctorUserId = null;
let selectedPatient = null;
let medicationsById = {};

init();

async function init() {
  const token = getAccessToken();
  const email = getEmail();
  if (!token || !email) { window.location.href = 'home.html'; return; }

  logoutBtn.addEventListener('click', () => { clearSession(); window.location.href = 'home.html'; });
  patientSearch.addEventListener('input', renderMyPatientsFiltered);
  rxSave.addEventListener('click', onSavePrescription);
  addNoteBtn.addEventListener('click', onAddNote);

  // Load doctor profile
  const rows = await supabaseRequest({ method: 'GET', path: 'user_accounts', accessToken: token, query: `?select=userid,fullname,role&email=eq.${encodeURIComponent(email)}` });
  if (!rows || rows.length === 0) { alert('No profile found'); return; }
  const me = rows[0];
  doctorUserId = me.userid;
  headerRole.textContent = `Doctor: ${me.fullname}`;

  // Load medications for prescribing
  const meds = await supabaseRequest({ method: 'GET', path: 'medications', accessToken: token, query: '?select=id,name&order=name.asc' });
  medicationsById = {};
  rxMedication.innerHTML = '';
  meds.forEach(m => { medicationsById[m.id] = m.name; const o = document.createElement('option'); o.value = m.id; o.textContent = m.name; rxMedication.appendChild(o); });

  // Show only two columns initially (details panel remains but shows helper text)
  await refreshLists();

  // Interaction Checker Button
  document.getElementById("interactionBtn").addEventListener("click", handleInteractionCheck);

}

async function refreshLists() {
  const token = getAccessToken();
  // Unassigned = patients with role=patient not found in assignments table
  const patients = await supabaseRequest({ method: 'GET', path: 'user_accounts', accessToken: token, query: `?select=userid,fullname,email,role&role=eq.patient&order=fullname.asc` });
  const assignments = await supabaseRequest({ method: 'GET', path: 'patient_doctor_assignments', accessToken: token, query: '?select=patient_userid,doctor_userid,notes' });
  const assignedSet = new Set(assignments.map(a => a.patient_userid));

  const unassigned = patients.filter(p => !assignedSet.has(p.userid));
  renderUnassigned(unassigned);

  // My patients = those assigned to me
  const mine = assignments.filter(a => a.doctor_userid === doctorUserId).map(a => a.patient_userid);
  const myPatients = patients.filter(p => mine.includes(p.userid));
  window.__myPatients = myPatients; // for filter
  renderMyPatientsFiltered();
}

function renderUnassigned(unassigned) {
  unassignedList.innerHTML = '';
  unassigned.forEach(p => {
    const li = document.createElement('li');
    li.textContent = (p.fullname);
    const btn = document.createElement('button');
    btn.textContent = 'Assign to me';
    btn.addEventListener('click', () => assignPatient(p.userid));
    li.appendChild(document.createTextNode(' '));
    li.appendChild(btn);
    unassignedList.appendChild(li);
  });
}

function renderMyPatientsFiltered() {
  const q = (patientSearch.value || '').toLowerCase();
  const list = (window.__myPatients || []).filter(p => {
    const t = ((p.fullname || '')).toLowerCase();
    return t.includes(q);
  });
  myPatientsList.innerHTML = '';
  list.forEach(p => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = (p.fullname);
    const open = document.createElement('button'); open.textContent = 'View'; open.addEventListener('click', () => openPatient(p));
    const remove = document.createElement('button'); remove.textContent = 'Remove'; remove.className = 'small-btn'; remove.addEventListener('click', () => unassignPatient(p.userid));
    li.appendChild(label);
    li.appendChild(open);
    li.appendChild(remove);
    myPatientsList.appendChild(li);
  });
}

async function assignPatient(patientUserId) {
  const token = getAccessToken();
  await supabaseRequest({ method: 'POST', path: 'patient_doctor_assignments', accessToken: token, body: [{ patient_userid: patientUserId, doctor_userid: doctorUserId }] });
  await refreshLists();
}

async function unassignPatient(patientUserId) {
  const token = getAccessToken();
  // delete assignment for this doctor and patient
  await supabaseRequest({ method: 'DELETE', path: 'patient_doctor_assignments', accessToken: token, query: `?patient_userid=eq.${encodeURIComponent(patientUserId)}&doctor_userid=eq.${encodeURIComponent(doctorUserId)}` });
  if (selectedPatient && selectedPatient.userid === patientUserId) { selectedPatient = null; clearDetails(); }
  await refreshLists();
}

function clearDetails() {
  detailTitle.textContent = 'Patient Details';
  patientDetails.textContent = 'Select a patient to view notes and medications.';
  document.getElementById('prescriptionForm').style.display = 'none';
  notesList.innerHTML = '';
  rxList.innerHTML = '';
}

async function openPatient(patient) {
  selectedPatient = patient;
  // Hide other columns and show details only
  document.getElementById('overviewSection').style.display = 'none';
  const detailsPanel = document.getElementById('detailsPanel');
  detailsPanel.style.display = 'block';
  detailTitle.textContent = `Patient Details — ${(patient.fullname || 'Unknown')}`;
  document.getElementById('prescriptionForm').style.display = 'block';
  await loadNotes();
  await loadPrescriptions();
  await loadQuestionnaires();
  try { detailsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
}

async function loadNotes() {
  notesList.innerHTML = '';
  const token = getAccessToken();
  const rows = await supabaseRequest({ method: 'GET', path: 'patient_doctor_assignments', accessToken: token, query: `?select=notes&patient_userid=eq.${encodeURIComponent(selectedPatient.userid)}&doctor_userid=eq.${encodeURIComponent(doctorUserId)}&limit=1` });
  const notes = (rows && rows[0] && rows[0].notes) || '';
  if (notes) {
    notes.split('\n').forEach(line => {
      const li = document.createElement('li');
      li.textContent = line;
      notesList.appendChild(li);
    });
  }
}

async function onAddNote() {
  const note = (newNote.value || '').trim();
  if (!note) return;
  const token = getAccessToken();
  // Fetch current notes
  const rows = await supabaseRequest({ method: 'GET', path: 'patient_doctor_assignments', accessToken: token, query: `?select=id,notes&patient_userid=eq.${encodeURIComponent(selectedPatient.userid)}&doctor_userid=eq.${encodeURIComponent(doctorUserId)}&limit=1` });
  if (!rows || rows.length === 0) return;
  const assignmentId = rows[0].id;
  const current = rows[0].notes || '';
  const ts = new Date().toISOString();
  const updated = (current ? current + '\n' : '') + `${ts} — ${note}`;
  await supabaseRequest({ method: 'PATCH', path: 'patient_doctor_assignments', accessToken: token, body: { notes: updated }, query: `?id=eq.${assignmentId}` });
  newNote.value = '';
  await loadNotes();
}

async function loadPrescriptions() {
  const token = getAccessToken();
  const rows = await supabaseRequest({ method: 'GET', path: 'user_medications', accessToken: token, query: `?select=id,medicationid,dosage_mg,form,notes,start_date,end_date&userid=eq.${encodeURIComponent(selectedPatient.userid)}&order=id.desc` });
  const list = document.getElementById('rxList');
  list.innerHTML = '';
  rows.forEach(r => {
    const li = document.createElement('li');
    const left = document.createElement('div');
    const name = document.createElement('div');
    name.style.fontWeight = '600';
    name.textContent = medicationsById[r.medicationid] || `#${r.medicationid}`;
    const notes = document.createElement('div');
    notes.style.opacity = '0.85';
    notes.textContent = r.notes || '';
    left.appendChild(name);
    // Build meta as multiple lines
    const metaLines = [
      r.dosage_mg ? `${r.dosage_mg}mg` : null,
      r.form || null,
      r.start_date ? `start ${r.start_date}` : null,
      r.end_date ? `end ${r.end_date}` : null,
    ].filter(Boolean);
    metaLines.forEach(line => {
      const div = document.createElement('div');
      div.textContent = line;
      left.appendChild(div);
    });
    left.appendChild(notes);
    const remove = document.createElement('button');
    remove.className = 'small-btn';
    remove.textContent = 'x';
    remove.addEventListener('click', async () => {
      await supabaseRequest({ method: 'DELETE', path: 'user_medications', accessToken: token, query: `?id=eq.${encodeURIComponent(r.id)}` });
      await loadPrescriptions();
    });
    li.appendChild(left);
    li.appendChild(remove);
    list.appendChild(li);
  });
}

async function onSavePrescription() {
  if (!selectedPatient) return;
  const token = getAccessToken();
  const medicationid = parseInt(rxMedication.value, 10);
  const dosage_mg = rxDosage.value ? parseFloat(rxDosage.value) : null;
  const form = (rxForm.value || '').trim() || null;
  const notes = (rxNotes.value || '').trim() || null;
  const start_date = rxStart.value || null;
  const end_date = rxEnd.value || null;
  await supabaseRequest({ method: 'POST', path: 'user_medications', accessToken: token, body: [{ userid: selectedPatient.userid, medicationid, dosage_mg, form, notes, start_date, end_date }] });
  rxDosage.value = ''; rxForm.value=''; rxNotes.value=''; rxStart.value=''; rxEnd.value='';
  await loadPrescriptions();
}

/* Load Questionnaire Responses */
async function loadQuestionnaires() {
  const token = getAccessToken();

  const results = await supabaseRequest({
    method: "GET",
    path: "questionnaire_responses",
    accessToken: token,
    query: `?select=answers,created_at&patient_userid=eq.${encodeURIComponent(selectedPatient.userid)}&order=created_at.desc`
  });

  const qList = document.getElementById("questionnaireList");
  qList.innerHTML = "";

  results.forEach(r => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div><strong>${new Date(r.created_at).toLocaleString()}</strong></div>
      <div>Allergies: ${r.answers.allergies || "N/A"}</div>
      <div>Symptoms: ${r.answers.symptoms || "N/A"}</div>
      <div>OTC meds: ${r.answers.otc || "N/A"}</div>
    `;
    qList.appendChild(li);
  });
}


// ===== FDA Interaction Checker =====

async function handleInteractionCheck() {
  const meds = document.getElementById("interactionInput").value.trim();
  const resultsDiv = document.getElementById("interactionResults");

  if (!meds) {
    resultsDiv.innerHTML = "<p>Please enter medications.</p>";
    return;
  }

  resultsDiv.innerHTML = "<p>Checking...</p>";

  const data = await checkFDAInteractions(meds);

  let html = "<h4>Detected Interactions</h4>";

  if (data.interactionPairs.length === 0) {
    resultsDiv.innerHTML = "<p>No cross-interactions detected.</p>";
    return;
  }

  data.interactionPairs.forEach(pair => {
    const shortText = truncate(pair.text, 150);
    const fullText = pair.text.replace(/\n/g, "<br>");

    html += `
      <div class="interaction-item">
        <p>
          <strong>${pair.from} ↔ ${pair.to}:</strong>
          <span class="short-text">${shortText}</span>
          <span class="full-text" style="display:none;">${fullText}</span>
        </p>

        <button class="toggle-btn" onclick="toggleInteraction(this)">
          Show More
        </button>
      </div>
    `;
  });

  resultsDiv.innerHTML = html;
}

async function checkFDAInteractions(meds) {
  const list = meds.split(",").map(x => x.trim());

  const results = {};
  const pairs = [];

  for (const med of list) {
    const url = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${med.toUpperCase()}"&limit=3`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (!data.results) {
        results[med] = { error: "No data found" };
        continue;
      }

      const info = data.results[0];
      results[med] = {
        interactions: info.drug_interactions || [],
      };

    } catch (err) {
      results[med] = { error: err.message };
    }
  }

  for (const m1 of list) {
    for (const m2 of list) {
      if (m1 === m2) continue;
      const texts = results[m1]?.interactions || [];

      texts.forEach(txt => {
        if (txt.toLowerCase().includes(m2.toLowerCase())) {
          pairs.push({ from: m1, to: m2, text: txt });
        }
      });
    }
  }

  return { results, interactionPairs: pairs };
}