const logoutBtn  = document.getElementById('logoutBtn');
const headerRole = document.getElementById('headerRole');
const doctorInfo = document.getElementById('doctorInfo');
const rxList     = document.getElementById('rxList');

init();

async function init() {
  const token = getAccessToken();
  const email = getEmail();
  if (!token || !email) {
    window.location.href = 'home.html';
    return;
  }

  logoutBtn.addEventListener('click', () => {
    clearSession();
    window.location.href = 'home.html';
  });

  // Resolve current user
  const users = await supabaseRequest({
    method: 'GET',
    path: 'user_accounts',
    accessToken: token,
    query: `?select=userid,fullname,role&email=eq.${encodeURIComponent(email)}`
  });
  if (!users || users.length === 0) {
    alert('No profile');
    return;
  }
  const me = users[0];
  headerRole.textContent = `Patient: ${me.fullname || email}`;

  // Medication Safety Warnings based on patient's prescriptions
  await loadPatientInteractionWarnings(me.userid);

  // Doctor assignment
  const assigns = await supabaseRequest({
    method: 'GET',
    path: 'patient_doctor_assignments',
    accessToken: token,
    query: `?select=doctor_userid,patient_userid&patient_userid=eq.${encodeURIComponent(me.userid)}`
  });
  if (assigns && assigns.length > 0) {
    const docId = assigns[0].doctor_userid;
    const docs = await supabaseRequest({
      method: 'GET',
      path: 'user_accounts',
      accessToken: token,
      query: `?select=fullname,email&userid=eq.${encodeURIComponent(docId)}`
    });
    if (docs && docs[0]) {
      doctorInfo.textContent = `Doctor: ${docs[0].fullname || docs[0].email}`;
    } else {
      doctorInfo.textContent = 'Doctor: Unknown';
    }
  } else {
    doctorInfo.textContent = 'Doctor: Not assigned';
  }

  // Prescriptions list
  const meds = await supabaseRequest({
    method: 'GET',
    path: 'medications',
    accessToken: token,
    query: '?select=id,name'
  });
  const medsById = {};
  (meds || []).forEach(m => { medsById[m.id] = m.name; });

  const rx = await supabaseRequest({
    method: 'GET',
    path: 'user_medications',
    accessToken: token,
    query: `?select=medicationid,dosage_mg,form,notes,start_date,end_date&userid=eq.${encodeURIComponent(me.userid)}&order=id.desc`
  });

  rxList.innerHTML = '';
  (rx || []).forEach(r => {
    const li = document.createElement('li');
    const name = medsById[r.medicationid] || `#${r.medicationid}`;

    const title = document.createElement('div');
    title.style.fontWeight = '600';
    title.textContent = name;

    // Multi-line meta
    const parts = [
      r.dosage_mg ? `${r.dosage_mg}mg` : null,
      r.form,
      r.start_date ? `start ${r.start_date}` : null,
      r.end_date ? `end ${r.end_date}` : null
    ].filter(Boolean);

    const notes = document.createElement('div');
    notes.style.opacity = '0.85';
    notes.textContent = r.notes ? r.notes : '';

    li.appendChild(title);
    parts.forEach(line => {
      const d = document.createElement('div');
      d.textContent = line;
      li.appendChild(d);
    });
    li.appendChild(notes);
    rxList.appendChild(li);
  });

  // Sprint 3, Steven An
  // Questionnaire submission logic
  const questionnaireForm = document.getElementById("questionnaireForm");
  if (questionnaireForm) {
    questionnaireForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const token2 = getAccessToken();
      const answers = {
        allergies: document.getElementById("q_allergies").value.trim(),
        symptoms: document.getElementById("q_symptoms").value.trim(),
        otc: document.getElementById("q_otc").value.trim()
      };

      await supabaseRequest({
        method: "POST",
        path: "questionnaire_responses",
        accessToken: token2,
        body: [{
          patient_userid: me.userid,
          answers: answers
        }]
      });

      alert("Your responses have been submitted.");
      questionnaireForm.reset();
    });
  }
}

/* ===== Medication Safety Warnings    ===== */
// Sprint 3,Steven An 
// Summarize the long FDA label text into a short patient-friendly warning
function summarizeInteractionText(raw, medName) {
  if (!raw) return null;

  const textLower    = raw.toLowerCase();
  const medNameLower = (medName || "").toLowerCase();

  // Opioid-specific safety
  const OPIOID_KEYWORDS = [
    "hydrocodone", "oxycodone", "morphine", "codeine",
    "fentanyl", "hydromorphone", "oxymorphone",
    "tramadol", "methadone", "buprenorphine"
  ];

  const isOpioid =
    OPIOID_KEYWORDS.some(o => medNameLower.includes(o)) ||
    textLower.includes("opioid");

  if (isOpioid) {
    return {
      title: "Opioid safety warning",
      text: "This medication is an opioid. Opioids can cause dangerous drowsiness and slowed breathing. Avoid alcohol, benzodiazepines, and other medicines that make you sleepy unless your doctor specifically tells you it is safe."
    };
  }

  // High-priority interaction concepts from FDA text

  if (textLower.includes("alcohol") || textLower.includes("ethanol")) {
    return {
      title: "Alcohol and your medication",
      text: "Do not drink alcohol while taking this medication. The combination can cause dangerous drowsiness, breathing problems, or overdose."
    };
  }

  if (textLower.includes("benzodiazepine") ||
      textLower.includes("diazepam") ||
      textLower.includes("lorazepam") ||
      textLower.includes("alprazolam") ||
      textLower.includes("clonazepam")) {
    return {
      title: "Anxiety / sleep medicines",
      text: "This medication may interact with benzodiazepines (anxiety or sleep medicines). Together they can slow your breathing and be life-threatening. Do not combine them without talking to your doctor."
    };
  }

  if (textLower.includes("cns depressant")) {
    return {
      title: "Other medicines that make you sleepy",
      text: "This medicine may interact with other drugs that make you sleepy (like strong pain medicines, sleeping pills, or some anxiety medicines). Using them together can be dangerous without medical advice."
    };
  }

  if (textLower.includes("bleeding") ||
      textLower.includes("anticoagulant") ||
      textLower.includes("warfarin")) {
    return {
      title: "Bleeding risk",
      text: "This combination can increase your risk of serious bleeding. Watch for unusual bruising or bleeding and contact your doctor or pharmacist."
    };
  }

  if (textLower.includes("serotonin syndrome")) {
    return {
      title: "Serotonin syndrome risk",
      text: "This combination can raise serotonin levels too much and cause a serious condition called serotonin syndrome. If you feel very agitated, confused, or have a fast heartbeat or fever, contact a doctor immediately."
    };
  }

  // Fallback: compress the first sentence of whatever FDA said 
  const firstSentence = raw.split(/[\.\n]/)[0];
  const cleaned = firstSentence.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  if (cleaned.length <= 200) {
    return { title: "Interaction notice", text: cleaned };
  }

  return {
    title: "Interaction notice",
    text: cleaned.slice(0, 197) + "..."
  };
}

// Sprint 3, Steven An 
// Call openFDA for the patient's meds and collect relevant label text per med
async function checkFDAInteractionsForPatient(meds) {
  const list = meds.split(",").map(x => x.trim()).filter(Boolean);
  const results = {};

  for (const med of list) {
    const url = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${med.toUpperCase()}"&limit=3`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (!data.results || !data.results[0]) {
        results[med] = { error: "No data found", texts: [] };
        continue;
      }

      const info = data.results[0];

      // Collect text from multiple fields (Option C)
      const textPieces = [];

      function addField(fieldName) {
        const val = info[fieldName];
        if (!val) return;
        if (Array.isArray(val)) {
          val.forEach(v => {
            if (typeof v === "string") textPieces.push(v);
          });
        } else if (typeof val === "string") {
          textPieces.push(val);
        }
      }

      addField("drug_interactions");
      addField("warnings_and_cautions");
      addField("warnings");
      addField("boxed_warning");
      addField("precautions");
      addField("clinical_pharmacology");
      addField("contraindications");

      // Deduplicate text chunks
      const seen = new Set();
      const uniqueTexts = [];
      textPieces.forEach(t => {
        const key = t.slice(0, 200); // crude but enough
        if (seen.has(key)) return;
        seen.add(key);
        uniqueTexts.push(t);
      });

      results[med] = {
        texts: uniqueTexts
      };
    } catch (err) {
      console.error("openFDA error for", med, err);
      results[med] = { error: err.message, texts: [] };
    }
  }

  return { results };
}

// Sprint 3, Steven An
// Main entry point for patient safety warnings
async function loadPatientInteractionWarnings(patientUserId) {
  const token = getAccessToken();
  const safetyDiv = document.getElementById("safetyWarnings");
  if (!safetyDiv) return;

  safetyDiv.textContent = "Checking your medications for important safety warnings...";

  // All medications (id -> name)
  const medRows = await supabaseRequest({
    method: "GET",
    path: "medications",
    accessToken: token,
    query: "?select=id,name"
  });

  const medicationsById = {};
  (medRows || []).forEach(m => {
    medicationsById[m.id] = m.name;
  });

  // This patient's prescriptions
  const userMeds = await supabaseRequest({
    method: "GET",
    path: "user_medications",
    accessToken: token,
    query: `?select=id,medicationid&userid=eq.${encodeURIComponent(patientUserId)}`
  });

  const medNames = (userMeds || [])
    .map(r => medicationsById[r.medicationid])
    .filter(Boolean);

  if (medNames.length === 0) {
    safetyDiv.textContent = "You currently have no medications on file.";
    return;
  }

  // Call openFDA once we know all med names
  let data;
  try {
    data = await checkFDAInteractionsForPatient(medNames.join(", "));
  } catch (err) {
    console.error("Interaction check failed:", err);
    safetyDiv.innerHTML = `
      <p>We couldn't check interaction warnings right now.</p>
      <p class="tiny-muted">Please try again later or ask your doctor or pharmacist if you have questions.</p>
    `;
    return;
  }

  const seen = new Set();
  const warnings = [];

  // For each medication, for each relevant text block, summarize it
  Object.entries(data.results || {}).forEach(([medName, info]) => {
    (info.texts || []).forEach(txt => {
      const summary = summarizeInteractionText(txt, medName);
      if (!summary) return;

      const key = summary.title + "::" + summary.text;
      if (seen.has(key)) return;
      seen.add(key);

      warnings.push(summary);
    });
  });

  // Render warnings
  if (warnings.length === 0) {
    safetyDiv.innerHTML = `
      <p>No special interaction warnings were flagged based on your current medications.</p>
      <p class="tiny-muted">
        This does not replace advice from your doctor or pharmacist.
      </p>
    `;
  } else {
    safetyDiv.innerHTML = `
      ${warnings.map(w => `
        <div class="warning-card">
          <strong>⚠ ${w.title}</strong>
          <p>${w.text}</p>
        </div>
      `).join("")}
      <p class="tiny-muted">
        These warnings are for information only and do not replace advice from your doctor or pharmacist.
        Do not start, stop, or change any medication without talking to them.
      </p>
    `;
  }
}
