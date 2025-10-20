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

    if (file.size > 10 * 1024 * 1024) {
        showError("vat-certificate", "File size must not exceed 10MB.");
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

// Helper function to add 3 months and set day to 28
function addThreeMonthsAndSetDay28(date) {
    const d = new Date(date);
    // Add 3 months
    d.setMonth(d.getMonth() + 3);
    // Set day to 28. This safely handles month/year rollovers
    d.setDate(28); 
    return d;
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
    const nextYear = effectiveYear + 1; 

    // Quarter end dates for the EFFECTIVE YEAR
    const quarterMappings = {
        "Q1: 1 Jan - 31 Mar, Q2: 1 Apr - 30 Jun, Q3: 1 Jul - 30 Sep, Q4: 1 Oct - 31 Dec": [
            { endMonth: 2, endDay: 31, isNextYear: false }, // Mar
            { endMonth: 5, endDay: 30, isNextYear: false }, // Jun
            { endMonth: 8, endDay: 30, isNextYear: false }, // Sep
            { endMonth: 11, endDay: 31, isNextYear: false } // Dec
        ],
        "Q1: 1 Feb - 30 Apr, Q2: 1 May - 31 Jul, Q3: 1 Aug - 31 Oct, Q4: 1 Nov - 31 Jan": [
            { endMonth: 3, endDay: 30, isNextYear: false }, // Apr
            { endMonth: 6, endDay: 31, isNextYear: false }, // Jul
            { endMonth: 9, endDay: 31, isNextYear: false }, // Oct
            { endMonth: 0, endDay: 31, isNextYear: true } // Jan (Rolls to next year)
        ],
        "Q1: 1 Mar - 31 May, Q2: 1 Jun - 31 Aug, Q3: 1 Sep - 30 Nov, Q4: 1 Dec - 28/29 Feb": [
            { endMonth: 4, endDay: 31, isNextYear: false }, // May
            { endMonth: 7, endDay: 31, isNextYear: false }, // Aug
            { endMonth: 10, endDay: 30, isNextYear: false },// Nov
            { endMonth: 1, endDay: 28, isNextYear: true } // Feb (Rolls to next year)
        ]
    };

    const quarters = quarterMappings[taxPeriodValue];

    // Determine the quarter INDEX (0, 1, 2, or 3) of the effective date
    const effectiveMonth = effectiveDate.getMonth();
    let effectiveQuarterIndex;
    
    if (taxPeriodValue.includes("Jan - 31 Mar")) {
        if (effectiveMonth >= 0 && effectiveMonth <= 2) effectiveQuarterIndex = 0; // Q1
        else if (effectiveMonth >= 3 && effectiveMonth <= 5) effectiveQuarterIndex = 1; // Q2
        else if (effectiveMonth >= 6 && effectiveMonth <= 8) effectiveQuarterIndex = 2; // Q3
        else effectiveQuarterIndex = 3; // Q4
    } else if (taxPeriodValue.includes("Feb - 30 Apr")) {
        if (effectiveMonth >= 1 && effectiveMonth <= 3) effectiveQuarterIndex = 0; // Q1
        else if (effectiveMonth >= 4 && effectiveMonth <= 6) effectiveQuarterIndex = 1; // Q2
        else if (effectiveMonth >= 7 && effectiveMonth <= 9) effectiveQuarterIndex = 2; // Q3
        else effectiveQuarterIndex = 3; // Q4
    } else {
        if (effectiveMonth >= 2 && effectiveMonth <= 4) effectiveQuarterIndex = 0; // Q1
        else if (effectiveMonth >= 5 && effectiveMonth <= 7) effectiveQuarterIndex = 1; // Q2
        else if (effectiveMonth >= 8 && effectiveMonth <= 10) effectiveQuarterIndex = 2; // Q3
        else effectiveQuarterIndex = 3; // Q4
    }

    if (effectiveQuarterIndex === undefined) {
        document.getElementById("first-qtr-return-due-date").value = "";
        document.getElementById("second-qtr-return-due-date").value = "";
        document.getElementById("third-qtr-return-due-date").value = "";
        document.getElementById("forth-qtr-return-due-date").value = "";
        return;
    }

    // 1. Calculate the FIRST chronological due date based on the effective quarter
    const firstQuarter = quarters[effectiveQuarterIndex];
    let yearToUse = effectiveYear;
    
    // Adjust year for the first due date calculation if the quarter ends in the next calendar year
    if (firstQuarter.isNextYear) {
        yearToUse = nextYear;
    }

    // Handle leap year for Feb 28/29
    if (firstQuarter.endMonth === 1 && firstQuarter.endDay === 28) { 
        if ((yearToUse % 4 === 0 && yearToUse % 100 !== 0) || yearToUse % 400 === 0) {
            firstQuarter.endDay = 29;
        }
    }
    
    // Base Date is Quarter End + 28 days
    let firstDueDate = new Date(yearToUse, firstQuarter.endMonth, firstQuarter.endDay);
    firstDueDate.setDate(firstDueDate.getDate() + 28);

    // 2. Generate the next four due dates in sequence
    let sequentialDueDates = [];
    sequentialDueDates.push(firstDueDate);
    sequentialDueDates.push(addThreeMonthsAndSetDay28(sequentialDueDates[0]));
    sequentialDueDates.push(addThreeMonthsAndSetDay28(sequentialDueDates[1]));
    sequentialDueDates.push(addThreeMonthsAndSetDay28(sequentialDueDates[2]));

    // 3. Assign the sequential dates to the correct QUARTER fields based on the effectiveQuarterIndex
    
    // effectiveQuarterIndex: 0=Q1, 1=Q2, 2=Q3, 3=Q4
    // Field Index Mapping: 0=1st Qtr DD, 1=2nd Qtr DD, 2=3rd Qtr DD, 3=4th Qtr DD
    
    let dueDatesForFields = [null, null, null, null];
    
    // Example: If effectiveQuarterIndex is 1 (Q2), the 1st calculated date (July 28)
    // must go into Field Index 1 (2nd Qtr Return Due Date).
    // The dates then cycle through the fields:
    // [0] -> Field 1 (2nd Qtr DD)
    // [1] -> Field 2 (3rd Qtr DD)
    // [2] -> Field 3 (4th Qtr DD)
    // [3] -> Field 0 (1st Qtr DD of next cycle)

    // Assign the dates to the field indices based on the cycle start
    for (let i = 0; i < 4; i++) {
        // Calculate the target field index, wrapping around after 3 (i.e., (1 + 0) % 4 = 1; (1 + 3) % 4 = 0)
        let fieldIndex = (effectiveQuarterIndex + i) % 4;
        dueDatesForFields[fieldIndex] = sequentialDueDates[i];
    }
    
    // 4. Populate the form fields
    document.getElementById("first-qtr-return-due-date").value = dueDatesForFields[0] ? formatDate(dueDatesForFields[0]) : "";
    document.getElementById("second-qtr-return-due-date").value = dueDatesForFields[1] ? formatDate(dueDatesForFields[1]) : "";
    document.getElementById("third-qtr-return-due-date").value = dueDatesForFields[2] ? formatDate(dueDatesForFields[2]) : "";
    document.getElementById("forth-qtr-return-due-date").value = dueDatesForFields[3] ? formatDate(dueDatesForFields[3]) : "";
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
    const payGiban = document.getElementById("pay-giban")?.value;

    // Validation checks for all required fields
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
    if (!firstQtrReturnDueDate) {
        showError("first-qtr-return-due-date", "1st Qtr Return Due Date is required.");
        hasError = true;
    }
    if (!secondQtrReturnDueDate) {
        showError("second-qtr-return-due-date", "2nd Qtr Return Due Date is required.");
        hasError = true;
    }
    if (!thirdQtrReturnDueDate) {
        showError("third-qtr-return-due-date", "3rd Qtr Return Due Date is required.");
        hasError = true;
    }
    if (!forthQtrReturnDueDate) {
        showError("forth-qtr-return-due-date", "4th Qtr Return Due Date is required.");
        hasError = true;
    }
    if (!cachedFile || !cachedBase64) {
        showError("vat-certificate", "Please upload the Corporate Tax Certificate.");
        hasError = true;
    }

    if (!payGiban) {
        showError("pay-giban", "Pay (GIBAN) is required.");
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

        if (firstQtrReturnDueDate) {
            subformData.push({ Type_of_Dates: "1st Qtr Return Due Date", Date: firstQtrReturnDueDate });
        }

        if (secondQtrReturnDueDate) {
            subformData.push({ Type_of_Dates: "2nd Qtr Return Due Date", Date: secondQtrReturnDueDate });
        }

        if (thirdQtrReturnDueDate) {
            subformData.push({ Type_of_Dates: "3rd Qtr Return Due Date", Date: thirdQtrReturnDueDate });
        }

        if (forthQtrReturnDueDate) {
            subformData.push({ Type_of_Dates: "4th Qtr Return Due Date", Date: forthQtrReturnDueDate });
        }

        await ZOHO.CRM.API.updateRecord({
            Entity: "Applications1",
            APIData: {
                id: app_id,
                Tax_Registration_Number_TRN: taxRegNo,
                Tax_Period_VAT: taxPeriodVat,
                Pay_GIBAN: payGiban,
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
                VAT_Pay_GIBAN: payGiban,
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