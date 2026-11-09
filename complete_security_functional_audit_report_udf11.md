# Exhaustive Security, Authorization, AST & Functional Code Audit (`udf11` / `029f088`)

**Target Application:** Unique Delta Force HR & Workforce Management Portal (`udfonline.in`, `admin.udfonline.in`, `employee.udfonline.in`)  
**Audited Repository Archive:** `udf11-029f08824f06c78482b78f7655ffda6bf6520a47`  
**Audit Scope:** Single-pass static analysis, AST/declaration verification, security rules cross-check (`firestore.rules` [587 lines], `storage.rules` [47 lines]), serverless backend inspection (`functions/index.js` [6,594 lines, 50 exported functions]), `GOOGLE_APPS_SCRIPT_v7.2.js`, `AUTOMATED_FORM_CREATOR.js`, `App.tsx`, `src/services/*`, `src/contexts/*`, `components/*`, and `scripts/*`.

---

## 1. Status of Previous Audit Findings (`udf10` -> `udf11`)

6 out of the 7 issues from the `udf10` audit (`UDF10-01` through `UDF10-07`) and all earlier `UDF9-*` issues were resolved in `udf11` (`029f088`):

| Earlier Issue ID | Summary of Previous Issue | Status in `udf11` (`029f088`) |
| :--- | :--- | :--- |
| **`UDF10-01`** | Duplicate `const targetId = parts[1];` at line 2059 of `functions/index.js` crashing Cloud Functions deployment + `setAdminClaims` passing `profile` instead of `null`. | **FIXED** — Duplicate `const targetId` removed (`L2043` only) and `setAdminClaims` (`L3817`) now calls `computeAndApplyUserClaims(uid, resolvedDocId, null)`. |
| **`UDF10-02`** | 1. `user_engagement` rule used `!=` instead of `>` for `lastVisitDate` (allowing date-toggle point farming).<br>2. `completeTrainingQuizServer` didn't verify ownership of `targetUserId`. | **FIXED** — `firestore.rules:535` now enforces `request.resource.data.get('lastVisitDate', '') > resource.data.get('lastVisitDate', '')`, and `functions/index.js:5858–5867` verifies `targetUserId` belongs to `request.auth.uid`. |
| **`UDF10-03`** | `GOOGLE_APPS_SCRIPT_v7.2.js:46–47` still had `\|\| idToken === "server_admin"` hardcoded. | **NOT FIXED (Tracked as `UDF11-01`)** — Lines 46–47 of `GOOGLE_APPS_SCRIPT_v7.2.js` were not updated and still accept `"server_admin"`. |
| **`UDF10-04`** | Reverting an Approved Leave in `App.tsx` refunded `daysTaken` on the client *and* again in `processRequestReviewServer` (2x refund). | **FIXED** — Client-side refund removed from `handleRevertWorkflowRequest` (`App.tsx:1880`); only `handleDeleteWorkflowRequest` (`L1900`) performs a client refund before deleting. |
| **`UDF10-05`** | `referral_invites` `allow list` blocked `SITES_DELETE` (crashing site deletion) and ignored `INVITES_VIEW_ALL` / `INVITES_MANAGE`. | **FIXED** — Updated in both `firestore.rules:512–517` and `components/AdminInvitesPage.tsx:294`. |
| **`UDF10-06`** | `rejoinEmployeeServer` lacked a `sitesManaged` check, and 6 admin callables lacked `token.isDisabled === true` checks. | **FIXED** — `token.isDisabled === true` checks added to all 6 functions (`L4597, 5019, 5351, 5489, 6421, 6462`) and `sitesManaged` check added to `rejoinEmployeeServer` (`L5508–5517`). |
| **`UDF10-07`** | `BlogDashboardPage.tsx` quiz handler didn't pass `targetUserId` and had a broken client-side `setDoc` fallback in `catch`. | **FIXED** — `BlogDashboardPage.tsx:169` now passes `targetUserId: userId` and the broken `catch` write was removed. |

---

## 2. Summary of New Features & Architectural Enhancements Added

Across the `udf9` -> `udf11` updates, the following security and functional features were introduced:

1. **Server-Enforced Multi-Level Workflow Engine (`processRequestReviewServer` at `functions/index.js:4557`):**
   * Moves Leave, Account Update, and Resignation approvals, rejections, and reverts off the client and onto the server, enforcing role-based approval levels, site management scope (`sitesManaged`), atomic leave balance deductions/refunds, and immutable audit logging.
2. **Server-Enforced Lifecycle Callables (`approveOnboardingServer`, `relieveEmployeeServer`, `rejoinEmployeeServer` at `functions/index.js:4993–5745`):**
   * Centralizes candidate onboarding approval (with automatic Portal ID generation `UDF`/`HY` + birth year + last 4 digits), employee relieving, and employee rejoining (with selective storage folder copying and history preservation).
3. **Rate-Limited Draft Recovery with Automatic Session Adoption (`getDraftSubmissionSecure` at `functions/index.js:6514`):**
   * Replaces direct public Firestore reads on `/draft_submissions` with a rate-limited callable (mitigating brute-force attempts via `_auth_attempts`) that automatically updates `activeSessionUid: request.auth.uid` so a candidate recovering an application on a new phone or browser can seamlessly continue saving and uploading files.
4. **Server-Side Gamification & Safety Quiz Verification (`completeTrainingQuizServer` at `functions/index.js:5795` & `gamification_logs`):**
   * Validates daily quiz answers server-side, prevents multiple completions per day, awards points to both the employee's `portalId` and `uid` engagement documents, and writes to an immutable `gamification_logs` collection.
5. **HMAC-Secured Data Correction Challenge Flow (`getCorrectionChallenge`, `verifyCorrectionIdentity`, `submitCorrectionServer` at `functions/index.js:4030–4390`):**
   * Protects candidate and employee data correction links with server-verified identity challenges (last 4 digits of phone/Aadhaar + HMAC-SHA256 tokens) instead of exposing full records publicly.

---

## 3. Executive Summary of Remaining / New Findings in `udf11`

Our audit identified **8 actionable findings** across the `udf11` repository:

| ID | Severity | Category | Target File(s) | Exact Line Numbers | Summary of Finding |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **UDF11-01** | **HIGH** | **Security Vulnerability** | `GOOGLE_APPS_SCRIPT_v7.2.js`<br>`functions/index.js` | `L46–49`<br>`L5904, 6022, 6384` | **Hardcoded `"server_admin"` SuperAdmin Bypass Still Active:** `GOOGLE_APPS_SCRIPT_v7.2.js:46–47` still falls back to `"server_admin"` and explicitly checks `if (idToken === scriptSecret \|\| idToken === "server_admin")`, granting `isSuperAdmin: true` to any caller sending `"token": "server_admin"`. |
| **UDF11-02** | **HIGH** | **Security Vulnerability** | `functions/index.js` | `L2159–2280`<br>`L2281–2433`<br>`L2434–2520`<br>`L2981–3137` | **Missing `isDisabled` / `isActive` & Site-Scope Checks in Storage & Metrics Callables:**<br>1. `getSystemMetrics` (`L2981`) does not check `isDisabled === true` or `isActive === false` on token claims or Firestore fallback docs.<br>2. `moveStorageFolder` (`L2159`), `deleteStoragePath` (`L2281`), and `getStorageFolderSizeServer` (`L2434`) do not check `isDisabled`/`isActive` in their Firestore fallback lookups (`L2183, 2306, 2457`). |
| **UDF11-03** | **HIGH** | **Security Vulnerability** | `functions/index.js` | `L4609–4624`<br>`L5026–5041`<br>`L5358–5374`<br>`L6425–6436`<br>`L6466–6477` | **Missing `isDisabled` / `isActive` Check in Firestore Fallback Blocks of Admin Callables:** When custom claims are stale or empty, `processRequestReviewServer`, `approveOnboardingServer`, `relieveEmployeeServer`, `syncEmployeeToGoogleDriveServer`, and `syncSubmissionToSheetsServer` fall back to reading `staff_accounts`/`users`/`staff` from Firestore without checking `prof.isDisabled === true \|\| prof.isActive === false`. |
| **UDF11-04** | **MEDIUM** | **Broken Feature / Functional Bug** | `firestore.rules`<br>`components/AdminRecycleBinPage.tsx` | `L569–573` | **Recycle Bin Read/Restore Locked to `isSuperAdmin()` Only:** `firestore.rules:570` sets `allow read, update, delete: if isSuperAdmin();` on `/recycle_bin/{id}`, ignoring `hasPermission('EMPLOYEES_TAB_RECYCLE_BIN')`. Any non-SuperAdmin role granted Recycle Bin access fails with `Missing or insufficient permissions`. |
| **UDF11-05** | **MEDIUM** | **Broken Feature / Functional Bug** | `firestore.rules`<br>`src/services/employeeService.ts` | `L203–218` | **Google-Linked Employee Profile Self-Update Fails (`PERMISSION_DENIED`):** In `firestore.rules:204`, `allow update` on `/employees/{userId}` checks `(request.auth.uid == userId \|\| resource.data.get('uid', '') == request.auth.uid)`, omitting `resource.data.get('linkedUid', '') == request.auth.uid` and `isOwnerOfPortalId(userId)`. Employees logged in via Google Auth (`linkedUid`) cannot update their profile photo or complete their profile. |
| **UDF11-06** | **MEDIUM** | **Broken Feature / Functional Bug** | `firestore.rules` | `L416–418`<br>`L583` | **Portal ID vs. Auth UID Mismatch on `leave_balances` and `gamification_logs`:**<br>1. `leave_balances` (`L417`) checks `id == request.auth.uid \|\| resource.data.employeeId == request.auth.uid` without `isOwnerOfPortalId(id)`.<br>2. `gamification_logs` (`L583`) checks `resource.data.userId == request.auth.uid` without `isOwnerOfPortalId(resource.data.userId)`, even though `completeTrainingQuizServer` writes `targetDocId` (`portalId`). |
| **UDF11-07** | **MEDIUM** | **Security Vulnerability** | `functions/index.js` | `L3833–3868` | **`refreshAdminClaims` Missing Caller Authorization & Active-Staff Check:** Any authenticated user (including an anonymous session, regular employee, or disabled staff member) can invoke `refreshAdminClaims` to trigger repeated Firestore reads and `setCustomUserClaims` writes. |
| **UDF11-08** | **LOW** | **Security Vulnerability / Hygiene** | `GOOGLE_APPS_SCRIPT_v7.2.js` | `L73–87` | **Missing `isDisabled` Check in `verifyViaApi` Role Lookup:** `GOOGLE_APPS_SCRIPT_v7.2.js:75–85` checks `/users/{uid}` for `role-super-admin` without verifying `isDisabled !== true`. |

---

## 4. Detailed Breakdown & Remediation Diffs

### `UDF11-01` (HIGH — Security Vulnerability): Hardcoded `"server_admin"` SuperAdmin Bypass in `GOOGLE_APPS_SCRIPT_v7.2.js`

* **Target Files & Exact Lines:**
  * `GOOGLE_APPS_SCRIPT_v7.2.js` (`lines 45–49`)
  * `functions/index.js` (`lines 5904, 6022, 6384`)
* **Root Cause & Exact Code Trace:**
  In `GOOGLE_APPS_SCRIPT_v7.2.js` (`lines 45–49`):
  ```javascript
  // Allow server-side Cloud Function calls (server-to-server secure channel)
  const scriptSecret = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SERVER_SECRET') || "server_admin";
  if (idToken === scriptSecret || idToken === "server_admin") {
    return { isValid: true, uid: "cloud_function_server", isSuperAdmin: true };
  }
  ```
  Even if an administrator configures `APPS_SCRIPT_SERVER_SECRET` in Google Apps Script Properties, the condition `|| idToken === "server_admin"` evaluates to `true` unconditionally whenever the string `"server_admin"` is passed.
* **Real-World Impact:**
  Unauthorized callers with knowledge of the Apps Script Web App URL can pass `"token": "server_admin"` in a `POST` request and obtain `isSuperAdmin: true` access to the connected Google Drive folders and Google Sheets records.
* **Exact Copy-Paste `diff` Remediation Block:**
  ```diff
  --- a/GOOGLE_APPS_SCRIPT_v7.2.js
  +++ b/GOOGLE_APPS_SCRIPT_v7.2.js
  @@ -43,8 +43,8 @@
     }
     
     // Allow server-side Cloud Function calls (server-to-server secure channel)
  -  const scriptSecret = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SERVER_SECRET') || "server_admin";
  -  if (idToken === scriptSecret || idToken === "server_admin") {
  +  const scriptSecret = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SERVER_SECRET');
  +  if (scriptSecret && scriptSecret.length >= 32 && idToken === scriptSecret) {
       return { isValid: true, uid: "cloud_function_server", isSuperAdmin: true };
     }
  ```

---

### `UDF11-02` (HIGH — Security Vulnerability): Missing `isDisabled` Enforcement in Storage & System Metrics Callables

* **Target File & Exact Lines:** `functions/index.js` (`lines 2159–2520` and `2981–3137`)
* **Root Cause & Exact Code Trace:**
  1. **`getSystemMetrics` (`lines 2981–3019`):** Verifies `request.auth` and checks whether the caller is in `staff_accounts`, `users`, or `staff`, or has `token.isAdmin === true`, but **never checks `token.isDisabled === true` or `doc.data().isDisabled === true` / `isActive === false`**.
  2. **`moveStorageFolder` (`lines 2159–2220`), `deleteStoragePath` (`lines 2281–2335`), and `getStorageFolderSizeServer` (`lines 2434–2480`):**
     * In their Firestore fallback blocks (`lines 2183–2200`, `2306–2323`, `2457–2473`), they check `if (sDoc)` and read `sDoc.data().roleId`, but **do not check `sDoc.data().isDisabled !== true && sDoc.data().isActive !== false`**.
* **Real-World Impact:**
  Disabled staff can continue invoking `getSystemMetrics` or storage management callables via Firestore fallback before their session expires or after their custom claims are cleared.
* **Exact Copy-Paste `diff` Remediation Block:**
  ```diff
  --- a/functions/index.js
  +++ b/functions/index.js
  @@ -2185,7 +2185,7 @@
                   db.collection('users').doc(uid).get()
               ]);
               const sDoc = staffSnap.exists ? staffSnap : (userSnap.exists ? userSnap : null);
  -            if (sDoc) {
  +            if (sDoc && sDoc.data().isDisabled !== true && sDoc.data().isActive !== false) {
                   const roleId = sDoc.data().roleId;
                   if (roleId === 'role-super-admin' || roleId === 'super-admin') {
                       hasPerm = true;
  @@ -2308,7 +2308,7 @@
                   db.collection('users').doc(uid).get()
               ]);
               const sDoc = staffSnap.exists ? staffSnap : (userSnap.exists ? userSnap : null);
  -            if (sDoc) {
  +            if (sDoc && sDoc.data().isDisabled !== true && sDoc.data().isActive !== false) {
                   const roleId = sDoc.data().roleId;
                   if (roleId === 'role-super-admin' || roleId === 'super-admin') {
                       hasPerm = true;
  @@ -2459,7 +2459,7 @@
                   db.collection('users').doc(uid).get()
               ]);
               const sDoc = staffSnap.exists ? staffSnap : (userSnap.exists ? userSnap : null);
  -            if (sDoc) {
  +            if (sDoc && sDoc.data().isDisabled !== true && sDoc.data().isActive !== false) {
                   const roleId = sDoc.data().roleId;
                   if (roleId === 'role-super-admin' || roleId === 'super-admin') {
                       hasPerm = true;
  @@ -2986,6 +2986,9 @@
       const uid = request.auth.uid;
       const token = request.auth.token || {};
  +    if (token.isDisabled === true) {
  +        throw new functions.https.HttpsError('permission-denied', 'Account is disabled.');
  +    }
       let isAuthorized = token.isAdmin === true || token.isSuperAdmin === true;
   
       if (!isAuthorized) {
  @@ -2995,7 +2998,8 @@
               db.collection('staff').doc(uid).get()
           ]);
  -        isAuthorized = saSnap.exists || uSnap.exists || stSnap.exists;
  +        const docData = (saSnap.exists ? saSnap.data() : (uSnap.exists ? uSnap.data() : (stSnap.exists ? stSnap.data() : null)));
  +        isAuthorized = !!docData && docData.isDisabled !== true && docData.isActive !== false;
       }
  ```

---

### `UDF11-03` (HIGH — Security Vulnerability): Missing `isDisabled` / `isActive` Check in Firestore Fallback Blocks of 5 Core Admin Callables

* **Target File & Exact Lines:** `functions/index.js` (`lines 4609–4624, 5026–5041, 5358–5374, 6425–6436, 6466–6477`)
* **Root Cause & Exact Code Trace:**
  In `udf11`, `if (token.isDisabled === true)` was added at the top of `processRequestReviewServer` (`L4597`), `approveOnboardingServer` (`L5019`), `relieveEmployeeServer` (`L5351`), `syncEmployeeToGoogleDriveServer` (`L6421`), and `syncSubmissionToSheetsServer` (`L6462`).
  However, when a staff user's token does not have custom claims populated (`permissions.length === 0`), each of those 5 functions falls back to reading `staff_accounts/{uid}`, `users/{uid}`, or `staff/{uid}` from Firestore without checking `prof.isDisabled === true || prof.isActive === false`.
* **Real-World Impact:**
  If an admin account is disabled in Firestore (`isDisabled: true`) and their token lacks `isDisabled: true` (e.g., before token refresh or if claims were cleared to `{}`), calling any of these 5 functions enters the Firestore fallback block, reads their `staff_accounts/{uid}` doc, sees their `roleId`, and grants execution privileges despite `isDisabled: true` in Firestore.
* **Exact Copy-Paste `diff` Remediation Block:**
  ```diff
  --- a/functions/index.js
  +++ b/functions/index.js
  @@ -4615,6 +4615,9 @@
           ]);
           const prof = (saSnap.exists ? saSnap.data() : (uSnap.exists ? uSnap.data() : (stSnap.exists ? stSnap.data() : null))) || {};
  +        if (prof.isDisabled === true || prof.isActive === false) {
  +            throw new functions.https.HttpsError('permission-denied', 'Account is disabled or inactive.');
  +        }
           if (!callerName) callerName = prof.name || prof.displayName || request.auth.token.email || 'Admin';
  @@ -5028,6 +5031,9 @@
           const saSnap = await db.collection('staff_accounts').doc(uid).get();
  +        if (saSnap.exists && (saSnap.data().isDisabled === true || saSnap.data().isActive === false)) {
  +            throw new functions.https.HttpsError('permission-denied', 'Account is disabled or inactive.');
  +        }
           const roleId = saSnap.exists ? saSnap.data().roleId : null;
  @@ -5360,6 +5366,9 @@
           const saSnap = await db.collection('staff_accounts').doc(uid).get();
  +        if (saSnap.exists && (saSnap.data().isDisabled === true || saSnap.data().isActive === false)) {
  +            throw new functions.https.HttpsError('permission-denied', 'Account is disabled or inactive.');
  +        }
           const roleId = saSnap.exists ? saSnap.data().roleId : null;
  @@ -6432,6 +6441,9 @@
           const prof = (sSnap.exists ? sSnap.data() : (uSnap.exists ? uSnap.data() : null)) || {};
  +        if (prof.isDisabled === true || prof.isActive === false) {
  +            throw new functions.https.HttpsError('permission-denied', 'Account is disabled or inactive.');
  +        }
           if (prof.roleId === 'role-super-admin' || prof.type === 'Admin' || (Array.isArray(prof.roles) && prof.roles.includes('super-admin'))) {
  @@ -6473,6 +6485,9 @@
           const prof = (sSnap.exists ? sSnap.data() : (uSnap.exists ? uSnap.data() : null)) || {};
  +        if (prof.isDisabled === true || prof.isActive === false) {
  +            throw new functions.https.HttpsError('permission-denied', 'Account is disabled or inactive.');
  +        }
           if (prof.roleId === 'role-super-admin' || prof.type === 'Admin' || (Array.isArray(prof.roles) && prof.roles.includes('super-admin'))) {
  ```

---

### `UDF11-04` (MEDIUM — Broken Feature / Functional Bug): `EMPLOYEES_TAB_RECYCLE_BIN` Permission Blocked by `firestore.rules`

* **Target Files & Exact Lines:**
  * `firestore.rules` (`lines 569–573`)
  * `components/AdminRecycleBinPage.tsx` & `src/services/recycleBinService.ts`
* **Root Cause & Exact Code Trace:**
  In `firestore.rules` (`lines 569–573`):
  ```javascript
  match /recycle_bin/{id} {
    allow read, update, delete: if isSuperAdmin();
    // SEC-07: Non-superadmins cannot archive STAFF or ROLE documents to prevent Trojan privilege escalation
    allow create: if isSuperAdmin() || (isAdmin() && !request.resource.data.get('itemType', '').matches('(?i)(STAFF|ROLE)'));
  }
  ```
  Although the application defines `Permission.EMPLOYEES_TAB_RECYCLE_BIN` (`types.ts`) so delegated HR admins can view or restore soft-deleted employee/submission records, `firestore.rules:570` hardcodes `allow read, update, delete: if isSuperAdmin();`.
* **Real-World Impact:**
  Any non-SuperAdmin staff member granted `EMPLOYEES_TAB_RECYCLE_BIN` receives `FirebaseError: Missing or insufficient permissions` when opening the Recycle Bin tab or attempting to restore a soft-deleted record.
* **Exact Copy-Paste `diff` Remediation Block:**
  ```diff
  --- a/firestore.rules
  +++ b/firestore.rules
  @@ -567,7 +567,9 @@
       // ─── Central Recycle Bin (Soft Delete & Universal Undo Vault - Super Admin Only) ───────────
       match /recycle_bin/{id} {
  -      allow read, update, delete: if isSuperAdmin();
  +      allow read: if isSuperAdmin() || hasPermission('EMPLOYEES_TAB_RECYCLE_BIN');
  +      allow update, delete: if isSuperAdmin() || 
  +        (hasPermission('EMPLOYEES_TAB_RECYCLE_BIN') && !resource.data.get('itemType', '').matches('(?i)(STAFF|ROLE)'));
         // SEC-07: Non-superadmins cannot archive STAFF or ROLE documents to prevent Trojan privilege escalation
         allow create: if isSuperAdmin() || (isAdmin() && !request.resource.data.get('itemType', '').matches('(?i)(STAFF|ROLE)'));
       }
  ```

---

### `UDF11-05` (MEDIUM — Broken Feature / Functional Bug): Google-Linked Employee Profile Self-Update Fails (`PERMISSION_DENIED`)

* **Target File & Exact Lines:** `firestore.rules` (`lines 203–218`)
* **Root Cause & Exact Code Trace:**
  In `firestore.rules` (`lines 203–212`):
  ```javascript
  allow update: if canAdminManageEmployees() 
    || (isAuthenticated() && (request.auth.uid == userId || resource.data.get('uid', '') == request.auth.uid) && (
        (
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['profileStatus', 'lastUpdated', 'needsProfileCompletion', 'profilePhotoURL']) &&
          (request.resource.data.profileStatus == 'waiting_for_admin' || request.resource.data.profilePhotoURL != null)
        ) || (
          resource.data.get('needsProfileCompletion', false) == true &&
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['profileStatus', 'lastUpdated', 'needsProfileCompletion', 'profilePhotoURL', 'profileData', 'data'])
        )
    ))
  ```
  When an employee signs in via Google (`employeeGoogleLogin`) or links their Google account (`selfLinkGoogleAccount` / `linkEmployeeGoogleAccount`), their Firebase Auth UID is stored in `linkedUid` (while `userId` is their `portalId`, e.g., `HY123456`). Because line 204 only checks `request.auth.uid == userId || resource.data.get('uid', '') == request.auth.uid` instead of `isSelfEmployee(userId, resource.data)`, Firestore rejects their profile photo update or profile completion submission with `PERMISSION_DENIED`.
* **Real-World Impact:**
  Employees who sign in with Google cannot update their profile photo or submit required profile completion fields (`ProfileClaimPage.tsx` / `EmployeeDashboardPage.tsx`).
* **Exact Copy-Paste `diff` Remediation Block:**
  ```diff
  --- a/firestore.rules
  +++ b/firestore.rules
  @@ -201,7 +201,7 @@
         resource.data.get('linkedUid', '') == request.auth.uid
       ));
       allow update: if canAdminManageEmployees() 
  -      || (isAuthenticated() && (request.auth.uid == userId || resource.data.get('uid', '') == request.auth.uid) && (
  +      || (isSelfEmployee(userId, resource.data) && (
             (
               request.resource.data.diff(resource.data).affectedKeys().hasOnly(['profileStatus', 'lastUpdated', 'needsProfileCompletion', 'profilePhotoURL']) &&
               (request.resource.data.profileStatus == 'waiting_for_admin' || request.resource.data.profilePhotoURL != null)
  ```

---

### `UDF11-06` (MEDIUM — Broken Feature / Functional Bug): Portal ID vs. Auth UID Mismatch in `leave_balances` & `gamification_logs` Rules

* **Target File & Exact Lines:** `firestore.rules` (`lines 416–419` and `581–585`)
* **Root Cause & Exact Code Trace:**
  1. In `firestore.rules:417`:
     ```javascript
     match /leave_balances/{id} {
       allow read: if isAdmin() || (isAuthenticated() && (id == request.auth.uid || resource.data.employeeId == request.auth.uid));
     ```
     Employee leave balances are keyed by `employeeId` / `portalId` (e.g., `HY123456`), not `request.auth.uid`. Without `isOwnerOfPortalId(id)`, employees whose `auth.uid !== portalId` cannot read `/leave_balances/{portalId}`.
  2. In `firestore.rules:583`:
     ```javascript
     match /gamification_logs/{id} {
       allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
     ```
     In `functions/index.js:5889`, `completeTrainingQuizServer` writes `userId: targetDocId` (which is the employee's `portalId`) to `gamification_logs`. Consequently, an employee whose `request.auth.uid !== portalId` is denied read access to their own `gamification_logs`.
* **Real-World Impact:**
  Employees logged in via Google Auth or custom token where `uid !== portalId` cannot read documents from `leave_balances` or `gamification_logs`.
* **Exact Copy-Paste `diff` Remediation Block:**
  ```diff
  --- a/firestore.rules
  +++ b/firestore.rules
  @@ -414,7 +414,7 @@
   
       // ─── Leave Balances ──────────────────────────────────────────────────────
       match /leave_balances/{id} {
  -      allow read: if isAdmin() || (isAuthenticated() && (id == request.auth.uid || resource.data.employeeId == request.auth.uid));
  +      allow read: if isAdmin() || (isAuthenticated() && (id == request.auth.uid || resource.data.employeeId == request.auth.uid || isOwnerOfPortalId(id)));
         allow write: if isAdmin();
       }
  @@ -580,6 +580,6 @@
       // ─── Gamification Logs (Immutable Ledger - Server-Enforced) ──────────────
       match /gamification_logs/{id} {
  -      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isAdmin());
  +      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isOwnerOfPortalId(resource.data.userId) || isAdmin());
         allow create, update, delete: if false;
       }
  ```

---

### `UDF11-07` (MEDIUM — Security Vulnerability): `refreshAdminClaims` Allows Unprivileged Users to Trigger Claim Computation

* **Target File & Exact Lines:** `functions/index.js` (`lines 3833–3868`)
* **Root Cause & Exact Code Trace:**
  In `functions/index.js` (`lines 3833–3854`):
  ```javascript
  exports.refreshAdminClaims = secureOnCall(async (request) => {
      if (!request.auth) {
          throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated.');
      }
      const callerUid = request.auth.uid;
      const targetUid = (request.data && request.data.targetUid) || callerUid;
  ```
  If `targetUid === callerUid`, `refreshAdminClaims` runs `computeAndApplyUserClaims(callerUid)` for **any** authenticated user (including anonymous users), performing 3 Firestore reads and writing `{ isAdmin: false, isSuperAdmin: false }` to their Auth token. Furthermore, when `targetUid !== callerUid`, it checks `callerStaff.exists || callerUser.exists` (`L3848`) without checking `isDisabled === true`.
* **Real-World Impact:**
  Any staff member (including a disabled staff member) can force claim recomputations on other staff UIDs, and anonymous/employee users can invoke `refreshAdminClaims` repeatedly to consume Firebase Auth Admin SDK quotas.
* **Exact Copy-Paste `diff` Remediation Block:**
  ```diff
  --- a/functions/index.js
  +++ b/functions/index.js
  @@ -3835,19 +3835,18 @@
       if (!request.auth) {
           throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated.');
       }
  +    if (request.auth.token && request.auth.token.isDisabled === true) {
  +        throw new functions.https.HttpsError('permission-denied', 'Account is disabled.');
  +    }
   
       const callerUid = request.auth.uid;
       const targetUid = (request.data && request.data.targetUid) || callerUid;
   
  -    // If refreshing someone else's claims, verify caller is an admin
  -    if (targetUid !== callerUid) {
  -        const db = admin.firestore();
  -        const [callerStaff, callerUser] = await Promise.all([
  -            db.collection('staff_accounts').doc(callerUid).get(),
  -            db.collection('users').doc(callerUid).get()
  -        ]);
  -        if (!callerStaff.exists && !callerUser.exists) {
  -            throw new functions.https.HttpsError('permission-denied', 'Only admins can refresh other users\' claims.');
  -        }
  +    const db = admin.firestore();
  +    const [callerStaff, callerUser] = await Promise.all([
  +        db.collection('staff_accounts').doc(callerUid).get(),
  +        db.collection('users').doc(callerUid).get()
  +    ]);
  +    const callerDoc = callerStaff.exists ? callerStaff.data() : (callerUser.exists ? callerUser.data() : null);
  +    if (!callerDoc || callerDoc.isDisabled === true || callerDoc.isActive === false) {
  +        throw new functions.https.HttpsError('permission-denied', 'Only active staff can refresh admin claims.');
       }
  ```

---

### `UDF11-08` (LOW — Security Vulnerability / Hygiene): Legacy `/users/` Check in `GOOGLE_APPS_SCRIPT_v7.2.js:75` Missing `isDisabled` Verification

* **Target File & Exact Lines:** `GOOGLE_APPS_SCRIPT_v7.2.js` (`lines 73–87`)
* **Root Cause & Exact Code Trace:**
  In `verifyViaApi(idToken)` (`GOOGLE_APPS_SCRIPT_v7.2.js:75–85`), the script checks whether the caller is a SuperAdmin by fetching `/documents/users/${uid}` and checking `roleId === 'role-super-admin'`, without verifying that `isDisabled.booleanValue !== true`.
* **Real-World Impact:**
  A disabled user in `users` with `role-super-admin` would still be treated as `isSuperAdmin: true` by Apps Script until their 1-hour Firebase ID token expires.
* **Exact Copy-Paste `diff` Remediation Block:**
  ```diff
  --- a/GOOGLE_APPS_SCRIPT_v7.2.js
  +++ b/GOOGLE_APPS_SCRIPT_v7.2.js
  @@ -81,7 +81,8 @@
         if (firestoreResponse.getResponseCode() === 200) {
           var userDoc = JSON.parse(firestoreResponse.getContentText());
           var roleId = userDoc.fields && userDoc.fields.roleId && userDoc.fields.roleId.stringValue;
  -        isSuperAdmin = (roleId === 'role-super-admin');
  +        var isDisabled = userDoc.fields && userDoc.fields.isDisabled && userDoc.fields.isDisabled.booleanValue === true;
  +        isSuperAdmin = (!isDisabled && roleId === 'role-super-admin');
         }
       } catch (err) {}
  ```

---

## 5. Verified Secure / Working Matrix (`udf11` Baseline)

| Audit Domain | Verification Target | Status in `udf11` (`029f088`) |
| :--- | :--- | :--- |
| **Domain 1: Syntax & Build Integrity** | `functions/index.js` (`L2043–2060`) & all `.ts`/`.tsx` files | **VERIFIED CLEAN** — The duplicate `const targetId = parts[1];` at line 2059 from `udf10` has been removed; all 50 Cloud Function exports and TypeScript modules are free of duplicate block-scope declarations. |
| **Domain 2: End-to-End Functional Flows** | Firestore query vs. rule alignment (`employees`, `onboarding_submissions`, `leave_requests`, `account_updates`, `resignations`, `referral_invites`) | **VERIFIED WORKING** — `canStaffViewSite` includes all module `*_VIEW_SCOPE_ALL` permissions (`firestore.rules:43–54`), `allow list` permits `isAdmin()`, and `App.tsx` no longer overwrites `File` uploads with `uploadToDrive()` stubs or double-refunds reverted leaves (`App.tsx:1880`). |
| **Domain 3: Unauthenticated Access & Leaks** | `DataContext.tsx`, `NotificationContext.tsx`, `AuthContext.tsx`, public routes | **VERIFIED CLEAN** — Listeners wait for `authUser` before subscribing to protected collections; public queries only read `settings/*`, `vacancies`, and public `blog_posts`. |
| **Domain 4: Multi-Tenant & Site Isolation** | `getSecureDocumentURL`, `getBatchSignedViewUrls`, `getUploadUrl`, `processRequestReviewServer`, `approveOnboardingServer`, `relieveEmployeeServer`, `rejoinEmployeeServer` | **VERIFIED SECURE** — All 7 core operational and document-signing callables enforce `sitesManaged` isolation for non-SuperAdmin staff. |
| **Domain 6: DOM Injection, XSS & Clickjacking** | `AdminReviewSubmissionsPage.tsx` (`handlePrintBiodata`), `src/utils/sanitizeHtml.ts`, `BlogPage.tsx` | **VERIFIED SECURE** — `handlePrintBiodata` escapes all 32 interpolated candidate fields via `esc(...)`, and `sanitizeHtml.ts` strips `<script>`, event handlers (`on*`), and `javascript:`/`data:` URIs. |
| **Domain 7: Client Routing & WAF Proxy** | `src/firebase/config.ts`, `EmployeeLoginPage.tsx`, `AdminWebsiteManager.tsx`, `App.tsx` | **VERIFIED SECURE** — All frontend `httpsCallable` invocations use the `/api`-proxied `functions` instance from `src/firebase/config.ts`. |