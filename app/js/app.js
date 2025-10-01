let account_id, app_id;
let cachedFile = null;
let cachedBase64 = null;


ZOHO.embeddedApp.on("PageLoad", async (entity) => {
    try {
        const entity_id = entity.EntityId;

        const appResponse = await ZOHO.CRM.API.getRecord({
            Entity: "Applications1",
            approved: "both",
            RecordID: entity_id,
        });

        const applicationData = appResponse.data[0];
        app_id = applicationData.id;
        account_id = applicationData.Account_Name.id;

        ZOHO.CRM.UI.Resize({ height: "100%"}).then(function(data) {
            console.log("Resize result:", data);
        });

    } catch (error) {
        console.error("PageLoad error:", error);
    }
});


function clearErrors() {
    document.querySelectorAll(".error-message").forEach(span => {
        span.textContent = "";
    });
}


function showError(fieldId, message) {
    const errorSpan = document.getElementById(`error-${fieldId}`);
    if (errorSpan) errorSpan.textContent = message;
}


function showUploadBuffer() {
    const buffer = document.getElementById("upload-buffer");
    const bar = document.getElementById("upload-progress");
    if (buffer) buffer.classList.remove("hidden");
    if (bar) {
        bar.classList.remove("animate");
        void bar.offsetWidth;
        bar.classList.add("animate");
    }
}


function hideUploadBuffer() {
    const buffer = document.getElementById("upload-buffer");
    if (buffer) buffer.classList.add("hidden");
}


async function cacheFileOnChange(event) {
    clearErrors();

    const fileInput = event.target;
    const file = fileInput?.files[0];

    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
        showError("vat-certificate", "File size must not exceed 20MB.");
        return;
    }

    showUploadBuffer();

    try {
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });

        cachedFile = file;
        cachedBase64 = base64;

        await new Promise((res) => setTimeout(res, 3000));
        hideUploadBuffer();
    } catch (err) {
        console.error("Error caching file:", err);
        hideUploadBuffer();
        showError("vat-certificate", "Failed to read file.");
    }
}


async function uploadFileToCRM() {
    if (!cachedFile || !cachedBase64) {
        throw new Error("No cached file");
    }

    return await ZOHO.CRM.API.attachFile({
        Entity: "Applications1",
        RecordID: app_id,
        File: {
            Name: cachedFile.name,
            Content: cachedBase64,
        },
    });
}


function complete_trigger() {
    ZOHO.CRM.BLUEPRINT.proceed();
}

// Helper to format a Date object into YYYY-MM-DD string
function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}


function calculateDueDates() {
    const effectiveDateInput = document.getElementById("effective-date");
    const taxPeriodSelect = document.getElementById("tax-period-vat");

    if (!effectiveDateInput.value || !taxPeriodSelect.value) {
        document.getElementById("first-qtr-return-due-date").value = "";
        document.getElementById("second-qtr-return-due-date").value = "";
        document.getElementById("third-qtr-return-due-date").value = "";
        document.getElementById("forth-qtr-return-due-date").value = "";
        return;
    }

    const effectiveDate = new Date(effectiveDateInput.value);
    const taxPeriodValue = taxPeriodSelect.value;
    const effectiveYear = effectiveDate.getFullYear();

    const quarterMappings = {
        "Q1: 1 Jan - 31 Mar, Q2: 1 Apr - 30 Jun, Q3: 1 Jul - 30 Sep, Q4: 1 Oct - 31 Dec": [
            { endMonth: 2, endDay: 31 }, // Mar
            { endMonth: 5, endDay: 30 }, // Jun
            { endMonth: 8, endDay: 30 }, // Sep
            { endMonth: 11, endDay: 31 } // Dec
        ],
        "Q1: 1 Feb - 30 Apr, Q2: 1 May - 31 Jul, Q3: 1 Aug - 31 Oct, Q4: 1 Nov - 31 Jan": [
            { endMonth: 3, endDay: 30 }, // Apr
            { endMonth: 6, endDay: 31 }, // Jul
            { endMonth: 9, endDay: 31 }, // Oct
            { endMonth: 0, endDay: 31 } // Jan
        ],
        "Q1: 1 Mar - 31 May, Q2: 1 Jun - 31 Aug, Q3: 1 Sep - 30 Nov, Q4: 1 Dec - 28/29 Feb": [
            { endMonth: 4, endDay: 31 }, // May
            { endMonth: 7, endDay: 31 }, // Aug
            { endMonth: 10, endDay: 30 },// Nov
            { endMonth: 1, endDay: 28 } // Feb
        ]
    };

    const quarters = quarterMappings[taxPeriodValue];

    // Determine the quarter of the effective date
    const effectiveMonth = effectiveDate.getMonth();
    let effectiveQuarterIndex;
    
    if (taxPeriodValue.includes("Jan - 31 Mar")) {
        if (effectiveMonth >= 0 && effectiveMonth <= 2) effectiveQuarterIndex = 0;
        else if (effectiveMonth >= 3 && effectiveMonth <= 5) effectiveQuarterIndex = 1;
        else if (effectiveMonth >= 6 && effectiveMonth <= 8) effectiveQuarterIndex = 2;
        else effectiveQuarterIndex = 3;
    } else if (taxPeriodValue.includes("Feb - 30 Apr")) {
        if (effectiveMonth >= 1 && effectiveMonth <= 3) effectiveQuarterIndex = 0;
        else if (effectiveMonth >= 4 && effectiveMonth <= 6) effectiveQuarterIndex = 1;
        else if (effectiveMonth >= 7 && effectiveMonth <= 9) effectiveQuarterIndex = 2;
        else effectiveQuarterIndex = 3;
    } else {
        if (effectiveMonth >= 2 && effectiveMonth <= 4) effectiveQuarterIndex = 0;
        else if (effectiveMonth >= 5 && effectiveMonth <= 7) effectiveQuarterIndex = 1;
        else if (effectiveMonth >= 8 && effectiveMonth <= 10) effectiveQuarterIndex = 2;
        else effectiveQuarterIndex = 3;
    }

    if (effectiveQuarterIndex === undefined) {
      // Handle edge cases or invalid effective dates
        document.getElementById("first-qtr-return-due-date").value = "";
        document.getElementById("second-qtr-return-due-date").value = "";
        document.getElementById("third-qtr-return-due-date").value = "";
        document.getElementById("forth-qtr-return-due-date").value = "";
        return;
    }

    // Calculate all four due dates for the effective year
    const dueDatesByQuarter = quarters.map((q, index) => {
        let date = new Date(effectiveYear, q.endMonth, q.endDay);
        date.setDate(date.getDate() + 28);
        return date;
    });

    // Assign due dates to the form fields based on the specific mapping
    let finalDueDates = {};
    if (effectiveQuarterIndex === 0) {
        finalDueDates.first = dueDatesByQuarter[0];
        finalDueDates.second = dueDatesByQuarter[1];
        finalDueDates.third = dueDatesByQuarter[2];
        finalDueDates.fourth = dueDatesByQuarter[3];
    } else if (effectiveQuarterIndex === 1) {
        finalDueDates.first = dueDatesByQuarter[1];
        finalDueDates.second = dueDatesByQuarter[2];
        finalDueDates.third = dueDatesByQuarter[3];
        finalDueDates.fourth = new Date(dueDatesByQuarter[0].getFullYear() + 1, dueDatesByQuarter[0].getMonth(), dueDatesByQuarter[0].getDate());
    } else if (effectiveQuarterIndex === 2) {
        finalDueDates.first = new Date(dueDatesByQuarter[0].getFullYear() + 1, dueDatesByQuarter[0].getMonth(), dueDatesByQuarter[0].getDate());
        finalDueDates.second = new Date(dueDatesByQuarter[1].getFullYear() + 1, dueDatesByQuarter[1].getMonth(), dueDatesByQuarter[1].getDate());
        finalDueDates.third = dueDatesByQuarter[2];
        finalDueDates.fourth = dueDatesByQuarter[3];
    } else if (effectiveQuarterIndex === 3) {
        finalDueDates.first = new Date(dueDatesByQuarter[0].getFullYear() + 1, dueDatesByQuarter[0].getMonth(), dueDatesByQuarter[0].getDate());
        finalDueDates.second = new Date(dueDatesByQuarter[1].getFullYear() + 1, dueDatesByQuarter[1].getMonth(), dueDatesByQuarter[1].getDate());
        finalDueDates.third = new Date(dueDatesByQuarter[2].getFullYear() + 1, dueDatesByQuarter[2].getMonth(), dueDatesByQuarter[2].getDate());
        finalDueDates.fourth = dueDatesByQuarter[3];
    }

    document.getElementById("first-qtr-return-due-date").value = finalDueDates.first ? formatDate(finalDueDates.first) : "";
    document.getElementById("second-qtr-return-due-date").value = finalDueDates.second ? formatDate(finalDueDates.second) : "";
    document.getElementById("third-qtr-return-due-date").value = finalDueDates.third ? formatDate(finalDueDates.third) : "";
    document.getElementById("forth-qtr-return-due-date").value = finalDueDates.fourth ? formatDate(finalDueDates.fourth) : "";
}


// Existing setTaxPeriod function, updated to call calculateDueDates
function setTaxPeriod() {
    const effectiveDateInput = document.getElementById("effective-date");
    const taxPeriodSelect = document.getElementById("tax-period-vat");

    if (!effectiveDateInput || !taxPeriodSelect) return;

    const effectiveDate = new Date(effectiveDateInput.value);
    const effectiveMonth = effectiveDate.getMonth() + 1;

    taxPeriodSelect.value = "";

    const taxPeriods = {
        "Q1: 1 Jan - 31 Mar, Q2: 1 Apr - 30 Jun, Q3: 1 Jul - 30 Sep, Q4: 1 Oct - 31 Dec": [1, 4, 7, 10],
        "Q1: 1 Feb - 30 Apr, Q2: 1 May - 31 Jul, Q3: 1 Aug - 31 Oct, Q4: 1 Nov - 31 Jan": [2, 5, 8, 11],
        "Q1: 1 Mar - 31 May, Q2: 1 Jun - 31 Aug, Q3: 1 Sep - 30 Nov, Q4: 1 Dec - 28/29 Feb": [3, 6, 9, 12]
    };

    for (const [key, value] of Object.entries(taxPeriods)) {
        if (value.includes(effectiveMonth)) {
            taxPeriodSelect.value = key;
            break;
        }
    }
    calculateDueDates();
}


async function update_record(event = null) {
    if (event) event.preventDefault();

    clearErrors();

    let hasError = false;

    const submitBtn = document.getElementById("submit_button_id");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";
    }

    const effectiveDate = document.getElementById("effective-date")?.value;
    const dateOfIssue = document.getElementById("date-of-issue")?.value;
    const firstQtrReturnDueDate = document.getElementById("first-qtr-return-due-date")?.value;
    const secondQtrReturnDueDate = document.getElementById("second-qtr-return-due-date")?.value;
    const thirdQtrReturnDueDate = document.getElementById("third-qtr-return-due-date")?.value;
    const forthQtrReturnDueDate = document.getElementById("forth-qtr-return-due-date")?.value;
    const taxRegNo = document.getElementById("tax-registration-number")?.value;
    const taxPeriodVat = document.getElementById("tax-period-vat")?.value;

    if (!taxRegNo) {
        showError("tax-registration-number", "Tax Registration Number is required.");
        hasError = true;
    }

    if (!taxPeriodVat) {
        showError("tax-period-vat", "Tax Period is required.");
        hasError = true;
    }

    if (!effectiveDate) {
        showError("effective-date", "Effective Registration Date is required.");
        hasError = true;
    }

    if (!dateOfIssue) {
        showError("date-of-issue", "Date of Issue is required.");
        hasError = true;
    }

    //First
    if (!firstQtrReturnDueDate) {
        showError("first-qtr-return-due-date", "1st Qtr Return Due Date is required.");
        hasError = true;
    }
    //Second
    if (!secondQtrReturnDueDate) {
        showError("second-qtr-return-due-date", "2nd Qtr Return Due Date is required.");
        hasError = true;
    }

    //Third
    if (!thirdQtrReturnDueDate) {
        showError("third-qtr-return-due-date", "3rd Qtr Return Due Date is required.");
        hasError = true;
    }

    //Forth
    if (!forthQtrReturnDueDate) {
        showError("forth-qtr-return-due-date", "4th Qtr Return Due Date is required.");
        hasError = true;
    }

    if (!cachedFile || !cachedBase64) {
        showError("vat-certificate", "Please upload the Corporate Tax Certificate.");
        hasError = true;
    }

    if (hasError) {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit";
        }
        return;
    }

    try {
        const subformData = [];

        if (dateOfIssue) {
            subformData.push({ Type_of_Dates: "Date of Issue", Date: dateOfIssue });
        }

        if (effectiveDate) {
            subformData.push({ Type_of_Dates: "Effective Date of Registration", Date: effectiveDate });
        }

        //First
        if (firstQtrReturnDueDate) {
            subformData.push({ Type_of_Dates: "1st Qtr Return Due Date", Date: firstQtrReturnDueDate });
        }

        //Second
        if (secondQtrReturnDueDate) {
            subformData.push({ Type_of_Dates: "2nd Qtr Return Due Date", Date: secondQtrReturnDueDate });
        }

        //Third
        if (thirdQtrReturnDueDate) {
            subformData.push({ Type_of_Dates: "3rd Qtr Return Due Date", Date: thirdQtrReturnDueDate });
        }

        //Forth
        if (forthQtrReturnDueDate) {
            subformData.push({ Type_of_Dates: "4th Qtr Return Due Date", Date: forthQtrReturnDueDate });
        }

        await ZOHO.CRM.API.updateRecord({
            Entity: "Applications1",
            APIData: {
                id: app_id,
                Tax_Registration_Number_TRN: taxRegNo,
                Tax_Period_VAT: taxPeriodVat,
                Subform_2: subformData,
                Application_Issuance_Date: dateOfIssue
            }
        });

        await ZOHO.CRM.API.updateRecord({
            Entity: "Accounts",
            APIData: {
                id: account_id,
                TRN_Number:taxRegNo,
                VAT_Status: "Active",
                Tax_Period_VAT: taxPeriodVat,
                Effective_Registration_Date_VAT: effectiveDate,
                st_Qtr_VAT_return_DD: firstQtrReturnDueDate,
                nd_Qtr_VAT_return_DD: secondQtrReturnDueDate,
                rd_Qtr_VAT_return_DD: thirdQtrReturnDueDate,
                th_Qtr_VAT_return_DD: forthQtrReturnDueDate,
            }
        });

        await uploadFileToCRM();
        await ZOHO.CRM.BLUEPRINT.proceed();
        await ZOHO.CRM.UI.Popup.closeReload();

    } catch (error) {
        console.error("Error on final submit:", error);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit";
        }
    }
}

document.getElementById("vat-certificate").addEventListener("change", cacheFileOnChange);
document.getElementById("record-form").addEventListener("submit", update_record);
document.getElementById("effective-date").addEventListener("change", setTaxPeriod);
document.getElementById("tax-period-vat").addEventListener("change", calculateDueDates);


async function closeWidget() {
    await ZOHO.CRM.UI.Popup.closeReload().then(console.log);
}


// Initialize the embedded app
ZOHO.embeddedApp.init();