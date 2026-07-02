# STLAF | Operations Management System
**Developer Documentation & Architecture Guide**

This document serves as the primary technical reference for developers working on the STLAF Operations Management System. It covers system architecture, the state machine, database schemas, Role-Based Access Control (RBAC), and local development guidelines.

---

## 1. System Architecture & Tech Stack

The application is a Single Page Application (SPA) utilizing a serverless backend architecture. 

**Frontend Core:**
* **Framework:** React 18+ powered by Vite.
* **Language:** TypeScript (Strict Mode).
* **Styling:** Tailwind CSS with a mobile-first responsive design strategy.
* **UI Components:** Customized Shadcn/UI (Radix Primitives) for accessible, unstyled components.
* **Icons:** `lucide-react`.

**Backend & Infrastructure (Firebase):**
* **Authentication:** Firebase Auth (Google OAuth Provider).
* **Database:** Cloud Firestore (NoSQL Document Database).
* **Security:** Native Firestore Security Rules (`firestore.rules`).

**Utilities & Integrations:**
* **PDF Export:** Browser-side PDF generation for immutable registry logs.
* **Excel Export:** `xlsx` for transforming collection arrays into corporate financial workbooks.

---

## 2. Core State Machine (Workflow Engine)

The heart of the application is the `operational_entries` lifecycle. The system strictly enforces directional status transitions which are validated both on the client UI and within Firestore Security Rules.

### The Entry Lifecycle
```text
[ Draft ] 
   │ (User creates itinerary)
   ▼
[ Submitted ] 
   │ (Admin reviews itinerary)
   ├──► [ Rejected ] (Terminal)
   ├──► [ Needs Revision ] ──► [ Submitted ]
   ▼
[ Ongoing ] 
   │ (User is in the field, cash advance released)
   ▼
[ For Liquidation ] 
   │ (Field ops complete, user logs receipts & surplus/overage)
   ▼
[ Submitted (Under Review) ]
   │ (Admin audits the financial ledger)
   ├──► [ Needs Revision ] ──► [ Submitted (Under Review) ]
   ▼
[ Completed ] (Terminal)
```

**Financial Logic (Liquidation Phase):**
During liquidation, the system computes the net balance dynamically:
`Net Balance = Cash Advance - (Total Receipts + Proof Slips)`
* **Positive Balance:** User must return unspent cash to Treasury.
* **Negative Balance:** User is owed an out-of-pocket reimbursement.

---

## 3. Database Schema (Firestore)

The NoSQL database relies on four primary root collections:

### `users`
Stores personnel profiles and access control roles.
* `uid` (String, PK) - Firebase Auth UID.
* `email` (String) - Authenticated Google email.
* `displayName` (String) - Legal corporate name.
* `department` (String) - HR, IT, Admin, Litigation, etc.
* `contactNumber` (String) - Operational mobile number.
* `role` (String) - `"user"` | `"admin"`.
* `createdAt` (Timestamp).

### `operational_entries`
The master ledger for all travel and financial requests.
* `id` (String, PK).
* `userId` (String, FK to users).
* `status` (Enum String) - Bound to the state machine above.
* `destination`, `purpose`, `scheduleDate` (Strings).
* `requestedCashAdvance`, `outOfPocketExpense` (Numbers).
* `liquidationItems` (Array of Objects) - Itemized ORs, Tax computations (VAT/NON-VAT), TINs.
* `proofSlips` (Array of Objects) - Non-receipted expenses.
* `reimbursements` (Array of Objects) - Claims for overages.
* `adminNotes` (String) - Feedback loop for `Needs Revision` states.

### `clients`
Corporate account master list.
* `id` (String, PK).
* `name` (String).

### `deleted_system_clients`
Soft-delete/archival table for relational safety.

---

## 4. Security & Role-Based Access Control (RBAC)

Security is enforced at the database level via `firestore.rules`. 

**Admin Bootstrapping:**
To prevent system lockout, the application uses an email-based override combined with document-based roles. 
* The system checks `request.auth.token.email` against a designated root developer email (`andrewmanuel310@gmail.com`). 
* Once logged in, this root user can assign the `"admin"` role to other users via the Admin Dashboard.

**Data Isolation:**
* **Users:** Can only `read`, `update`, and `create` their own `operational_entries`.
* **Admins:** Can `read`, `update`, and `delete` ANY entry, and possess global `write` access to `users` and `clients`.
* The rules explicitly prevent users from changing their own `role` variable to escalate privileges.

---

## 5. Directory Structure

```text
├── src/
│   ├── components/      # Reusable UI elements (Shadcn, dialogs, cards)
│   ├── lib/             # Core utilities
│   │   ├── firebase.ts  # Firebase initialization & context wrappers
│   │   ├── utils.ts     # Tailwind merge utilities (`cn`)
│   │   ├── constants.ts # Dropdown matrix arrays, system constants
│   │   └── excelExport.ts # Workbook generation logic
│   ├── pages/           # Application views/routes
│   │   ├── AdminDashboard.tsx      # Triage, audits, user management
│   │   ├── UserDashboard.tsx       # Officer workspace
│   │   ├── OperationalForm.tsx     # Itinerary initialization
│   │   ├── LiquidationWorkflow.tsx # Receipt capture & balance math
│   │   ├── SummaryView.tsx         # Read-only PDF registry
│   │   └── LoginPage.tsx           # Authentication boundary
│   ├── types.ts         # Global TypeScript interfaces
│   ├── App.tsx          # Main React router & layout wrapper
│   └── main.tsx         # React DOM entry
├── firebase-applet-config.json # Injected Firebase project credentials
├── firestore.rules      # Immutable database security rules
└── package.json         # Dependencies and build scripts
```

---

## 6. Development & Setup

### Prerequisites
* Node.js (v18+)
* A Firebase Project configured with Authentication (Google) and Firestore.

### Environment Configuration
The application relies on `firebase-applet-config.json` injected at the root level. Ensure this file contains the standard Firebase config object (projectId, apiKey, authDomain, firestoreDatabaseId).

### Running Locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. The server will bind to `0.0.0.0:3000`. 

### Build & Deploy
1. Run the TypeScript compiler and Vite bundler:
   ```bash
   npm run build
   ```
2. Output is generated in the `/dist` directory, ready to be served statically or deployed to Firebase Hosting / Cloud Run.

---

## 7. Known Behaviors & Edge Cases

* **Client-Side Reset Script:** The `AdminDashboard.tsx` contains a temporary lifecycle hook (`runProdReset`) executed once for the root admin to clear mock data before production launch. This utilizes `localStorage` (`temp_db_reset_done_2026_q2`) to prevent repetitive purging.
* **TIN Calculation:** If an officer selects `VAT` on a receipt item, the frontend automatically extracts the `VAT Amount` (Total / 1.12 * 0.12) and `VAT Exclusive` base, displaying them directly in the UI for the Admin auditor.
* **Snapshot Limitations:** Uploaded receipt images currently rely on Base64 strings or external buckets. Ensure Firebase Storage rules are attached if scaling to heavy image binary uploads.
