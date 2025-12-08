// Sprint 2, Steven An
// --------- Helpers for FDA interaction UI ----------
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

// --------- DOM elements ----------
const logoutBtn       = document.getElementById("logoutBtn");
const headerRole      = document.getElementById("headerRole");
const unassignedList  = document.getElementById("unassignedList");
const myPatientsList  = document.getElementById("myPatientsList");
const patientSearch   = document.getElementById("patientSearch");
const detailTitle     = document.getElementById("detailTitle");
const patientDetails  = document.getElementById("patientDetails");
const detailsPanel    = document.getElementById("detailsPanel");

// Medication form
const rxMedicationName = document.getElementById("rxMedicationName");
const rxDosage         = document.getElementById("rxDosage");
const rxForm           = document.getElementById("rxForm");
const rxNotes          = document.getElementById("rxNotes");
const rxStart          = document.getElementById("rxStart");
const rxEnd            = document.getElementById("rxEnd");
const rxSave           = document.getElementById("rxSave");

// Notes
const notesList  = document.getElementById("notesList");
const newNote    = document.getElementById("newNote");
const addNoteBtn = document.getElementById("addNoteBtn");

// Med list
const rxList = document.getElementById("rxList");

// Globals
let doctorUserId    = null;
let selectedPatient = null;
let myPatients      = [];
let medicationsById = {};

// --------- Init ----------
init();

async function init() {
  const token = getAccessToken();
  const email = getEmail();
  if (!token || !email) {
    window.location.href = "home.html";
    return;
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      clearSession();
      window.location.href = "home.html";
    });
  }

  if (patientSearch) {
    patientSearch.addEventListener("input", renderMyPatientsFiltered);
  }
  if (rxSave) {
    rxSave.addEventListener("click", onSavePrescription);
  }
  if (addNoteBtn) {
    addNoteBtn.addEventListener("click", onAddNote);
  }

  const interactionBtn = document.getElementById("interactionBtn");
  if (interactionBtn) {
    interactionBtn.addEventListener("click", handleInteractionCheck);
  }

  // Load doctor profile
  const meRows = await supabaseRequest({
    method: "GET",
    path: "user_accounts",
    accessToken: token,
    query: `?select=userid,fullname,role,email&email=eq.${encodeURIComponent(email)}&limit=1`
  });

  if (!meRows || meRows.length === 0) {
    alert("No profile found");
    return;
  }

  const me = meRows[0];
  doctorUserId = me.userid;

  if (headerRole) {
    headerRole.textContent = `Doctor: ${me.fullname || me.email || ""}`;
  }

  // Cache medications for display
  const medRows = await supabaseRequest({
    method: "GET",
    path: "medications",
    accessToken: token,
    query: "?select=id,name&order=name.asc"
  });

  medicationsById = {};
  (medRows || []).forEach(m => {
    medicationsById[m.id] = m.name;
  });

  await refreshLists();
}

// --------- Patient list / assignments ----------
async function refreshLists() {
  const token = getAccessToken();

  // All patients
  const patients = await supabaseRequest({
    method: "GET",
    path: "user_accounts",
    accessToken: token,
    query: "?select=userid,fullname,email,role&role=eq.patient&order=fullname.asc"
  });

  // All assignments
  const assignments = await supabaseRequest({
    method: "GET",
    path: "patient_doctor_assignments",
    accessToken: token,
    query: "?select=patient_userid,doctor_userid,notes"
  });

  const assignedSet = new Set((assignments || []).map(a => a.patient_userid));

  const unassigned = (patients || []).filter(p => !assignedSet.has(p.userid));
  renderUnassigned(unassigned);

  // My patients = those assigned to THIS doctor
  const myIds = new Set(
    (assignments || [])
      .filter(a => a.doctor_userid === doctorUserId)
      .map(a => a.patient_userid)
  );
  myPatients = (patients || []).filter(p => myIds.has(p.userid));

  renderMyPatientsFiltered();
}

function renderUnassigned(list) {
  if (!unassignedList) return;
  unassignedList.innerHTML = "";
  list.forEach(p => {
    const li = document.createElement("li");

    const nameSpan = document.createElement("span");
    nameSpan.textContent = p.fullname || p.email || p.userid;

    const btn = document.createElement("button");
    btn.textContent = "Assign to me";
    btn.addEventListener("click", () => assignPatient(p.userid));

    li.appendChild(nameSpan);
    li.appendChild(btn);
    unassignedList.appendChild(li);
  });
}

function renderMyPatientsFiltered() {
  if (!myPatientsList) return;
  myPatientsList.innerHTML = "";
  const q = (patientSearch && patientSearch.value ? patientSearch.value : "").toLowerCase();

  const filtered = myPatients.filter(p => {
    const name  = (p.fullname || "").toLowerCase();
    const email = (p.email || "").toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  filtered.forEach(p => {
    const li = document.createElement("li");

    const label = document.createElement("span");
    label.textContent = p.fullname || p.email || p.userid;

    const viewBtn = document.createElement("button");
    viewBtn.textContent = "View";
    viewBtn.addEventListener("click", () => openPatient(p));

    const removeBtn = document.createElement("button");
    removeBtn.className = "small-btn remove-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => unassignPatient(p.userid));

    li.appendChild(label);
    li.appendChild(viewBtn);
    li.appendChild(removeBtn);
    myPatientsList.appendChild(li);
  });
}

async function assignPatient(patientUserId) {
  const token = getAccessToken();

  await supabaseRequest({
    method: "POST",
    path: "patient_doctor_assignments",
    accessToken: token,
    body: [{
      patient_userid: patientUserId,
      doctor_userid: doctorUserId
    }]
  });

  await refreshLists();
}

async function unassignPatient(patientUserId) {
  const token = getAccessToken();

  await supabaseRequest({
    method: "DELETE",
    path: "patient_doctor_assignments",
    accessToken: token,
    query: `?patient_userid=eq.${encodeURIComponent(patientUserId)}&doctor_userid=eq.${encodeURIComponent(doctorUserId)}`
  });

  if (selectedPatient && selectedPatient.userid === patientUserId) {
    selectedPatient = null;
    clearDetails();
  }

  await refreshLists();
}

// --------- Patient details ----------
function clearDetails() {
  if (detailTitle) {
    detailTitle.textContent = "Patient Details";
  }
  if (patientDetails) {
    patientDetails.textContent = "Select a patient to view notes and medications.";
  }
  if (detailsPanel) {
    detailsPanel.style.display = "none";
  }
  if (rxList) rxList.innerHTML = "";
  if (notesList) notesList.innerHTML = "";
  const formPanel = document.getElementById("prescriptionForm");
  if (formPanel) formPanel.style.display = "none";
}

async function openPatient(patient) {
  selectedPatient = patient;

  if (detailTitle) {
    detailTitle.textContent = `Patient Details — ${patient.fullname || patient.email || ""}`;
  }
  if (patientDetails) {
    patientDetails.textContent = `${patient.userid} • ${patient.email || ""}`;
  }

  if (detailsPanel) {
    detailsPanel.style.display = "block";
  }
  const formPanel = document.getElementById("prescriptionForm");
  if (formPanel) formPanel.style.display = "block";

  await loadNotes();
  await loadPrescriptions();
  await loadQuestionnaires();

  try {
    if (detailsPanel) {
      detailsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (_) {}
}

// --------- Notes (with delete) ----------
async function loadNotes() {
  if (!notesList || !selectedPatient) return;
  notesList.innerHTML = "";
  const token = getAccessToken();

  const rows = await supabaseRequest({
    method: "GET",
    path: "patient_doctor_assignments",
    accessToken: token,
    query: `?select=id,notes&patient_userid=eq.${encodeURIComponent(selectedPatient.userid)}&doctor_userid=eq.${encodeURIComponent(doctorUserId)}&limit=1`
  });

  if (!rows || rows.length === 0) return;

  const assignment = rows[0];
  const notes = assignment.notes || "";

  const lines = notes.split("\n").filter(l => l.trim() !== "");
  lines.forEach((line, idx) => {
    const li = document.createElement("li");

    const textSpan = document.createElement("span");
    textSpan.textContent = line;

    const delBtn = document.createElement("button");
    delBtn.className = "small-btn";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => deleteNote(idx));

    li.appendChild(textSpan);
    li.appendChild(delBtn);
    notesList.appendChild(li);
  });
}

async function deleteNote(noteIndex) {
  if (!selectedPatient) return;
  const token = getAccessToken();

  const rows = await supabaseRequest({
    method: "GET",
    path: "patient_doctor_assignments",
    accessToken: token,
    query: `?select=id,notes&patient_userid=eq.${encodeURIComponent(selectedPatient.userid)}&doctor_userid=eq.${encodeURIComponent(doctorUserId)}&limit=1`
  });

  if (!rows || rows.length === 0) return;

  const assignmentId = rows[0].id;
  const current = rows[0].notes || "";
  const lines = current.split("\n").filter(l => l.trim() !== "");

  if (noteIndex < 0 || noteIndex >= lines.length) return;

  lines.splice(noteIndex, 1);
  const updated = lines.join("\n");

  await supabaseRequest({
    method: "PATCH",
    path: "patient_doctor_assignments",
    accessToken: token,
    body: { notes: updated },
    query: `?id=eq.${assignmentId}`
  });

  await loadNotes();
}

async function onAddNote() {
  const note = (newNote && newNote.value || "").trim();
  if (!note || !selectedPatient) return;

  const token = getAccessToken();
  const rows = await supabaseRequest({
    method: "GET",
    path: "patient_doctor_assignments",
    accessToken: token,
    query: `?select=id,notes&patient_userid=eq.${encodeURIComponent(selectedPatient.userid)}&doctor_userid=eq.${encodeURIComponent(doctorUserId)}&limit=1`
  });

  if (!rows || rows.length === 0) return;

  const assignmentId = rows[0].id;
  const current = rows[0].notes || "";
  const ts = new Date().toISOString();
  const updated = (current ? current + "\n" : "") + `${ts} — ${note}`;

  await supabaseRequest({
    method: "PATCH",
    path: "patient_doctor_assignments",
    accessToken: token,
    body: { notes: updated },
    query: `?id=eq.${assignmentId}`
  });

  if (newNote) newNote.value = "";
  await loadNotes();
}

// --------- Prescriptions (free-text medication name) ----------
async function loadPrescriptions() {
  if (!rxList || !selectedPatient) return;
  rxList.innerHTML = "";
  const token = getAccessToken();

  const rows = await supabaseRequest({
    method: "GET",
    path: "user_medications",
    accessToken: token,
    query: `?select=id,medicationid,dosage_mg,form,notes,start_date,end_date&userid=eq.${encodeURIComponent(selectedPatient.userid)}&order=id.desc`
  });

  (rows || []).forEach(r => {
    const li = document.createElement("li");

    const left = document.createElement("div");
    const nameDiv = document.createElement("div");
    nameDiv.style.fontWeight = "600";
    nameDiv.textContent = medicationsById[r.medicationid] || `Medication #${r.medicationid}`;
    left.appendChild(nameDiv);

    const metaLines = [
      r.dosage_mg ? `${r.dosage_mg} mg` : null,
      r.form || null,
      r.start_date ? `start ${r.start_date}` : null,
      r.end_date ? `end ${r.end_date}` : null
    ].filter(Boolean);

    metaLines.forEach(line => {
      const d = document.createElement("div");
      d.textContent = line;
      left.appendChild(d);
    });

    if (r.notes) {
      const notesDiv = document.createElement("div");
      notesDiv.style.opacity = "0.85";
      notesDiv.textContent = r.notes;
      left.appendChild(notesDiv);
    }

    const removeBtn = document.createElement("button");
    removeBtn.className = "small-btn remove-btn";
    removeBtn.textContent = "x";
    removeBtn.addEventListener("click", async () => {
      await supabaseRequest({
        method: "DELETE",
        path: "user_medications",
        accessToken: token,
        query: `?id=eq.${encodeURIComponent(r.id)}`
      });
      await loadPrescriptions();
    });

    li.appendChild(left);
    li.appendChild(removeBtn);
    rxList.appendChild(li);
  });
}

async function onSavePrescription() {
  if (!selectedPatient) return;

  const token = getAccessToken();

  const medName = (rxMedicationName && rxMedicationName.value || "").trim();
  if (!medName) {
    alert("Please enter a medication name.");
    return;
  }

  // Find or create medication row by name
  let medicationid = null;

  const existing = await supabaseRequest({
    method: "GET",
    path: "medications",
    accessToken: token,
    query: `?select=id,name&name=eq.${encodeURIComponent(medName)}&limit=1`
  });

  if (existing && existing.length > 0) {
    medicationid = existing[0].id;
  } else {
    const inserted = await supabaseRequest({
      method: "POST",
      path: "medications",
      accessToken: token,
      body: [{ name: medName }]
    });
    if (inserted && inserted[0] && inserted[0].id !== undefined) {
      medicationid = inserted[0].id;
    }
  }

  if (medicationid == null) {
    alert("Unable to save medication.");
    return;
  }

  // Update cache
  medicationsById[medicationid] = medName;

  const dosage_mg = rxDosage && rxDosage.value ? parseFloat(rxDosage.value) : null;
  const form      = (rxForm && rxForm.value  || "").trim() || null;
  const notes     = (rxNotes && rxNotes.value || "").trim() || null;
  const start     = rxStart && rxStart.value || null;
  const end       = rxEnd && rxEnd.value   || null;

  await supabaseRequest({
    method: "POST",
    path: "user_medications",
    accessToken: token,
    body: [{
      userid:       selectedPatient.userid,
      medicationid: medicationid,
      dosage_mg:    dosage_mg,
      form:         form,
      notes:        notes,
      start_date:   start,
      end_date:     end
    }]
  });

  if (rxMedicationName) rxMedicationName.value = "";
  if (rxDosage) rxDosage.value = "";
  if (rxForm) rxForm.value = "";
  if (rxNotes) rxNotes.value = "";
  if (rxStart) rxStart.value = "";
  if (rxEnd) rxEnd.value = "";

  await loadPrescriptions();
}

// Sprint 3, Steven An
// --------- Questionnaire responses ----------
async function loadQuestionnaires() {
  if (!selectedPatient) return;
  const token = getAccessToken();

  const rows = await supabaseRequest({
    method: "GET",
    path: "questionnaire_responses",
    accessToken: token,
    query: `?select=answers,created_at&patient_userid=eq.${encodeURIComponent(selectedPatient.userid)}&order=created_at.desc`
  });

  const qList = document.getElementById("questionnaireList");
  if (!qList) return;
  qList.innerHTML = "";

  (rows || []).forEach(r => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div><strong>${new Date(r.created_at).toLocaleString()}</strong></div>
      <div>Allergies: ${r.answers?.allergies || "N/A"}</div>
      <div>Symptoms: ${r.answers?.symptoms || "N/A"}</div>
      <div>OTC meds: ${r.answers?.otc || "N/A"}</div>
    `;
    qList.appendChild(li);
  });
}

// Sprint 2, Steven An
// Allows Doctor to check for drug interactions using openFDA API
// --------- FDA Drug Interaction Checker ----------
async function handleInteractionCheck() {
  const medsInput  = document.getElementById("interactionInput");
  const resultsDiv = document.getElementById("interactionResults");

  const meds = medsInput.value.trim();
  if (!meds) {
    resultsDiv.innerHTML = "<p>Please enter medications.</p>";
    return;
  }

  const list = meds.split(",").map(x => x.trim()).filter(Boolean);
  resultsDiv.innerHTML = "<p>Checking...</p>";

  const data = await checkFDAInteractions(meds);

  // ---------- Single-drug behavior (now with fallback to warnings) ----------
  if (list.length === 1) {
    const medName = list[0];
    const info = data.results && data.results[medName];

    const interactions  = (info && info.interactions)   || [];
    const fallbackTexts = (info && info.fallbackTexts)  || [];

    // Prefer drug_interactions if present; otherwise use fallback warning text
    let labelTexts = interactions.length ? interactions : fallbackTexts;

    if (!labelTexts.length) {
      resultsDiv.innerHTML = `
        <p>No interaction or warning information was found in the FDA label fields we checked for this medication.</p>
      `;
      return;
    }

    let html = `<h4>FDA label information for ${medName}</h4>`;

    labelTexts.forEach(txt => {
      const shortText = truncate(txt, 150);
      const fullText  = txt.replace(/\n/g, "<br>");

      html += `
        <div class="interaction-item">
          <p>
            <span class="short-text">${shortText}</span>
            <span class="full-text" style="display:none;">${fullText}</span>
          </p>
          <button class="toggle-btn" onclick="toggleInteraction(this)">Show More</button>
        </div>
      `;
    });

    resultsDiv.innerHTML = html;
    return; // don't run multi-drug logic
  }

  // ---------- Existing multi-drug behavior ----------
  if (!data.interactionPairs.length) {
    resultsDiv.innerHTML = "<p>No cross-interactions detected.</p>";
    return;
  }

  let html = "<h4>Detected Interactions</h4>";

  data.interactionPairs.forEach(pair => {
    const shortText = truncate(pair.text, 150);
    const fullText  = pair.text.replace(/\n/g, "<br>");

    html += `
      <div class="interaction-item">
        <p>
          <strong>${pair.from} ↔ ${pair.to}:</strong>
          <span class="short-text">${shortText}</span>
          <span class="full-text" style="display:none;">${fullText}</span>
        </p>
        <button class="toggle-btn" onclick="toggleInteraction(this)">Show More</button>
      </div>
    `;
  });

  resultsDiv.innerHTML = html;
}

async function checkFDAInteractions(meds) {
  const list = meds.split(",").map(x => x.trim()).filter(Boolean);
  const results = {};
  const pairs = [];

  for (const med of list) {
    const url = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${med.toUpperCase()}"&limit=3`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (!data.results || !data.results[0]) {
        results[med] = { error: "No data found", interactions: [], fallbackTexts: [] };
        continue;
      }

      const info = data.results[0];

      // Primary interaction field (what you were using before)
      const interactions = info.drug_interactions || [];

      // Fallback: pull extra warning-related fields if needed
      const fallbackTexts = [];
      function addField(fieldName) {
        const val = info[fieldName];
        if (!val) return;
        if (Array.isArray(val)) {
          val.forEach(v => {
            if (typeof v === "string") fallbackTexts.push(v);
          });
        } else if (typeof val === "string") {
          fallbackTexts.push(val);
        }
      }

      // These are common places where ibuprofen / NSAID warnings live
      addField("warnings_and_cautions");
      addField("warnings");
      addField("boxed_warning");
      addField("precautions");
      addField("contraindications");

      results[med] = {
        interactions: interactions,
        fallbackTexts: fallbackTexts
      };
    } catch (err) {
      results[med] = { error: err.message, interactions: [], fallbackTexts: [] };
    }
  }

  // Build interaction pairs (unchanged logic)
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

