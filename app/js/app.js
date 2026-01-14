let account_id, app_id;
let cachedFile = null;
let cachedBase64 = null;

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("vat-certificate");

function showModal(type, title, message) {
  const modal = document.getElementById("custom-modal");
  const iconSuccess = document.getElementById("modal-icon-success");
  const iconError = document.getElementById("modal-icon-error");
  const modalBtn = document.getElementById("modal-close");
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-message").textContent = message;
  modalBtn.onclick = closeModal;
  if (type === "success") { 
    iconSuccess.classList.remove("hidden"); 
    iconError.classList.add("hidden");
    modalBtn.onclick = async () => {
      modalBtn.disabled = true;
      modalBtn.textContent = "Finalizing...";
      try {
        await ZOHO.CRM.BLUEPRINT.proceed();
        setTimeout(() => {
          window.top.location.href = window.top.location.href;
        }, 800);
      } catch (e) {
        ZOHO.CRM.UI.Popup.closeReload();
      }
    };
  } else { 
    iconSuccess.classList.add("hidden"); 
    iconError.classList.remove("hidden"); 
  }
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeModal() {
  const modal = document.getElementById("custom-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function clearErrors() { document.querySelectorAll(".error-message").forEach(span => span.textContent = ""); }
function showError(fieldId, message) { const errorSpan = document.getElementById(`error-${fieldId}`); if (errorSpan) errorSpan.textContent = message; }

function showUploadBuffer(message = "Processing...") {
  const buffer = document.getElementById("upload-buffer");
  document.getElementById("upload-title").textContent = message;
  buffer.classList.remove("hidden");
}

function hideUploadBuffer() { document.getElementById("upload-buffer").classList.add("hidden"); }

async function closeWidget() { await ZOHO.CRM.UI.Popup.closeReload().catch(err => console.error(err)); }

ZOHO.embeddedApp.on("PageLoad", async (entity) => {
  try {
    const data = await ZOHO.CRM.API.getRecord({ Entity: "Applications1", approved: "both", RecordID: entity.EntityId });
    const applicationData = data.data[0];
    app_id = applicationData.id;
    if (applicationData.Account_Name && applicationData.Account_Name.id) {
        account_id = applicationData.Account_Name.id;
    }
  } catch (err) { console.error(err); }
});

// Reimplemented attachment handling based on the perfect code
async function handleFile(file) {
  clearErrors();
  const display = document.getElementById("file-name-display");
  if (!file) { cachedFile = null; cachedBase64 = null; display.textContent = "Click or Drag & Drop Certificate"; return; }
  
  if (file.size > 20 * 1024 * 1024) {
    showError("vat-certificate", "File size must not exceed 20MB.");
    return;
  }

  display.textContent = `File: ${file.name}`;
  
  try {
    const content = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });

    cachedFile = file;
    cachedBase64 = content;
  } catch (err) { 
    console.error(err);
    showModal("error", "Error", "Failed to read file."); 
  }
}

fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("drag-active"); });
dropZone.addEventListener("dragleave", () => { dropZone.classList.remove("drag-active"); });
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-active");
  const files = e.dataTransfer.files;
  if (files.length) { fileInput.files = files; handleFile(files[0]); }
});
dropZone.onclick = function() { fileInput.click(); };

function formatDate(date) {
    const d = new Date(date);
    return d.getFullYear() + "-" + (d.getMonth() + 1).toString().padStart(2, '0') + "-" + d.getDate().toString().padStart(2, '0');
}

function calculateDueDates() {
    const effectiveDateInput = document.getElementById("effective-date");
    const taxPeriodSelect = document.getElementById("tax-period-vat");
    if (!effectiveDateInput.value || !taxPeriodSelect.value) return;
    const effectiveDate = new Date(effectiveDateInput.value);
    const taxPeriodValue = taxPeriodSelect.value;
    const quarters = {
        "Q1: 1 Jan - 31 Mar, Q2: 1 Apr - 30 Jun, Q3: 1 Jul - 30 Sep, Q4: 1 Oct - 31 Dec": [{m:2,d:31},{m:5,d:30},{m:8,d:30},{m:11,d:31}],
        "Q1: 1 Feb - 30 Apr, Q2: 1 May - 31 Jul, Q3: 1 Aug - 31 Oct, Q4: 1 Nov - 31 Jan": [{m:3,d:30},{m:6,d:31},{m:9,d:31},{m:0,d:31, ny:true}],
        "Q1: 1 Mar - 31 May, Q2: 1 Jun - 31 Aug, Q3: 1 Sep - 30 Nov, Q4: 1 Dec - 28/29 Feb": [{m:4,d:31},{m:7,d:31},{m:10,d:30},{m:1,d:28, ny:true}]
    }[taxPeriodValue];
    const month = effectiveDate.getMonth();
    let qIdx = (taxPeriodValue.includes("Jan")) ? (month <= 2 ? 0 : month <= 5 ? 1 : month <= 8 ? 2 : 3) : 
                (taxPeriodValue.includes("Feb")) ? (month >= 1 && month <= 3 ? 0 : month >= 4 && month <= 6 ? 1 : month >= 7 && month <= 9 ? 2 : 3) :
                (month >= 2 && month <= 4 ? 0 : month >= 5 && month <= 7 ? 1 : month >= 8 && month <= 10 ? 2 : 3);
    const firstQ = quarters[qIdx];
    let yr = firstQ.ny ? effectiveDate.getFullYear() + 1 : effectiveDate.getFullYear();
    let d1 = new Date(yr, firstQ.m, firstQ.d);
    d1.setDate(d1.getDate() + 28);
    const getNext = (d) => { let next = new Date(d); next.setMonth(next.getMonth() + 3); next.setDate(28); return next; };
    let seq = [d1, getNext(d1), getNext(getNext(d1)), getNext(getNext(getNext(d1)))];
    let res = [null,null,null,null];
    for(let i=0; i<4; i++) res[(qIdx + i) % 4] = seq[i];
    document.getElementById("first-qtr-return-due-date").value = formatDate(res[0]);
    document.getElementById("second-qtr-return-due-date").value = formatDate(res[1]);
    document.getElementById("third-qtr-return-due-date").value = formatDate(res[2]);
    document.getElementById("forth-qtr-return-due-date").value = formatDate(res[3]);
}

function setTaxPeriod() {
    const effectiveDateValue = document.getElementById("effective-date").value;
    if(!effectiveDateValue) return;
    const effectiveDate = new Date(effectiveDateValue);
    const month = effectiveDate.getMonth() + 1;
    const select = document.getElementById("tax-period-vat");
    const periods = {
        "Q1: 1 Jan - 31 Mar, Q2: 1 Apr - 30 Jun, Q3: 1 Jul - 30 Sep, Q4: 1 Oct - 31 Dec": [1, 4, 7, 10],
        "Q1: 1 Feb - 30 Apr, Q2: 1 May - 31 Jul, Q3: 1 Aug - 31 Oct, Q4: 1 Nov - 31 Jan": [2, 5, 8, 11],
        "Q1: 1 Mar - 31 May, Q2: 1 Jun - 31 Aug, Q3: 1 Sep - 30 Nov, Q4: 1 Dec - 28/29 Feb": [3, 6, 9, 12]
    };
    for (const [key, val] of Object.entries(periods)) { if (val.includes(month)) { select.value = key; break; } }
    calculateDueDates();
}

async function update_record(event) {
  event.preventDefault();
  clearErrors();
  const trn = document.getElementById("tax-registration-number").value.trim();
  const period = document.getElementById("tax-period-vat").value;
  const effective = document.getElementById("effective-date").value;
  const issue = document.getElementById("date-of-issue").value;
  const giban = document.getElementById("pay-giban").value.trim();
  
  if (!trn || !period || !effective || !issue || !giban || !cachedFile || !cachedBase64) {
    if(!trn) showError("tax-registration-number", "Required");
    if(!period) showError("tax-period-vat", "Required");
    if(!effective) showError("effective-date", "Required");
    if(!issue) showError("date-of-issue", "Required");
    if(!giban) showError("pay-giban", "Required");
    if(!cachedFile) showError("vat-certificate", "Upload required");
    return;
  }
  
  const btn = document.getElementById("submit_button_id");
  btn.disabled = true;
  btn.textContent = "Updating...";
  showUploadBuffer("Submitting Application...");
  
  try {
    await ZOHO.CRM.API.updateRecord({
      Entity: "Applications1",
      APIData: {
        id: app_id,
        Tax_Registration_Number_TRN: trn,
        Tax_Period_VAT: period,
        Pay_GIBAN: giban,
        Subform_2: [
            { Type_of_Dates: "Date of Issue", Date: issue },
            { Type_of_Dates: "Effective Date of Registration", Date: effective },
            { Type_of_Dates: "1st Qtr Return Due Date", Date: document.getElementById("first-qtr-return-due-date").value },
            { Type_of_Dates: "2nd Qtr Return Due Date", Date: document.getElementById("second-qtr-return-due-date").value },
            { Type_of_Dates: "3rd Qtr Return Due Date", Date: document.getElementById("third-qtr-return-due-date").value },
            { Type_of_Dates: "4th Qtr Return Due Date", Date: document.getElementById("forth-qtr-return-due-date").value }
        ],
        Application_Issuance_Date: issue
      }
    });
    
    await ZOHO.CRM.FUNCTIONS.execute("ta_vatr_complete_to_auth_update_account", {
      arguments: JSON.stringify({
        account_id, trn_number: trn, tax_period_vat: period, effective_reg_vat_dd: effective,
        vat_pay_giban: giban, st_qtr_vat_retrun_dd: document.getElementById("first-qtr-return-due-date").value,
        nd_qtr_vat_retrun_dd: document.getElementById("second-qtr-return-due-date").value,
        rd_qtr_vat_retrun_dd: document.getElementById("third-qtr-return-due-date").value,
        th_qtr_vat_retrun_dd: document.getElementById("forth-qtr-return-due-date").value
      })
    });
    
    // Final attachment step
    await ZOHO.CRM.API.attachFile({ 
      Entity: "Applications1", 
      RecordID: app_id, 
      File: { 
        Name: cachedFile.name, 
        Content: cachedBase64 
      } 
    });
    
    hideUploadBuffer();
    showModal("success", "Submission Successful", "The application has been updated. Click Ok to refresh.");
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Submit";
    hideUploadBuffer();
    showModal("error", "Failed", "Check connection and try again.");
  }
}

document.getElementById("record-form").addEventListener("submit", update_record);
document.getElementById("effective-date").addEventListener("change", setTaxPeriod);
document.getElementById("tax-period-vat").addEventListener("change", calculateDueDates);
ZOHO.embeddedApp.init();