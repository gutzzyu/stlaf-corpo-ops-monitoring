# STLAF | Operations Management System
## Complete Step-by-Step User Manual & Scenario Guide

Welcome to the **STLAF Operations Management System** User Manual. This guide provides step-by-step operating instructions for every workflow scenario. Whether you are a **Field Officer** executing missions, or an **Administrator/Auditor** approving budgets and reconciling files, this manual outlines the exact paths you need to take.

---

## Table of Contents
* [Scenario 1: First-Time Login & Profile Onboarding](#scenario-1-first-time-login--profile-onboarding)
* [Scenario 2: Requesting an Operational Itinerary (With & Without Cash Advances)](#scenario-2-requesting-an-operational-itinerary-with--without-cash-advances)
* [Scenario 3: Field Operations (Executing Your Assignment)](#scenario-3-field-operations-executing-your-assignment)
* [Scenario 4: Submitting a Liquidation Report (Scenario A: Surplus Cash to Return)](#scenario-4-submitting-a-liquidation-report-scenario-a-surplus-cash-to-return)
* [Scenario 5: Submitting a Liquidation Report (Scenario B: Overspent - Requesting Reimbursement)](#scenario-5-submitting-a-liquidation-report-scenario-b-overspent---requesting-reimbursement)
* [Scenario 6: How to Address "Needs Revision" Returns](#scenario-6-how-to-address-needs-revision-returns)
* [Scenario 7: Reviewing the Registry & Exporting a Registry File to PDF](#scenario-7-reviewing-the-registry--exporting-a-registry-file-to-pdf)
* [Scenario 8: Admin Audit - Initial Itinerary Review & Authorization](#scenario-8-admin-audit---initial-itinerary-review--authorization)
* [Scenario 9: Admin Audit - Reconciling & Approving Liquidation Reports](#scenario-9-admin-audit---reconciling--approving-liquidation-reports)
* [Scenario 10: Admin Audit - System-Wide Financial Exports & Archives](#scenario-10-admin-audit---system-wide-financial-exports--archives)

---

## Scenario 1: First-Time Login & Profile Onboarding

**Objective:** Securely register your name, department, and operational target contacts into the system database to unlock itinerary creation.

### Step-by-Step Instructions:
1. **Access the Application:** Open the shared portal link in your web browser.
2. **Authenticate:** Click the high-visibility **"Sign In with Google"** button on the Login page. Authenticate using your authorized company Google account credentials.
3. **Automatic Redirect:** Since you are a new user with incomplete profile configurations, the system will automatically open the **"My Personnel Profile"** registration wizard.
4. **Input Profile Details:**
   * **Full Name:** Type your complete legal name (e.g. *Juan Dela Cruz*).
   * **Corporate Department:** Select your assigned corporate circle from the dropdown menu (e.g., *Litigation, accounting, IT, Admin, Marketing, HR, Corporate*).
   * **Active Contact Number:** Provide your 11-digit operational mobile number (e.g., *09171234567*).
5. **Secure Configuration:** Click **"Save Profile Changes"**.
6. **Result:** You will be redirected to the **Officer Workspace (User Dashboard)**. Look to the top header; you should see your corporate department and operational name displayed correctly.

---

## Scenario 2: Requesting an Operational Itinerary (With & Without Cash Advances)

**Objective:** File a digital travel request detailing your client target, location parameters, and estimated budget to secure approval and optional cash advances.

### Step-by-Step Instructions:
1. **Initiate Request:** From the **Officer Workspace**, click the green-accented button: **"+ New Operational Itinerary"**.
2. **Assign Client parameters:**
   * **Account Name:** Click the dropdown and select the target client from the database (e.g., *CITCO*, *DFNN*, *Waltermart Supermarkets, Inc.*).
   * **Company Name:** Input the registered division or specific branch name of your destination target.
   * **Contact Person:** Input the client point-of-person details (e.g., *Atty. Maria Santos*).
3. **Coordinate Destination Details:**
   * **Destination:** Enter the precise physical address or building name.
   * **Destination Type:** Choose either **"Within Metro Manila"** or **"Outside Metro Manila"** (this impacts accounting allocations).
4. **Establish Schedule & Narrative:**
   * **Scheduled Date:** Choose the target date of action on the calendar.
   * **Travel Purpose:** Provide a clear business description (e.g., *"Physical retrieval of corporate business permits at BIR RDO 43"*).
   * **Out-of-Pocket Estimate (PHP):** Enter your estimated incidental spending (e.g., *1500*).
5. **DETERMINE EXTRA BUDGET SCENARIOS:**
   * **Case A: No Cash Advance Required (Direct out-of-pocket travel)**
     * Leave the **Requested Cash Advance (PHP)** field set to `0` or empty.
     * Leave the **Purpose of Cash Advance** input field blank.
   * **Case B: Cash Advance Requested (Release of Petty Cash Funds)**
     * Input the required cash amount inside the **Requested Cash Advance (PHP)** box (e.g., *2500*).
     * Provide a clear breakdown inside the **Purpose of Cash Advance** area (e.g., *"Fuel allowance, BIR processing fees, and delivery courier charges"*).
6. **Finalize Submission:**
   * To complete later: Click **"Save as Draft"**. It will appear under your draft list on the dashboard.
   * To dispatch right away: Click the deep navy **"Submit Itinerary"** button.
7. **Result:** The request is queued. In your workspace, it will show as `Submitted` (Hourglass icon) waiting for Administrative authorization.

---

## Scenario 3: Field Operations (Executing Your Assignment)

**Objective:** Safely carry out your site visits and collect physical or digital documents for tax and corporate accounting compliance.

### Step-by-Step Instructions:
1. **Await Review:** Monitor your User Dashboard. Once an admin reviews and approves your submission, the entry status changes to **Ongoing** (marked by an *Ongoing Operation* badge).
2. **Travel to Destination:** Embark on your scheduled travel mission.
3. **ACQUIRE RECEIPTS - CRITICAL STEPS:**
   * For every purchase (fuel, meals, transport tolls, filing fees, courier rates), request an **Official Receipt (OR)** or **Sales Invoice**.
   * Make sure the receipt matches the corporate name (**CCT**).
   * Use your smartphone to take a clear, high-resolution photograph of each receipt immediately so it can be uploaded directly to the dashboard.
4. **Return Home:** Once your travel is complete, open your Officer Workspace to begin the final accounting step.

---

## Scenario 4: Submitting a Liquidation Report (Scenario A: Surplus Cash to Return)

**Objective:** Document exact spending when you spend LESS than the cash advance you historically received from the office.

### Step-by-Step Instructions:
1. **Access Liquidation Portal:** Locate the approved travel entry on your dashboard and click the **"Begin PCF Liquidation"** button.
2. **Add Official Receipts:**
   * At the **Receipt Ledger** block, click **"+ Add Receipt Item"** to spawn a entry line.
   * Select the exact **Date of Receipt** as written on the paper slip.
   * **Corporate Entity:** Select **CCT**.
   * **TIN Number:** Key in the merchant's 9 or 12-digit Tax Identification Number (e.g., *123-456-789-000*).
   * **Supplier & Address:** Enter the complete business name and address as written on the header.
   * **Tax Type:** Choose **VAT** (Value Added Tax) or **NON-VAT**:
     * If you choose *VAT*, the system automatically populates the separate *VAT-Exclusive Value* and *VAT Amount*. Ensure these math variables match your receipt lines.
   * **Invoice / OR ID:** Provide the printed receipt/invoice number.
   * **Billable:** Choose **Yes** or **No**. If Yes, choose the client from the secondary dropdown.
   * **Item Description & Total Cost:** Detail the specific purchase (e.g., *Gas station petrol*) and the exact monetary amount (e.g., *850*).
   * **File Upload:** Click **"Choose File"** or drag-and-drop the receipt snapshot into the line target.
3. **Log Unreceipted Minor Fares (Proof Slips):**
   * If you paid for minor transits where receipts are unavailable (e.g., *tricycle fares, local street parking*):
   * Scroll to the **Proof Slips (Non-Receipted Vouchers)** area and click **"+ Add Proof Slip"**.
   * Enter the exact amount (e.g., *150*), description, and explain clearly why a printed receipt is not accessible.
4. **Inspect Balance Output:**
   * Scroll to the bottom of the form and view the calculation panel:
     $$\text{Remaining Advance} = \text{Advance Received} - (\text{Approved Receipts} + \text{Proof Slips})$$
   * Under this surplus scenario, the remaining balance will show as a **Positive Balance** (colored yellow). Let's say you had a *2500* cash advance, and logged *1000* in total costs. You will have a **Positive Surplus of PHP 1,500** to return.
5. **Physical Resolution:**
   * Count the cash surplus and hand it physically to your Accountancy/Treasury custodian.
   * Check the required confirmation box: **"I have physically returned the surplus cash to Accounting"**.
6. **Submit:** Click **"Submit Liquidation Report"**.
7. **Result:** The entry transitions to `Submitted (Under Review)`.

---

## Scenario 5: Submitting a Liquidation Report (Scenario B: Overspent - Requesting Reimbursement)

**Objective:** Request reimbursement when your urgent operational expenses exceed the cash advance you had in hand.

### Step-by-Step Instructions:
1. **Access Liquidation Portal:** Click **"Begin PCF Liquidation"** on your active travel entry.
2. **Populate Expenses:**
   * Follow the steps in Scenario 4 to add all your **Official Receipts** and **Proof Slips**.
   * *Example:* If your approved Cash Advance was only *1,000*, but the actual taxi logs and unexpected court printing fees amounted to *1,800*, fill in all *1,800* worth of receipts/slips.
3. **Verify Reimbursement Balance:**
   * Scroll down to inspect the calculation table.
   * The calculation ledger will identify a **Negative Net Balance** of *PHP -800*.
   * Under this condition, the system automatically detects an overage. The cash return checkbox will be hidden, and a green indicator notice will read: **"Reimbursement of PHP 800.00 is due to you once approved"**.
4. **Claim Specific Incidental Items:**
   * If you have independent non-receipted out-of-pocket claims, click **"+ Add Reimbursement Claim"** to include explicit line-item notes with attachments explaining the overage.
5. **Submit Report:** Review all ledger lines, verify TIN values, and click **"Submit Liquidation Report"**.
6. **Result:** Filed securely. The system queues this for administrative validation.

---

## Scenario 6: How to Address "Needs Revision" Returns

**Objective:** Update, correct, or change specific entries rejected by the Admin Audit to restore approval workflows.

### Step-by-Step Instructions:
1. **Locate Flagged Records:** In your Officer Workspace, find an entry marked with a yellow **"Needs Revision"** status badge.
2. **Review Feedback Notes:**
   * Click **"View Details"** or **"Edit"**.
   * Look for the **"Administrative Audit History"** section at the bottom or the yellow feedback alerts containing notes left by the Admin Auditor (e.g., *"TIN value for supplier Petrol Inc. is illegible, please re-upload"*).
3. **Execute Edits:**
   * For itinerary updates: Edit text entries or adjust numeric estimates.
   * For liquidation updates: Modify the specific receipt row, re-upload the blurry attachment, or re-verify tax numbers.
4. **Resubmit:**
   * Scroll to the bottom and click **"Resubmit Report"** or **"Save & Submit Changes"**.
5. **Result:** The entry status returns immediately to `Submitted` or `Submitted (Under Review)` to be re-examined by the Admin.

---

## Scenario 7: Reviewing the Registry & Exporting a Registry File to PDF

**Objective:** Inspect a comprehensive, non-editable record of an itinerary/reimbursement transaction and export a printed PDF copy for your personal records or physical folders.

### Step-by-Step Instructions:
1. **Open Registry Document:** Scroll down to the completed or approved section of your Officer Workspace dashboard and click **"View Details"**.
2. **Inspect Final Layout:**
   * This view compiles absolute logs: Officer credentials, destination coordinates, detailed VAT distributions, uploads, internal validation trails, and signature lines.
3. **Execute Document Export:**
   * Look at the top toolbar menu of the Registry panel.
   * Click the prominent, elegant, deep-navy solid button: **"Export to PDF"**.
4. **Save File:** The application automatically converts the responsive web elements into a print-ready PDF layout download. Save or print this file.

---

## Scenario 8: Admin Audit - Initial Itinerary Review & Authorization

**Objective:** As an Administrator, inspect new incoming travel plans, review cash requests, and assign approval or change directives.

### Step-by-Step Instructions:
1. **Enter Administration Panel:** Click **"Admin Hub"** in your main navigation menu.
2. **Sort by Incoming Filings:** Under the main listings, click the filter pill marked **"Submitted"** or find requests with the yellow hourglass indicator.
3. **Open Request Details:** Click **"Review Request"** or **"View Details"** on the target queue item.
4. **Audit Information:**
   * Review departure dates, clients, destination addresses, and out-of-pocket expectations.
   * Check the requested **Cash Advance (PHP)**. Refer to active corporate policy guidelines matching that specific team department.
5. **Issue Decisiveness Controls:**
   * **Path A: Approve/Authorize**
     * Click the green **"Approve & Authorize"** button. This releases the travel schedule and marks the cash flow as approved.
   * **Path B: Request Revisions**
     * If the destination is vague, or if requested cash limits are unaligned:
     * Type clear directives in the admin comments box (e.g., *"Please attach a breakdown of estimated BIR processing charges before request authorization."*).
     * Click **"Request Revision"** to return it back to the officer's workbench.
   * **Path C: Reject Request**
     * If unauthorized as of date: provide audit comments and click **"Reject"**.

---

## Scenario 9: Admin Audit - Reconciling & Approving Liquidation Reports

**Objective:** Audit filed receipts, confirm cash returns, reconcile VAT exclusive numbers, and close ledger cards.

### Step-by-Step Instructions:
1. **Locate Filed Liquidations:** Open your **Admin Hub Dashboard** and click on the **"Submitted (Under Review)"** filter category.
2. **Initialize Audit Profile:** Open the target record.
3. **Perform Auditing Checkpoint Matrix:**
   * **Receipt Verification:** Check every row in the receipt layout. Hover or click on uploaded document links to view the snapshot of corporate billing.
   * **VAT Analysis:** Verify that items marked as VAT correctly denote the tax split.
   * **Validate Proof Slips:** Confirm that the explanations are sufficient and logical.
   * **Check Surplus Returns (Important!):** Verify whether the calculation resulted in a positive surplus returned to the office. If yes, check that the confirm flag (*"I have physically returned..."*) has been updated in the database notes.
4. **Choose Auditor Decision:**
   * **Path A: Reject & Request Revisions**
     * If tax lines, invoices, or descriptions are wrong or missing:
     * Write explicit instructions in the revision panel.
     * Click **"Send Back for Revision"**. This unlocks the officer's form and alerts them.
   * **Path B: Approve & Complete**
     * If the receipts balance correctly, and physical cash assets match:
     * Write your final accounting system notes (e.g., *"All receipt amounts matching. Physical surplus received."*).
     * Click **"Approve & Complete"**.
5. **Result:** The system commits the transaction to the database, setting its final status to `Completed` (Green checkmark). This locks the record from any future modifications.

---

## Scenario 10: Admin Audit - System-Wide Financial Exports & Archives

**Objective:** Export consolidated financial ledgers into Microsoft Excel formats for external bookkeeping or corporate audit systems.

### Step-by-Step Instructions:
1. **Access Administration Portal:** Click **"Admin Hub"** from the navigation bar.
2. **Locate Export Options:** Look at your top actions toolbar inside the Admin command center.
3. **Download Excel Workbook:**
   * Click **"Export Unified Logs"** or **"Export to Excel"**.
   * The server will compile your entire multidepartment database records (including TIN details, supplier invoices, corporate VAT lines, and reimbursement status) into a neat Excel file (`.xlsx`).
4. **Archive Records:** Store the file in your secure records system.

---
**STLAF Operations Management System**
*Secured operational workflows, financial transparency, and precise audit trails.*
