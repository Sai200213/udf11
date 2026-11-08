# UDF Portal — `udf10` (`b71a6c6`) Verification Audit & Remaining Patch Sheet (`UDF10-01` → `UDF10-07`)

**Target Application:** Unique Delta Force HR & Workforce Management Portal (`udfonline.in`, `admin.udfonline.in`, `employee.udfonline.in`)  
**Audited Repository:** `sai200213/udf10` (Commit `b71a6c60cd3aff4cd34a10e0e8e3d41659bc18dd`)  
**Previous Baseline:** `sai200213/udf9` (Commit `60c162eeca788f3a4c5f593a30f211d3a92fa803`)

---

## 1. Verification Scorecard — What Was Fixed in `udf10` (`b71a6c6`)

| Original ID | Area | Verification Status in `udf10` (`b71a6c6`) |
| :--- | :--- | :--- |
| **UDF9-01** | **Site Isolation vs. Firestore Query Rules (`firestore.rules`)** | **FIXED** — `firestore.rules` (`lines 47–49, 195–199, 229, 283, 313, 343`) now includes `LEAVES_VIEW_SCOPE_ALL`, `ACCOUNT_UPDATES_VIEW_SCOPE_ALL`, and `RESIGNATIONS_VIEW_SCOPE_ALL` in `canStaffViewSite`, enforces strict per-document site checks on `allow get`, and allows `isAdmin()` on `allow list` so compound/unfiltered queries no longer crash with `permission-denied`. |
| **UDF9-02** | **Gamification Streaks, Quiz & Reward Redemptions** | **PARTIALLY FIXED (`UDF10-02` & `UDF10-07` remain)** — `EmployeeEngagementHub.tsx:105–116` is fixed (`pointsEarned`, `targetUserId: userId`, and omitting `points`/`referralCount` on client `setDoc`), and `firestore.rules:526–533` permits reward deductions and streak increments. However, see `UDF10-02` (monotonic date check & `targetUserId` ownership check) and `UDF10-07` (`BlogDashboardPage.tsx`). |
| **UDF9-03** | **Request File Attachments (`App.tsx`)** | **FIXED** — All 4 stubbed `uploadToDrive()` intercept blocks were removed from `App.tsx`, allowing `requestService.ts` (`uploadFilesInObject`) to upload Leave, Resignation, Disciplinary, and Account Update attachments directly to Firebase Storage. |
| **UDF9-04** | **Stored DOM XSS in `AdminReviewSubmissionsPage.tsx` (`handlePrintBiodata`)** | **FIXED** — All 32 candidate text fields (`lines 625–668`) are now HTML-escaped via `esc(...)` before `printWindow.document.write(...)`. |
| **UDF9-05** | **Backend Cloud Functions Gaps (`functions/index.js`)** | **4 OF 5 FIXED, 1 CRITICAL SYNTAX ERROR INTRODUCED (`UDF10-01`)** — `getDraftSubmissionSecure` (`activeSessionUid`), `setStaffUserStatus`/`resetStaffUserPassword`/`getStorageFolderSizeServer` (`isDisabled`), `completeTrainingQuizServer` (`correctAnswer`), and `approveOnboardingServer` (UUID DOB fallback) are fixed. However, `getBatchSignedViewUrls` (`line 2059`) has a duplicate `const targetId = parts[1];` declaration that breaks `functions/index.js` compilation (`UDF10-01`). |
| **UDF9-06** | **Hardcoded Secrets, Destructive Scripts & 4-Char IDs** | **PARTIALLY FIXED (`UDF10-03` remains)** — `scripts/getEmpAndResetPass.js` and `scripts/test-drive-connection.js` were deleted, and `employeeService.ts:553` & `bulkImportUtils.ts:830` now use 8-char `crypto.getRandomValues` IDs. However, `GOOGLE_APPS_SCRIPT_v7.2.js:47` still contains `|| idToken === "server_admin"` (`UDF10-03`). |
| **UDF9-07** | **Direct `getFunctions()` WAF Proxy Bypass** | **FIXED** — Both `EmployeeLoginPage.tsx:62` and `AdminWebsiteManager.tsx:32` now import the `/api`-proxied `functions` instance from `../src/firebase/config`. |
| **UDF9-08** | **`CORRECTION_HMAC_SECRET` & `contact_messages` Blank Email** | **FIXED** — `firestore.rules:163` allows optional blank email on `contact_messages`, and `functions/.env.example` documents the required secrets. |

---

## 2. Executive Summary — All 7 Remaining / New Issues in `udf10` (`UDF10-01` → `UDF10-07`)

| ID | Severity | Category | Target File(s) & Exact Line Numbers | Summary of Issue & What Breaks |
| :--- | :--- | :--- | :--- | :--- |
| **UDF10-01** | **CRITICAL** | **Deployment Blocker (`SyntaxError` in Cloud Functions)** | `functions/index.js:2043, 2059, 3818` | **Duplicate `const targetId` Crashes All 43 Cloud Functions:** In `getBatchSignedViewUrls`, `const targetId = parts[1];` is declared at line `2043` and re-declared in the exact same block at line `2059`. Running `node --check functions/index.js` fails immediately with `SyntaxError: Identifier 'targetId' has already been declared`, blocking `firebase deploy --only functions`. Also, `setAdminClaims` (`L3818`) still passes `profile` as `explicitDoc` without preserving `userDoc` status. |
| **UDF10-02** | **HIGH** | **Security — Domain 1 & 3 (Gamification Point Farming & IDOR)** | `firestore.rules:529–531` & `functions/index.js:5835` | 1. **Date-Toggle Point Farming (`firestore.rules:529`):** Checking `lastVisitDate != resource.data.lastVisitDate` (instead of lexical `>`) lets a user toggle `lastVisitDate` back and forth (`"2026-01-01"` ↔ `"2026-01-02"`) in a loop to add `+5` points infinitely.<br>2. **`targetUserId` IDOR (`functions/index.js:5835`):** `completeTrainingQuizServer` writes to `user_engagement/{targetUserId}` without verifying that `targetUserId` belongs to `request.auth.uid`. |
| **UDF10-03** | **HIGH** | **Security — Domain 6 (Apps Script Hardcoded Token Fallback)** | `GOOGLE_APPS_SCRIPT_v7.2.js:46–47` & `functions/index.js:5889` | **`"server_admin"` Still Accepted Unconditionally:** Line 47 of `GOOGLE_APPS_SCRIPT_v7.2.js` checks `if (idToken === scriptSecret \|\| idToken === "server_admin")`. Even after configuring `APPS_SCRIPT_SERVER_SECRET`, any external attacker sending `"token": "server_admin"` still gets `isSuperAdmin: true`. |
| **UDF10-04** | **HIGH** | **Broken Feature / Logic Bug (Double Leave Balance Refund)** | `App.tsx:1889–1901` vs. `src/services/requestService.ts:274` & `functions/index.js:4726–4746` | **Reverting Approved Leave Refunds 2× Days:** `handleRevertWorkflowRequest` (`App.tsx:1896`) refunds `daysTaken` on the client **before** calling `revertWorkflowRequest()`, which calls `processRequestReviewServer` (`functions/index.js:4726–4746`) that refunds `daysTaken` a second time in its batch. |
| **UDF10-05** | **HIGH** | **Broken Feature + Domain 2 (`referral_invites` Query Lockout)** | `firestore.rules:512` vs. `components/AdminSiteManagementPage.tsx:453–458` & `components/AdminInvitesPage.tsx:293–297` | **Site Deletion Crash & `INVITES_VIEW_ALL` Lockout:** `firestore.rules:512` restricts `referral_invites` `allow list` to `isSuperAdmin() \|\| resource.data.createdBy == request.auth.uid`. Non-SuperAdmins with `SITES_DELETE` crash at `AdminSiteManagementPage.tsx:458` when deleting a site, and roles with `INVITES_VIEW_ALL` or `INVITES_MANAGE` are blocked at `AdminInvitesPage.tsx:294` & `firestore.rules:512`. |
| **UDF10-06** | **HIGH** | **Security — Domain 2 & 3 (Callable Site Isolation & `isDisabled` Checks)** | `functions/index.js:4596, 5015, 5334, 5469–5730` | 1. `rejoinEmployeeServer` (`L5469–5730`) has no `sitesManaged` check, allowing a single-site supervisor with `SUBMISSIONS_APPROVE` to rejoin employees across any site.<br>2. `processRequestReviewServer`, `approveOnboardingServer`, `relieveEmployeeServer`, `rejoinEmployeeServer`, `syncEmployeeToGoogleDriveServer`, and `syncSubmissionToSheetsServer` do not check `token.isDisabled === true`. |
| **UDF10-07** | **MEDIUM** | **Broken Feature (`BlogDashboardPage.tsx` Quiz Handler)** | `components/BlogDashboardPage.tsx:165–192` | `BlogDashboardPage.tsx:166` does not pass `targetUserId: userId` to `completeTrainingQuizServer` (so points go to `user_engagement/{uid}` instead of `user_engagement/{portalId}`), and its `catch` block (`L186–190`) writes modified `points` directly to `user_engagement`, which fails `firestore.rules:529` because `lastVisitDate` is unchanged. |

---

## 3. Exact Copy-Paste Remediation Diffs for `udf10` (`UDF10-01` → `UDF10-07`)

### `UDF10-01` (CRITICAL BLOCKER): Duplicate `const targetId` SyntaxError in `functions/index.js:2059` & `setAdminClaims` `userDoc` Fix

* **Target File & Lines:** `functions/index.js` (`lines 2041–2061` and `lines 3816–3822`)
* **Root Cause:**
  In `getBatchSignedViewUrls`, `const targetId = parts[1];` is declared at line `2043` and declared a second time at line `2059` in the same function scope:
  ```
  /functions/index.js:2059
              const targetId = parts[1];
                    ^
  SyntaxError: Identifier 'targetId' has already been declared
  ```
  Additionally, in `setAdminClaims` (`line 3818`), passing `profile` as the 3rd argument (`explicitDoc`) to `computeAndApplyUserClaims(uid, resolvedDocId, profile)` skips the `if (!doc)` block (`line 3694`) where `userDoc` is populated, leaving `userDoc = null` at line `3732`.
* **Exact Remediation Diff (`functions/index.js`):**
  ```diff
  --- a/functions/index.js
  +++ b/functions/index.js
  @@ -2055,8 +2055,6 @@
                   authCache.set(cacheKey, allowed);
                   return allowed;
               }
  -            const targetId = parts[1];
  -
               if (!root || !targetId) return false;
               const cacheKey = `${root}:${targetId}`;
               if (authCache.has(cacheKey)) return authCache.get(cacheKey);
  @@ -3815,7 +3813,7 @@
   
       try {
           const resolvedDocId = staffDocSnap.exists ? uid : (staffEmailSnap && !staffEmailSnap.empty ? staffEmailSnap.docs[0].id : uid);
  -        const res = await computeAndApplyUserClaims(uid, resolvedDocId, profile);
  +        const res = await computeAndApplyUserClaims(uid, resolvedDocId, null);
           if (!res.isAdmin) {
               throw new functions.https.HttpsError('permission-denied', 'Unauthorized to receive admin claims.');
           }
  ```

---

### `UDF10-02` (HIGH): `user_engagement` Date-Toggle Point Farming (`firestore.rules:529`) & `targetUserId` IDOR (`functions/index.js:5835`)

* **Target Files & Lines:**
  * `firestore.rules` (`lines 524–533`)
  * `functions/index.js` (`lines 5834–5854`)
* **Root Cause:**
  1. In `firestore.rules:529`, the rule checks `request.resource.data.get('lastVisitDate', '') != resource.data.get('lastVisitDate', '')`. Because ISO date strings (`YYYY-MM-DD`) sort lexicographically, using `!=` instead of `>` allows a user to alternate `lastVisitDate` between `"2026-01-01"` and `"2026-01-02"` in a browser loop to add `+5` points endlessly. Requiring `request.resource.data.get('lastVisitDate', '') > resource.data.get('lastVisitDate', '')` ensures `lastVisitDate` can only move forward.
  2. In `functions/index.js:5835`, `completeTrainingQuizServer` accepts `request.data.targetUserId` without verifying that `targetUserId` belongs to `request.auth.uid` (either `targetUserId === uid`, `targetUserId === request.auth.token?.employeeId`, or the `employees/{targetUserId}` doc has `uid === request.auth.uid` or `linkedUid === request.auth.uid`).
* **Exact Remediation Diffs:**
  1. **Update `firestore.rules` (`lines 524–533`):**
     ```diff
     --- a/firestore.rules
     +++ b/firestore.rules
     @@ -526,7 +526,8 @@
            !request.resource.data.diff(resource.data).affectedKeys().hasAny(['referralCount']) && (
              !request.resource.data.diff(resource.data).affectedKeys().hasAny(['points']) ||
              (request.resource.data.get('points', 0) >= 0 && request.resource.data.get('points', 0) <= resource.data.get('points', 0)) ||
     -        (request.resource.data.get('lastVisitDate', '') != resource.data.get('lastVisitDate', '') &&
     +        (request.resource.data.get('lastVisitDate', '') is string &&
     +         request.resource.data.get('lastVisitDate', '') > resource.data.get('lastVisitDate', '') &&
               request.resource.data.get('points', 0) >= 0 &&
               request.resource.data.get('points', 0) <= resource.data.get('points', 0) + 5)
            )
     ```
  2. **Update `functions/index.js` (`lines 5834–5854`):**
     ```diff
     --- a/functions/index.js
     +++ b/functions/index.js
     @@ -5832,7 +5832,19 @@
          }
      
          // 4. Atomically update user_engagement points and write to gamification_logs
     -    const targetDocId = (request.data && typeof request.data.targetUserId === 'string' && request.data.targetUserId) ? request.data.targetUserId : uid;
     +    let targetDocId = uid;
     +    const requestedId = (request.data && typeof request.data.targetUserId === 'string') ? request.data.targetUserId.trim() : '';
     +    if (requestedId && requestedId !== uid && !requestedId.includes('/')) {
     +        if (request.auth.token && request.auth.token.employeeId === requestedId) {
     +            targetDocId = requestedId;
     +        } else {
     +            const empCheck = await db.collection('employees').doc(requestedId).get();
     +            if (empCheck.exists && (empCheck.data().uid === uid || empCheck.data().linkedUid === uid)) {
     +                targetDocId = requestedId;
     +            }
     +        }
     +    }
          const engagementRef = db.collection('user_engagement').doc(targetDocId);
          const logRef = db.collection('gamification_logs').doc();
     ```

---

### `UDF10-03` (HIGH): Remove Hardcoded `"server_admin"` Acceptance in `GOOGLE_APPS_SCRIPT_v7.2.js:46–47`

* **Target Files & Lines:** `GOOGLE_APPS_SCRIPT_v7.2.js` (`lines 46–48`) and `functions/index.js` (`line 5889`)
* **Root Cause:**
  In `GOOGLE_APPS_SCRIPT_v7.2.js:46–47`:
  ```javascript
  const scriptSecret = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SERVER_SECRET') || "server_admin";
  if (idToken === scriptSecret || idToken === "server_admin") {
  ```
  Because `|| idToken === "server_admin"` is still present, setting `APPS_SCRIPT_SERVER_SECRET` does not disable `"server_admin"`.
* **Exact Remediation Diff (`GOOGLE_APPS_SCRIPT_v7.2.js`):**
  ```diff
  --- a/GOOGLE_APPS_SCRIPT_v7.2.js
  +++ b/GOOGLE_APPS_SCRIPT_v7.2.js
  @@ -43,8 +43,8 @@
     }
     
     // Allow server-side Cloud Function calls (server-to-server secure channel)
  -  const scriptSecret = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SERVER_SECRET') || "server_admin";
  -  if (idToken === scriptSecret || idToken === "server_admin") {
  +  const scriptSecret = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SERVER_SECRET');
  +  if (scriptSecret && idToken === scriptSecret) {
       return { isValid: true, uid: "cloud_function_server", isSuperAdmin: true };
     }
  ```

---

### `UDF10-04` (HIGH): Double Leave Balance Refund When Reverting an Approved Leave (`App.tsx:1889–1901`)

* **Target Files & Lines:** `App.tsx` (`lines 1889–1901` — `handleRevertWorkflowRequest`) vs. `functions/index.js` (`lines 4726–4746` — `processRequestReviewServer`)
* **Root Cause:**
  `handleRevertWorkflowRequest` in `App.tsx:1896` calls `await updateEmployeeLeaveBalance(req.employeeId, req.leaveType, -daysTaken)` on the client and then calls `await revertWorkflowRequest(...)` at line `1900`, which calls `processRequestReviewServer` (`action: 'REVERT'`). Inside `processRequestReviewServer` (`functions/index.js:4726–4746`), because `reqData.status === 'Approved'`, the server batch **also** increments `leaveBalance.${balanceKey}` by `+daysTaken` and writes an audit log entry.
* **Exact Remediation Diff (`App.tsx`):**
  ```diff
  --- a/App.tsx
  +++ b/App.tsx
  @@ -1885,18 +1885,8 @@
           'RESIGNATIONS': 'resignations'
         } as const;
   
  -      // Item 5: If reverting an already approved leave request, refund the deducted days
  -      if (moduleId === 'LEAVES') {
  -        const req = leaveRequests.find(r => r.id === requestId);
  -        if (req && req.status === RequestStatus.APPROVED) {
  -          const [sY, sM, sD] = req.startDate.split('-').map(Number);
  -          const [eY, eM, eD] = req.endDate.split('-').map(Number);
  -          const daysTaken = Math.round((Date.UTC(eY, eM - 1, eD) - Date.UTC(sY, sM - 1, sD)) / (1000 * 3600 * 24)) + 1;
  -          const { updateEmployeeLeaveBalance } = await import('./src/services/employeeService');
  -          await updateEmployeeLeaveBalance(req.employeeId, req.leaveType, -daysTaken);
  -        }
  -      }
  -
  +      // processRequestReviewServer (called inside revertWorkflowRequest) atomically
  +      // refunds leave balances and records the audit log entry when reverting an Approved leave.
         await revertWorkflowRequest(collMap[moduleId], requestId, level);
  -      logSystemAction('UPDATE', moduleId as any, `Reverted request ${requestId} to Level ${level}`);
         sendNotification(authUser?.id || 'admin', `${moduleId.replace('_', ' ')} request reverted to Level ${level}.`, 'success');
         refreshGlobalStats();
  ```

---

### `UDF10-05` (HIGH): Site Deletion Crash & `INVITES_VIEW_ALL` Lockout on `/referral_invites`

* **Target Files & Lines:**
  * `firestore.rules` (`line 512`)
  * `components/AdminSiteManagementPage.tsx` (`lines 453–458`)
  * `components/AdminInvitesPage.tsx` (`lines 293–297`)
* **Root Cause:**
  `firestore.rules:512` restricts `allow list:` on `/referral_invites/{id}` to `isSuperAdmin() || (isAuthenticated() && resource.data.createdBy == request.auth.uid)`. As a result:
  1. Non-SuperAdmin staff with `Permission.SITES_DELETE` crash with `Missing or insufficient permissions` at `AdminSiteManagementPage.tsx:458` when checking active referral invites before deleting a site.
  2. Staff granted `Permission.INVITES_VIEW_ALL` or `Permission.INVITES_MANAGE` are blocked by both `AdminInvitesPage.tsx:294` (`if (!isSuperAdmin)`) and `firestore.rules:512`.
* **Exact Remediation Diffs:**
  1. **Update `firestore.rules` (`line 512`):**
     ```diff
     --- a/firestore.rules
     +++ b/firestore.rules
     @@ -509,6 +509,11 @@
              )
            );
            allow delete: if isSuperAdmin();
     -      allow list: if isSuperAdmin() || (isAuthenticated() && resource.data.createdBy == request.auth.uid);
     +      allow list: if isSuperAdmin() ||
     +                     hasPermission('INVITES_VIEW_ALL') ||
     +                     hasPermission('INVITES_MANAGE') ||
     +                     hasPermission('SITES_DELETE') ||
     +                     hasPermission('MANAGE_SITES') ||
     +                     (isAuthenticated() && resource.data.createdBy == request.auth.uid);
          }
     ```
  2. **Update `components/AdminInvitesPage.tsx` (`lines 293–297`):**
     ```diff
     --- a/components/AdminInvitesPage.tsx
     +++ b/components/AdminInvitesPage.tsx
     @@ -291,7 +291,7 @@
          let qRef = query(collection(db, 'referral_invites'));
          
     -    // Non-superadmins only see their own referral links
     -    if (!isSuperAdmin) {
     +    // Staff without global invite visibility only see their own referral links
     +    if (!isSuperAdmin && !hasPermission(Permission.INVITES_VIEW_ALL) && !hasPermission(Permission.INVITES_MANAGE)) {
            const creatorUid = auth.currentUser?.uid || authUser.id;
            qRef = query(collection(db, 'referral_invites'), where('createdBy', '==', creatorUid));
          }
     ```

---

### `UDF10-06` (HIGH): Missing Site Check in `rejoinEmployeeServer` & Missing `isDisabled` Checks in 6 Admin Callables

* **Target File & Lines:** `functions/index.js` (`lines 4596, 5015, 5334, 5469–5730, 6388, 6426`)
* **Root Cause:**
  1. `rejoinEmployeeServer` (`lines 5469–5730`) verifies `SUBMISSIONS_APPROVE` (`line 5474`) but never verifies whether a non-SuperAdmin caller manages `resolvedSiteId` (`sitesManaged`), unlike `approveOnboardingServer` and `relieveEmployeeServer`.
  2. `processRequestReviewServer`, `approveOnboardingServer`, `relieveEmployeeServer`, `rejoinEmployeeServer`, `syncEmployeeToGoogleDriveServer`, and `syncSubmissionToSheetsServer` do not check `request.auth.token.isDisabled === true`.
* **Exact Remediation Diff (`functions/index.js`):**
  ```diff
  --- a/functions/index.js
  +++ b/functions/index.js
  @@ -4596,6 +4596,9 @@
       const db = admin.firestore();
       const uid = request.auth.uid;
       const token = request.auth.token || {};
  +    if (token.isDisabled === true) {
  +        throw new functions.https.HttpsError('permission-denied', 'Account is disabled.');
  +    }
       const isSuperAdmin = token.isSuperAdmin === true || token.roleId === 'super-admin';
  @@ -5015,6 +5018,9 @@
       const uid = request.auth.uid;
       const token = request.auth.token || {};
  +    if (token.isDisabled === true) {
  +        throw new functions.https.HttpsError('permission-denied', 'Account is disabled.');
  +    }
       const isSuperAdmin = token.isSuperAdmin === true || token.roleId === 'super-admin';
  @@ -5334,6 +5340,9 @@
       const uid = request.auth.uid;
       const token = request.auth.token || {};
  +    if (token.isDisabled === true) {
  +        throw new functions.https.HttpsError('permission-denied', 'Account is disabled.');
  +    }
       const isSuperAdmin = token.isSuperAdmin === true || token.roleId === 'super-admin';
  @@ -5469,6 +5478,9 @@
       const uid = request.auth.uid;
       const token = request.auth.token || {};
  +    if (token.isDisabled === true) {
  +        throw new functions.https.HttpsError('permission-denied', 'Account is disabled.');
  +    }
       const isSuperAdmin = token.isSuperAdmin === true || token.roleId === 'super-admin';
       const permissions = Array.isArray(token.permissions) ? token.permissions : [];
  @@ -5485,6 +5497,16 @@
       const origData = origEmpSnap.data();
   
       const resolvedSiteId = siteId || origData.currentSiteId || 'Unassigned';
  +    if (!isSuperAdmin && resolvedSiteId && resolvedSiteId !== 'Unassigned') {
  +        const hasGlobalScope = permissions.includes('EMPLOYEES_VIEW_SCOPE_ALL') ||
  +            permissions.includes('SUBMISSIONS_VIEW_SCOPE_ALL') ||
  +            permissions.includes('MANAGE_SITES') ||
  +            permissions.includes('MANAGE_ALL_SITES');
  +        const sitesManaged = Array.isArray(token.sitesManaged) ? token.sitesManaged : [];
  +        if (!hasGlobalScope && !sitesManaged.includes(resolvedSiteId)) {
  +            throw new functions.https.HttpsError('permission-denied', `You do not have management authority for site "${resolvedSiteId}".`);
  +        }
  +    }
       const resolvedSiteName = siteName || origData.siteName || 'N/A';
  ```

---

### `UDF10-07` (MEDIUM): Update `BlogDashboardPage.tsx` Quiz Handler to Pass `targetUserId` and Remove Direct `points` Write

* **Target File & Lines:** `components/BlogDashboardPage.tsx` (`lines 165–193`)
* **Root Cause:**
  1. `BlogDashboardPage.tsx:166` calls `completeTrainingQuizServer` without passing `targetUserId: userId`, so if an employee is logged in via Google Auth (`auth.currentUser.uid !== portalId`), `completeTrainingQuizServer` writes the quiz points to `user_engagement/{uid}` instead of `user_engagement/{portalId}`.
  2. Its `catch` block (`lines 180–192`) tries to write `points: newPoints` directly to `user_engagement/{userId}` without changing `lastVisitDate`, which is rejected by `firestore.rules:529` with `PERMISSION_DENIED`.
* **Exact Remediation Diff (`components/BlogDashboardPage.tsx`):**
  ```diff
  --- a/components/BlogDashboardPage.tsx
  +++ b/components/BlogDashboardPage.tsx
  @@ -166,6 +166,7 @@
                   const res = await completeQuizFn({
                       questionId: (quizQuestion as any).id || undefined,
                       selectedAnswer: quizAnswer,
  +                    targetUserId: userId,
                       quizDate: new Date().toISOString().split('T')[0]
                   });
                   if (res.data?.isCorrect) {
  @@ -177,17 +178,6 @@
                   console.warn("[completeTrainingQuizServer] Notice:", err);
                   if (err.code === 'functions/already-exists') {
                       setQuizAwarded(true);
  -                } else {
  -                    const addedPoints = gamificationRules.quizPoints;
  -                    const newPoints = points + addedPoints;
  -                    setPoints(newPoints);
  -                    setQuizAwarded(true);
  -                    try {
  -                        const docRef = doc(db, 'user_engagement', userId);
  -                        await setDoc(docRef, {
  -                            ...streak,
  -                            points: newPoints
  -                        }, { merge: true });
  -                    } catch {}
                   }
               }
           }
  ```
