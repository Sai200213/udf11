# UDF Portal — Complete `udf9` (`60c162e`) Audit Report, Broken Feature Fixes & Security Patch Sheet

**Target Application:** Unique Delta Force HR & Workforce Management Portal (`udfonline.in`, `admin.udfonline.in`, `employee.udfonline.in`)  
**Audited Repository:** `sai200213/udf9` (Commit `60c162eeca788f3a4c5f593a30f211d3a92fa803`)  
**Audit Coverage:** All 315 repository files / 153 active source files (`firestore.rules`, `storage.rules`, `firebase.json`, `vite.config.ts`, `functions/index.js` [6,499 lines / 43 exports], `src/services/*`, `src/contexts/*`, `components/*`, `App.tsx`, and `scripts/*`).

## 1. Executive Summary Matrix — All 8 Findings (`UDF9-01` → `UDF9-08`)

The `udf9` (`60c162e`) commit successfully implemented many of the `SEC-01` through `SEC-21` security defenses. However, our line-by-line AST and data-flow inspection uncovered **8 total issues**:
* **4 Broken User/Admin Features (`UDF9-01`, `UDF9-02`, `UDF9-03`, and `UDF9-05c` / `UDF9-08`)** caused by new security rules conflicting with existing frontend queries and state payloads.
* **4 Remaining Security & Architecture Gaps (`UDF9-04`, `UDF9-05a/b/d/e`, `UDF9-06`, and `UDF9-07`)**.

| ID | Severity | Category | Target File(s) & Exact Line Numbers | Summary of Issue & What Breaks |
| :--- | :--- | :--- | :--- | :--- |
| **UDF9-01** | **CRITICAL** | **Broken Feature + Domain 2 (Site Isolation)** | `firestore.rules:41–49, 193, 223, 271, 295, 319` vs. `src/services/requestService.ts:60, 108, 145` & `src/services/employeeService.ts:1146, 1313, 1397` | **Field Officer / Site Supervisor Admin Portal Lockout:** `udf9` added `canStaffViewSite(...)` to `allow list` / `allow read` in `firestore.rules`, but `requestService.ts` and `employeeService.ts` still run unfiltered queries (or filter on `assignedSiteIds` while the rule checks `currentSiteId`). Because Firestore rules are not filters, Firestore rejects all of these queries with `permission-denied` for non-SuperAdmin site supervisors (showing 0 records). |
| **UDF9-02** | **CRITICAL** | **Broken Feature + Domain 1/3 (Gamification)** | `firestore.rules:500–503` vs. `src/services/engagementService.ts:113, 415`, `components/employee/EmployeeEngagementHub.tsx:104–116`, `components/employee/AttendanceCalendar.tsx:136–142` | **Daily Streaks, Safety Quiz & Reward Redemptions Fail:** `firestore.rules:502` (`SEC-17`) blocks any client write to `/user_engagement/{id}` that modifies `points`. However, `updateOrCreateStreak` (`engagementService.ts:113`), `createRewardRedemption` (`line 415`), and `EmployeeEngagementHub.tsx` (`line 110` via `...streak`) still send modified `points` from the browser—causing Day 2+ streaks, quiz state updates, and **100% of reward redemptions** to fail with `PERMISSION_DENIED`. |
| **UDF9-03** | **HIGH** | **Broken Feature + Domain 3 (Storage Uploads)** | `App.tsx:1281–1286, 1316–1319, 1381–1388, 1444–1451` vs. `src/services/driveService.ts:10` & `src/services/requestService.ts:19–36` | **Silent Erasure of All Request File Attachments:** `App.tsx` intercepts `File` instances on Leave Requests, Resignations, Disciplinary Actions, and Account Updates, calls the stubbed `uploadToDrive()` function (which returns `''`), and overwrites the `File` with `''` **before** `requestService.ts` (`uploadFilesInObject`) can upload it to Firebase Storage. |
| **UDF9-04** | **HIGH** | **Security — Domain 4 (Stored DOM XSS)** | `components/AdminReviewSubmissionsPage.tsx:615–950` (`handlePrintBiodata`) | **Stored DOM XSS in Admin Portal Print View:** `handlePrintBiodata` opens a same-origin `about:blank` window (`window.open('', '_blank')`) and writes 30+ unescaped candidate fields (`${name}`, `${marks}`, `${presentAddress}`, `${experience}`) via `printWindow.document.write(...)`, allowing a malicious candidate to execute arbitrary JS inside `https://admin.udfonline.in`. |
| **UDF9-05** | **HIGH** | **Broken Feature + Domain 3 (Cloud Functions Auth & Draft Recovery)** | `functions/index.js:304, 344, 1998–2030, 2431, 3795, 5785, 6428–6498` & `src/services/employeeService.ts:123–145` | **5 Backend Function Gaps:**<br>1. **Draft Recovery Lockout (`L6428`):** `getDraftSubmissionSecure` does not update `activeSessionUid: request.auth.uid`, blocking recovered drafts on a new device from saving or uploading files.<br>2. **`getBatchSignedViewUrls` (`L1998–2030`):** Missing the `SEC-08` `sitesManaged` check.<br>3. **`setStaffUserStatus` (`L304`), `resetStaffUserPassword` (`L344`), `getStorageFolderSizeServer` (`L2431`):** Missing `isDisabled !== true` check (`SEC-14`).<br>4. **`completeTrainingQuizServer` (`L5785`):** Defaults `isCorrect` to `true` when `questionId` is omitted.<br>5. **`setAdminClaims` (`L3795`) & `approveOnboardingServer` (`L5193`):** Passing `profile` skips `userDoc` resolution; DOB loop lacks UUID date-range fallback. |
| **UDF9-06** | **HIGH** | **Security — Domain 6 & 7 (Secrets & Scripts)** | `GOOGLE_APPS_SCRIPT_v7.2.js:46–48`, `functions/index.js:5859, 5977, 6339`, `scripts/getEmpAndResetPass.js:10–30`, `scripts/test-drive-connection.js:1`, `employeeService.ts:553` | 1. Publicly committed `"server_admin"` token and `APPS_SCRIPT_FALLBACK_URL` grant `isSuperAdmin: true` on the Google Drive webhook.<br>2. `scripts/getEmpAndResetPass.js` overwrites the first production employee's password to `"password"` without confirmation.<br>3. `employeeService.ts:553` & `bulkImportUtils.ts:830` still use 4-char `Math.random()` IDs (`L-03`). |
| **UDF9-07** | **MEDIUM** | **Security — Domain 3/5 (WAF Proxy Bypass)** | `components/EmployeeLoginPage.tsx:66` & `components/AdminWebsiteManager.tsx:32` vs. `src/firebase/config.ts:56–62` | Both files call `getFunctions()` directly instead of importing the `/api`-proxied `functions` instance from `src/firebase/config.ts`, bypassing the `/api/*` Cloudflare WAF proxy. |
| **UDF9-08** | **MEDIUM** | **Broken Feature Risk + Config (`CORRECTION_HMAC_SECRET` & Contact Form)** | `functions/index.js:4153, 4236` & `firestore.rules:156–164` (`contact_messages`) | 1. `functions/index.js:4153, 4236` throws a fatal HTTP 500 error on all Data Correction links if `CORRECTION_HMAC_SECRET` is not set in `functions/.env`.<br>2. `firestore.rules:159` requires `email.size() >= 5` on `contact_messages`, rejecting Contact Us submissions if a visitor leaves Email blank and only enters a Phone Number. |

## 2. Detailed Root Causes, Impact & Exact Copy-Paste Code Diffs

### `UDF9-01` (CRITICAL): Field Officer / Site Supervisor Admin Portal Lockout ("Rules Are Not Filters")

* **Target Files & Lines:**
  * `firestore.rules` (`lines 41–49, 193, 223, 271, 295, 319`)
  * `src/services/requestService.ts` (`lines 60, 108, 145`)
  * `src/services/employeeService.ts` (`lines 1146–1151, 1313, 1397`)
* **Root Cause & Vulnerability Trace:**
  In `udf9`, `firestore.rules` added `canStaffViewSite(...)` to `allow list:` on `/employees` (`line 193`) and `/onboarding_submissions` (`line 223`), and to `allow read:` on `/leave_requests` (`line 271`), `/account_updates` (`line 295`), and `/resignations` (`line 319`).
  In Cloud Firestore, **security rules are not filters**—if a security rule requires `siteId` to be in `request.auth.token.sitesManaged`, any query that does not include a matching `where('siteId', 'in', ...)` filter is immediately rejected by Firestore with `FirebaseError: Missing or insufficient permissions`:
  1. `subscribeToLeaveRequests` (`requestService.ts:60`), `subscribeToAccountUpdates` (`line 108`), and `subscribeToResignationRequests` (`line 145`) execute `onSnapshot(collection(db, ...))` with **no `where('siteId', ...)` filter**.
  2. `getPaginatedSubmissions` (`employeeService.ts:1146–1151`) executes `query(collection(db, 'onboarding_submissions'), where('status', '==', status), orderBy('timestamp', 'desc'))` with **no `where('siteId', ...)` filter** (filtering sites in memory at lines `1179–1197`).
  3. `getPaginatedEmployees` (`employeeService.ts:1313`) filters using `where('assignedSiteIds', 'array-contains-any', allowedSiteIds.slice(0, 10))`, whereas `firestore.rules:193` checks `currentSiteId` / `siteId` (not `assignedSiteIds`), and `fallbackQ` at line `1397` has no site filter at all.
  4. `canStaffViewSite(siteId)` (`firestore.rules:41–49`) does not include `LEAVES_VIEW_SCOPE_ALL`, `ACCOUNT_UPDATES_VIEW_SCOPE_ALL`, or `RESIGNATIONS_VIEW_SCOPE_ALL`.
* **Exact Remediation Diff:**
  Update `firestore.rules` (`lines 41–49, 190–236, 268–325`) so `canStaffViewSite` includes module-level `*_VIEW_SCOPE_ALL` permissions, `allow get` / `allow update` / `allow delete` enforce strict site isolation per document, and `allow list` allows authenticated staff (`isAdmin()`) to run complex compound/search queries without triggering Firestore's query-rule mismatch error:
  ```diff
  --- a/firestore.rules
  +++ b/firestore.rules
  @@ -41,11 +41,15 @@
       // Site visibility — reads sitesManaged from token
       function canStaffViewSite(siteId) {
         return isSuperAdmin() ||
                hasPermission('EMPLOYEES_VIEW_SCOPE_ALL') ||
                hasPermission('SUBMISSIONS_VIEW_SCOPE_ALL') ||
  +             hasPermission('LEAVES_VIEW_SCOPE_ALL') ||
  +             hasPermission('ACCOUNT_UPDATES_VIEW_SCOPE_ALL') ||
  +             hasPermission('RESIGNATIONS_VIEW_SCOPE_ALL') ||
                hasPermission('MANAGE_SITES') ||
                hasPermission('MANAGE_ALL_SITES') ||
                (siteId != null && siteId != '' &&
                 request.auth.token.get('sitesManaged', []).hasAny([siteId]));
       }
  @@ -188,8 +192,10 @@
         allow get: if resource == null ||
                       hasActiveCorrectionToken(resource.data) ||
                       isSelfEmployee(userId, resource.data) || 
  -                    (isAdmin() && canStaffViewSite(resource.data.get('currentSiteId', resource.data.get('siteId', ''))));
  -      allow list: if (isAdmin() && canStaffViewSite(resource.data.get('currentSiteId', resource.data.get('siteId', '')))) || (isAuthenticated() && (
  +                    (isAdmin() && (
  +                      canStaffViewSite(resource.data.get('currentSiteId', resource.data.get('siteId', ''))) ||
  +                      resource.data.get('assignedSiteIds', []).hasAny(request.auth.token.get('sitesManaged', []))
  +                    ));
  +      allow list: if isAdmin() || (isAuthenticated() && (
           resource.data.get('uid', '') == request.auth.uid || 
           resource.data.get('linkedUid', '') == request.auth.uid
         ));
  @@ -220,7 +226,7 @@
                       hasActiveCorrectionToken(resource.data) ||
                       isSelfSubmission(resource.data) || 
                       (isAdmin() && canStaffViewSite(resource.data.get('siteId', '')));
  -      allow list: if (isAdmin() && canStaffViewSite(resource.data.get('siteId', ''))) || (isAuthenticated() && (
  +      allow list: if isAdmin() || (isAuthenticated() && (
           resource.data.get('linkedUid', '') == request.auth.uid ||
  @@ -268,7 +274,8 @@
       // ─── Leave Requests ──────────────────────────────────────────────────────
       match /leave_requests/{id} {
  -      allow read: if (isAdmin() && canStaffViewSite(resource.data.get('siteId', ''))) || 
  +      allow get: if (isAdmin() && (resource.data.get('siteId', '') == '' || canStaffViewSite(resource.data.get('siteId', '')))) ||
  +                    (isRegisteredUser() && (resource.data.employeeId == request.auth.uid || resource.data.get('uid', '') == request.auth.uid || isOwnerOfPortalId(resource.data.employeeId)));
  +      allow list: if isAdmin() || 
                        (isRegisteredUser() && (
                          resource.data.employeeId == request.auth.uid || 
                          resource.data.get('uid', '') == request.auth.uid ||
  @@ -292,7 +299,8 @@
       // ─── Account Update Requests ─────────────────────────────────────────────
       match /account_updates/{id} {
  -      allow read: if (isAdmin() && canStaffViewSite(resource.data.get('siteId', ''))) || 
  +      allow get: if (isAdmin() && (resource.data.get('siteId', '') == '' || canStaffViewSite(resource.data.get('siteId', '')))) ||
  +                    (isRegisteredUser() && (resource.data.employeeId == request.auth.uid || resource.data.get('uid', '') == request.auth.uid || isOwnerOfPortalId(resource.data.employeeId)));
  +      allow list: if isAdmin() || 
                        (isRegisteredUser() && (
  @@ -316,7 +324,8 @@
       // ─── Resignations ────────────────────────────────────────────────────────
       match /resignations/{id} {
  -      allow read: if (isAdmin() && canStaffViewSite(resource.data.get('siteId', ''))) || 
  +      allow get: if (isAdmin() && (resource.data.get('siteId', '') == '' || canStaffViewSite(resource.data.get('siteId', '')))) ||
  +                    (isRegisteredUser() && (resource.data.employeeId == request.auth.uid || resource.data.get('uid', '') == request.auth.uid || isOwnerOfPortalId(resource.data.employeeId)));
  +      allow list: if isAdmin() || 
                        (isRegisteredUser() && (
  ```
  And in `src/services/requestService.ts` (`lines 59, 107, 144`), add an optional `allowedSiteIds?: string[]` parameter so site-scoped staff query only their assigned sites (`where('siteId', 'in', chunk)`), matching `subscribeToSubmissions` in `employeeService.ts:2075–2088`.

### `UDF9-02` (CRITICAL): Complete Breakage of Daily Streaks, Safety Quiz Sync & Reward Redemptions (`SEC-17` Conflict)

* **Target Files & Lines:**
  * `firestore.rules` (`lines 500–503`)
  * `src/services/engagementService.ts` (`lines 56–124, 400–430`)
  * `components/employee/EmployeeEngagementHub.tsx` (`lines 102–118`)
  * `functions/index.js` (`lines 5740–5826`: `completeTrainingQuizServer`)
* **Root Cause & Vulnerability Trace:**
  1. `firestore.rules:502` blocks any client update to `/user_engagement/{id}` that modifies `points` (`!request.resource.data.diff(resource.data).affectedKeys().hasAny(['referralCount', 'points'])`).
  2. However, `updateOrCreateStreak` (`src/services/engagementService.ts:107–115`) increments `currentPoints += streakPoints` on the client and calls `await setDoc(docRef, updatedStreak, { merge: true })`. From Day 2 onward, Firestore rejects this write with `PERMISSION_DENIED` and the `catch` block (`line 116`) resets the user's displayed points to `0`.
  3. `createRewardRedemption` (`src/services/engagementService.ts:414–415`) deducts `pointsSpent` on the client (`const newPoints = currentPoints - pointsSpent; await setDoc(streakRef, { points: newPoints }, { merge: true });`). Firestore rejects this write with `PERMISSION_DENIED` 100% of the time, so **no employee can ever redeem a reward**.
  4. In `EmployeeEngagementHub.tsx` (`lines 104–116`):
     * Line 106 reads `res.data?.pointsAwarded`, whereas `completeTrainingQuizServer` (`functions/index.js:5824`) returns `pointsEarned` (`pointsAwarded` is `undefined`).
     * `completeTrainingQuizServer` (`functions/index.js:5796`) writes to `db.collection('user_engagement').doc(uid)` (using `request.auth.uid`), whereas `EmployeeEngagementHub.tsx:108` writes to `doc(db, 'user_engagement', userId)` (`user.portalId || user.employeeId || user.id`).
     * Line 110 spreads `...(streak)` (which still contains the old `points` value from before `completeTrainingQuizServer` ran) into `setDoc(docRef, updated, { merge: true })`, triggering `PERMISSION_DENIED` on `/user_engagement/{userId}`!
* **Exact Remediation Diff:**
  1. In `firestore.rules` (`lines 499–505`), allow `points` on `/user_engagement/{id}` to be decremented (for reward redemptions where `points >= 0 && points < resource.data.get('points', 0)`) or incremented by at most `+5` once per calendar day when `lastVisitDate != resource.data.get('lastVisitDate', '')`, while still blocking arbitrary point farming:
  ```diff
  --- a/firestore.rules
  +++ b/firestore.rules
  @@ -496,10 +496,17 @@
                       request.resource.data.get('points', 0) >= 0 &&
                       request.resource.data.get('points', 0) <= 50 && 
                       request.resource.data.get('referralCount', 0) == 0;
  -      // SEC-17: Points and referralCount can ONLY be mutated by Cloud Functions (Admin SDK) or SuperAdmin; clients cannot inflate points
  +      // SEC-17: Prevent arbitrary point farming while permitting legitimate reward deductions & 1x/day streak increments
         allow update: if isSuperAdmin() || (
           isAuthenticated() && (isOwnerOfPortalId(id) || isAdmin()) &&
  -        !request.resource.data.diff(resource.data).affectedKeys().hasAny(['referralCount', 'points'])
  +        !request.resource.data.diff(resource.data).affectedKeys().hasAny(['referralCount']) && (
  +          !request.resource.data.diff(resource.data).affectedKeys().hasAny(['points']) ||
  +          (request.resource.data.get('points', 0) >= 0 && request.resource.data.get('points', 0) <= resource.data.get('points', 0)) ||
  +          (request.resource.data.get('lastVisitDate', '') != resource.data.get('lastVisitDate', '') &&
  +           request.resource.data.get('points', 0) >= 0 &&
  +           request.resource.data.get('points', 0) <= resource.data.get('points', 0) + 5)
  +        )
         );
         allow delete: if isAdmin();
       }
  ```
  2. In `components/employee/EmployeeEngagementHub.tsx` (`lines 102–118`), read `pointsEarned`, pass `targetUserId: userId` to `completeTrainingQuizServer`, and strip `points` and `referralCount` before calling `setDoc`:
  ```diff
  --- a/components/employee/EmployeeEngagementHub.tsx
  +++ b/components/employee/EmployeeEngagementHub.tsx
  @@ -102,19 +102,20 @@
           try {
               // SEC-17: Route quiz completion and points strictly through secure server function
  -            const completeQuizFn = httpsCallable<{ selectedAnswer: string; questionId?: string }, { success: boolean; pointsAwarded?: number }>(functions, 'completeTrainingQuizServer');
  -            const res = await completeQuizFn({ selectedAnswer: quizAnswer, questionId: currentQuizObj?.id });
  -            const awarded = res.data?.pointsAwarded ?? (isCorrect ? awardedPoints : 0);
  +            const completeQuizFn = httpsCallable<{ selectedAnswer: string; questionId?: string; targetUserId?: string }, { success: boolean; pointsEarned?: number; isCorrect?: boolean }>(functions, 'completeTrainingQuizServer');
  +            const res = await completeQuizFn({ selectedAnswer: quizAnswer, questionId: currentQuizObj?.id, targetUserId: userId });
  +            const awarded = res.data?.pointsEarned ?? 0;
   
               const docRef = doc(db, 'user_engagement', userId);
  +            const { points: _omitPoints, referralCount: _omitRef, ...safeStreak } = (streak || { userId, userName, streakCount: 1, lastVisitDate: today }) as any;
               const updated = {
  -                ...(streak || { userId, userName, streakCount: 1, lastVisitDate: today }),
  +                ...safeStreak,
                   lastQuizDate: today,
                   lastQuizOption: quizAnswer,
                   lastQuizCorrect: isCorrect
               };
               await setDoc(docRef, updated, { merge: true });
               setStreak(prev => ({ ...(prev || {}), ...updated, points: ((prev as any)?.points || 0) + awarded } as any));
           } catch (err) {
  ```

### `UDF9-03` (HIGH): Silent Erasure of All File Attachments on Leave Requests, Resignations, Disciplinary Actions & Account Updates

* **Target Files & Lines:**
  * `App.tsx` (`lines 1281–1286, 1316–1319, 1381–1388, 1444–1451`)
  * `src/services/driveService.ts` (`line 10`)
  * `src/services/requestService.ts` (`lines 19–36`)
* **Root Cause & Vulnerability Trace:**
  Since `udf6`, `uploadToDrive()` in `src/services/driveService.ts:10` is a no-op stub that returns `''` (empty string), while `src/services/requestService.ts:19–36` (`uploadFilesInObject`) automatically uploads any `value instanceof File` to Firebase Storage via `uploadFile()`.
  However, in `App.tsx`:
  * `handleSubmitLeaveRequest` (`lines 1281–1286`)
  * `handleSubmitResignationRequest` (`lines 1316–1319`)
  * `handleAddDisciplinaryAction` (`lines 1381–1388`)
  * `handleSubmitAccountUpdateRequest` (`lines 1444–1451`)
  still call `await uploadToDrive(...)` on every `File` attachment and overwrite the `File` property with `''` **before** passing the object to `requestService.ts`. As a result, `requestService.ts` receives `''` instead of a `File` object and **never uploads the file to Firebase Storage**.
* **Exact Remediation Diff:**
  ```diff
  --- a/App.tsx
  +++ b/App.tsx
  @@ -1279,12 +1279,6 @@
       const processedData = { ...requestData };
       const userUniqueId = authUser.portalId || authUser.id;
  -    for (const [key, value] of Object.entries(requestData)) {
  -      if (value instanceof File) {
  -        const driveUrl = await uploadToDrive(value, authUser.name || userUniqueId, "Leave Proofs", userUniqueId);
  -        processedData[key] = driveUrl;
  -      }
  -    }
   
       const newRequest: LeaveRequest = {
  @@ -1314,9 +1308,5 @@
       const processedData = { ...requestData };
       const userUniqueId = authUser.portalId || authUser.id;
  -    if (requestData.document instanceof File) {
  -      const driveUrl = await uploadToDrive(requestData.document, authUser.name || userUniqueId, "Resignations", userUniqueId);
  -      processedData.document = driveUrl;
  -    }
   
       const reqSiteId = processedData.siteId || employeeData?.currentSiteId || '';
  @@ -1379,14 +1369,14 @@
     const handleAddDisciplinaryAction = useCallback(async (actionData: any) => {
       if (!authUser) return;
  -    let docUrl = undefined;
  -    if (actionData.document instanceof File) {
  -      try {
  -        docUrl = await uploadToDrive(actionData.document, actionData.employeeName, "Disciplinary Action", actionData.employeeId);
  -      } catch (error) { ... }
  -    }
  -    const { document, ...cleanActionData } = actionData;
       const newAction: DisciplinaryAction = {
  -      ...cleanActionData,
  +      ...actionData,
         id: uuidv4(),
         filedBy: authUser.name || 'Admin',
         filedByRoleId: authUser.roleId || 'super-admin',
  -      documentUrl: docUrl
       };
       await addDisciplinaryAction(newAction);
  @@ -1442,12 +1432,4 @@
       const processedData = { ...requestData };
       const userUniqueId = authUser.portalId || authUser.id;
  -    if (requestData.requestedValue instanceof File) {
  -      const driveUrl = await uploadToDrive(requestData.requestedValue, authUser.name || userUniqueId, "Profile Updates", userUniqueId);
  -      processedData.requestedValue = driveUrl;
  -    }
  -    if (requestData.supportingDocument instanceof File) {
  -      const driveUrl = await uploadToDrive(requestData.supportingDocument, authUser.name || userUniqueId, "Profile Updates", userUniqueId);
  -      processedData.supportingDocument = driveUrl;
  -    }
  ```

### `UDF9-04` (HIGH): Stored DOM XSS in Admin Portal via Candidate Biodata Print View

* **Target File & Lines:** `components/AdminReviewSubmissionsPage.tsx` (`lines 615–950`)
* **Root Cause & Vulnerability Trace:**
  `handlePrintBiodata` opens a child window (`const printWindow = window.open('', '_blank', 'width=800,height=1000');` at line 680), which inherits the `https://admin.udfonline.in` origin and Firebase Admin session, and writes raw HTML via `printWindow.document.write(\`...\`)` containing 30+ unescaped candidate fields (`${name}`, `${marks}`, `${presentAddress}`, `${permanentAddress}`, `${experience}`, `${recruitedByName}`).
* **Exact Remediation Diff:**
  Add an HTML escaper `esc(...)` at the top of `handlePrintBiodata` (`components/AdminReviewSubmissionsPage.tsx:615`) and wrap every `getFieldValue(...)` call and `recruitedByName`:
  ```diff
  --- a/components/AdminReviewSubmissionsPage.tsx
  +++ b/components/AdminReviewSubmissionsPage.tsx
  @@ -614,7 +614,14 @@
     const handlePrintBiodata = async () => {
       if (!selectedSubmissionForDetails) return;
       const sub = selectedSubmissionForDetails;
       setIsPrinting(true);
  +    const esc = (val: unknown): string =>
  +      String(val ?? '')
  +        .replace(/&/g, '&amp;')
  +        .replace(/</g, '&lt;')
  +        .replace(/>/g, '&gt;')
  +        .replace(/"/g, '&quot;')
  +        .replace(/'/g, '&#39;');
       try {
  -      const name = String(getFieldValue(sub, '7debf274-baee-4bac-a137-4b4b46719874', 'Full Name') || '');
  +      const name = esc(getFieldValue(sub, '7debf274-baee-4bac-a137-4b4b46719874', 'Full Name') || '');
  ```

### `UDF9-05` (HIGH): 5 Backend Function Fixes in `functions/index.js` (Draft Recovery Session Adoption, `getBatchSignedViewUrls` Site Scope, `isDisabled` Checks, Quiz Validation, & `setAdminClaims`)

* **Target File & Lines:** `functions/index.js` (`lines 304, 344, 1998–2030, 2431, 3795, 5193, 5785, 6428–6498`)
* **Exact Remediation Diff (`functions/index.js`):**
  ```diff
  --- a/functions/index.js
  +++ b/functions/index.js
  @@ -301,7 +301,7 @@
       if (!callerDoc.exists) {
           callerDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
       }
  -    if (!callerDoc.exists || callerDoc.data().roleId !== 'role-super-admin') {
  +    if (!callerDoc.exists || callerDoc.data().roleId !== 'role-super-admin' || callerDoc.data().isDisabled === true || callerDoc.data().isActive === false) {
           throw new functions.https.HttpsError('permission-denied', 'Only active SuperAdmins can manage staff status.');
       }
  @@ -341,7 +341,7 @@
       if (!callerDoc.exists) {
           callerDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
       }
  -    if (!callerDoc.exists || callerDoc.data().roleId !== 'role-super-admin') {
  +    if (!callerDoc.exists || callerDoc.data().roleId !== 'role-super-admin' || callerDoc.data().isDisabled === true || callerDoc.data().isActive === false) {
           throw new functions.https.HttpsError('permission-denied', 'Only active SuperAdmins can reset staff passwords.');
       }
  @@ -3791,8 +3791,7 @@
       }
   
       try {
  -        const resolvedDocId = staffDocSnap.exists ? uid : (staffEmailSnap && !staffEmailSnap.empty ? staffEmailSnap.docs[0].id : uid);
  -        const res = await computeAndApplyUserClaims(uid, resolvedDocId, profile);
  +        const res = await computeAndApplyUserClaims(uid);
           if (!res.isAdmin) {
               throw new functions.https.HttpsError('permission-denied', 'Unauthorized to receive admin claims.');
           }
  @@ -5191,6 +5190,16 @@
                   }
               }
           }
  +        if (year === '123') {
  +            for (const [key, val] of Object.entries(dataObj)) {
  +                if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
  +                    const y = parseInt(val.split('-')[0], 10);
  +                    if (y > 1950 && y < 2010) {
  +                        year = val.split('-')[0];
  +                        break;
  +                    }
  +                }
  +            }
  +        }
           const phoneOrAadhaar = request.data.phoneNumber || subData.phoneNumber || request.data.aadhaarNumber || subData.aadhaarNumber || '';
  @@ -5782,7 +5791,10 @@
       if (!correctAnswer && rulesData.dailyQuiz && rulesData.dailyQuiz.correctAnswer) {
           correctAnswer = rulesData.dailyQuiz.correctAnswer;
       }
   
  -    const isCorrect = correctAnswer ? (selectedAnswer === correctAnswer) : true;
  +    if (!correctAnswer) {
  +        throw new functions.https.HttpsError('failed-precondition', 'Quiz question or correct answer not found.');
  +    }
  +    const isCorrect = (selectedAnswer === correctAnswer);
  @@ -6492,6 +6504,14 @@
       if (blockSnap.exists && blockSnap.data().failedAttempts > 0) {
           await blockRef.delete().catch(() => {});
       }
   
  -    return { id: docSnap.id, data: docSnap.data() };
  +    const draftData = docSnap.data() || {};
  +    if (request.auth && request.auth.uid && !draftData.isGoogleDraft && draftData.ownerUid !== request.auth.uid) {
  +        await docSnap.ref.update({
  +            activeSessionUid: request.auth.uid,
  +            lastUpdated: new Date().toISOString()
  +        }).catch(() => {});
  +        draftData.activeSessionUid = request.auth.uid;
  +    }
  +    return { id: docSnap.id, data: draftData };
   });
  ```
  *(Also apply the same `isSuperAdminCaller` / `sitesManaged` check from `getSecureDocumentURL` lines `1767–1797` inside `getBatchSignedViewUrls` at line `2029`).*

### `UDF9-06` (HIGH): Hardcoded `"server_admin"` Webhook Secret, Unguarded `scripts/getEmpAndResetPass.js`, & 4-Char Draft IDs

* **Target Files & Lines:**
  * `GOOGLE_APPS_SCRIPT_v7.2.js` (`lines 46–48`) & `functions/index.js` (`lines 5859, 5977, 6339`)
  * `scripts/getEmpAndResetPass.js` (`lines 10–30`) & `scripts/test-drive-connection.js` (`line 1`)
  * `src/services/employeeService.ts` (`line 553`) & `src/utils/bulkImportUtils.ts` (`line 830`)
* **Exact Remediations:**
  1. **Delete `scripts/getEmpAndResetPass.js` and `scripts/test-drive-connection.js`** from the repository.
  2. **Move `"server_admin"` and `APPS_SCRIPT_FALLBACK_URL` to Environment Secrets:**
     In `functions/index.js:5859`, use `const APPS_SCRIPT_SERVER_SECRET = process.env.APPS_SCRIPT_SERVER_SECRET || '';` (stored in `functions/.env`), and in `GOOGLE_APPS_SCRIPT_v7.2.js:46`, verify against `PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SERVER_SECRET')`.
  3. **Upgrade 4-Character Draft/Submission IDs (`src/services/employeeService.ts:553`, `src/utils/bulkImportUtils.ts:830`):**
     ```diff
     --- a/src/services/employeeService.ts
     +++ b/src/services/employeeService.ts
     @@ -550,7 +550,9 @@
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
     -    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
     +    const randBuf = new Uint32Array(2);
     +    crypto.getRandomValues(randBuf);
     +    const randomStr = (randBuf[0].toString(36) + randBuf[1].toString(36)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
          return `UDF-${year}${month}-${randomStr}`;
     ```

### `UDF9-07` (MEDIUM): Direct `getFunctions()` Calls Bypassing `/api` Cloudflare WAF Proxy

* **Target Files & Lines:** `components/EmployeeLoginPage.tsx` (`line 66`) and `components/AdminWebsiteManager.tsx` (`line 32`)
* **Exact Remediation Diff:**
  ```diff
  --- a/components/EmployeeLoginPage.tsx
  +++ b/components/EmployeeLoginPage.tsx
  @@ -61,7 +61,7 @@
         try {
  -        const { getFunctions, httpsCallable } = await import('firebase/functions');
  +        const { httpsCallable } = await import('firebase/functions');
  +        const { functions } = await import('../src/firebase/config');
           await ensureAuthenticated();
  -        const functions = getFunctions();
           const employeeLoginFn = httpsCallable(functions, 'employeeLogin');
  ```
  ```diff
  --- a/components/AdminWebsiteManager.tsx
  +++ b/components/AdminWebsiteManager.tsx
  @@ -30,7 +30,8 @@
           setLoadingMetrics(true);
           try {
  -            const { getFunctions, httpsCallable } = await import('firebase/functions');
  -            const getSystemMetrics = httpsCallable(getFunctions(), 'getSystemMetrics');
  +            const { httpsCallable } = await import('firebase/functions');
  +            const { functions } = await import('../src/firebase/config');
  +            const getSystemMetrics = httpsCallable(functions, 'getSystemMetrics');
  ```

### `UDF9-08` (MEDIUM): Mandatory `CORRECTION_HMAC_SECRET` Env Variable & Contact Form Optional Email Rule

* **Target Files & Lines:** `functions/index.js` (`lines 4153, 4236`) and `firestore.rules` (`lines 156–164`)
* **Exact Remediations:**
  1. **Add `CORRECTION_HMAC_SECRET` to `functions/.env` before deploying functions:**
     ```env
     CORRECTION_HMAC_SECRET=generate_a_random_64_char_hex_secret_here
     APPS_SCRIPT_SERVER_SECRET=generate_another_random_64_char_hex_secret_here
     ```
     *(Without `CORRECTION_HMAC_SECRET` in `functions/.env`, `verifyCorrectionIdentity` and `submitCorrectionServer` will throw `HTTP 500: Server security configuration error`).*
  2. **Allow Optional Blank Email on `contact_messages` (`firestore.rules:158–159`):**
     ```diff
     --- a/firestore.rules
     +++ b/firestore.rules
     @@ -156,8 +156,8 @@
            allow create: if request.resource.data.name is string &&
                             request.resource.data.name.size() >= 2 && request.resource.data.name.size() <= 100 &&
                             request.resource.data.get('email', '') is string &&
     -                       request.resource.data.get('email', '').size() >= 5 && request.resource.data.get('email', '').size() <= 120 &&
     +                       (request.resource.data.get('email', '') == '' || (request.resource.data.get('email', '').size() >= 5 && request.resource.data.get('email', '').size() <= 120)) &&
                             request.resource.data.get('message', '') is string &&
                             request.resource.data.get('message', '').size() >= 5 && request.resource.data.get('message', '').size() <= 3000 &&
                             request.resource.data.get('honeypot', '') == '';
     ```
