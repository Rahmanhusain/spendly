# Graph Report - .  (2026-04-26)

## Corpus Check
- 99 files · ~72,424 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 364 nodes · 589 edges · 36 communities detected
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 80 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]

## God Nodes (most connected - your core abstractions)
1. `POST()` - 58 edges
2. `GET()` - 30 edges
3. `Logger` - 17 edges
4. `structureReceiptWithGroq()` - 12 edges
5. `getServerAuthContext()` - 9 edges
6. `getCookieDomainForHostname()` - 8 edges
7. `buildTenantWorkspaceUrl()` - 8 edges
8. `parseReceiptWithOcrAndLlm()` - 8 edges
9. `proxy()` - 7 edges
10. `normalizeRootDomain()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `proxy()` --calls--> `GET()`  [INFERRED]
  /home/rahman-husain/Projects/spendly/proxy.ts → /home/rahman-husain/Projects/spendly/app/api/policies/route.ts
- `proxy()` --calls--> `buildTenantWorkspaceUrl()`  [INFERRED]
  /home/rahman-husain/Projects/spendly/proxy.ts → /home/rahman-husain/Projects/spendly/lib/utils/tenant-host.ts
- `ensureReceiptCommentsTable()` --calls--> `query()`  [INFERRED]
  /home/rahman-husain/Projects/spendly/lib/repositories/receiptRepository.ts → /home/rahman-husain/Projects/spendly/lib/db/client.ts
- `createUserFromInvite()` --calls--> `transaction()`  [INFERRED]
  /home/rahman-husain/Projects/spendly/lib/repositories/teamRepository.ts → /home/rahman-husain/Projects/spendly/lib/db/client.ts
- `POST()` --calls--> `findDuplicateReceiptCandidate()`  [INFERRED]
  /home/rahman-husain/Projects/spendly/app/api/auth/logout/route.ts → /home/rahman-husain/Projects/spendly/lib/repositories/receiptRepository.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.0
Nodes (23): errorResponse(), extractAuthContext(), getServerAuthContext(), hasRole(), requireAuth(), successResponse(), verifyToken(), LoginPage() (+15 more)

### Community 1 - "Community 1"
Cohesion: 0.0
Nodes (40): AGENTS.md, approval-workflow_story.md, authenticationand_authorizaton_story.md, bank-reconciliation_story.md, CLAUDE.md, create-account_story.md, dashboard_story.md, expense-report_story.md (+32 more)

### Community 2 - "Community 2"
Cohesion: 0.0
Nodes (6): onSubmit(), updateField(), createAuthCookieOptions(), getRequestHostname(), Logger, proxy()

### Community 3 - "Community 3"
Cohesion: 0.0
Nodes (15): validateEnv(), buildReceiptStructuringUserPrompt(), clampConfidence(), configurePdfWorker(), extractTextFromImageWithGroq(), extractTextFromPdfSafely(), isPdfImageOnlyOrUnreadable(), normalizeCategory() (+7 more)

### Community 4 - "Community 4"
Cohesion: 0.0
Nodes (16): AllReceiptsPage(), getCurrentMonthRange(), approveReceiptByManager(), buildReceiptFilterSql(), createReceiptComment(), createUploadedReceipt(), ensureReceiptCommentsTable(), findDuplicateReceiptCandidate() (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.0
Nodes (13): createSession(), createTenantAccount(), getTenantById(), getUserByEmailAndVerifyPassword(), getUserById(), getUsersByTenant(), getValidSession(), closePool() (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.0
Nodes (14): applyDateRange(), cn(), copyToClipboard(), formatBytes(), formatDateTime(), formatMoney(), mergeUniqueReceipts(), onAddComment() (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.0
Nodes (10): acceptTeamInvite(), addUserToTeam(), createTeam(), createTeamInvite(), createUserFromInvite(), getInviteAndVerifyToken(), getInviteById(), getTeamInvites() (+2 more)

### Community 8 - "Community 8"
Cohesion: 0.0
Nodes (9): buildTenantWorkspaceUrl(), deriveBaseDomain(), getCookieDomainForHostname(), isIpv4(), isLocalhostFamily(), isVercelAppHostname(), normalizeRootDomain(), stripPathAndPort() (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.0
Nodes (7): buildOcrFingerprint(), evaluatePolicy(), extractMealAttendeeCountFromNote(), getUploadDirectory(), normalizeCategoryForPolicy(), readCategoryMonthlyLimits(), toPublicReceiptUrl()

### Community 10 - "Community 10"
Cohesion: 0.0
Nodes (6): buildWorkspaceSnapshot(), createId(), createTenantAccount(), getDemoState(), loginWithCredentials(), normalizeEmail()

### Community 11 - "Community 11"
Cohesion: 0.0
Nodes (6): Card(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle()

### Community 12 - "Community 12"
Cohesion: 0.0
Nodes (5): onDragOver(), onDrop(), onFileSelect(), onSubmit(), openPreviewInNewTab()

### Community 13 - "Community 13"
Cohesion: 0.0
Nodes (3): onSave(), readCustomCategoryLimits(), readNumberRule()

### Community 14 - "Community 14"
Cohesion: 0.0
Nodes (5): The Lake Hill Receipt, Upload Batch 218bd0f4-54f9-40f0-bb9d-975cb76a0fa6, Upload Root 1dc925a6-00ad-46ae-9ced-a8b3f9874c13, 583a5445-29b8-4d73-aa37-4b7ca704b2ac.png, 6873800a-28e9-451c-b43f-d7043fb3e959.png

### Community 15 - "Community 15"
Cohesion: 0.0
Nodes (2): handleCreateInvite(), loadInvites()

### Community 16 - "Community 16"
Cohesion: 0.0
Nodes (2): handleEscape(), handlePointerDown()

### Community 17 - "Community 17"
Cohesion: 0.0
Nodes (1): cn()

### Community 18 - "Community 18"
Cohesion: 0.0
Nodes (1): RootLayout()

### Community 19 - "Community 19"
Cohesion: 0.0
Nodes (1): AboutPage()

### Community 20 - "Community 20"
Cohesion: 0.0
Nodes (1): ContactPage()

### Community 21 - "Community 21"
Cohesion: 0.0
Nodes (1): handleAcceptInvite()

### Community 22 - "Community 22"
Cohesion: 0.0
Nodes (1): TermsPage()

### Community 23 - "Community 23"
Cohesion: 0.0
Nodes (1): PrivacyPage()

### Community 24 - "Community 24"
Cohesion: 0.0
Nodes (1): LogoutButton()

### Community 25 - "Community 25"
Cohesion: 0.0
Nodes (1): cn()

### Community 26 - "Community 26"
Cohesion: 0.0
Nodes (1): PolicySetupToast()

### Community 27 - "Community 27"
Cohesion: 0.0
Nodes (1): Label()

### Community 28 - "Community 28"
Cohesion: 0.0
Nodes (1): Badge()

### Community 29 - "Community 29"
Cohesion: 0.0
Nodes (1): Separator()

### Community 30 - "Community 30"
Cohesion: 0.0
Nodes (2): Next.js Wordmark, next.svg

### Community 31 - "Community 31"
Cohesion: 0.0
Nodes (2): Window Icon, window.svg

### Community 32 - "Community 32"
Cohesion: 0.0
Nodes (2): Vercel Logo, vercel.svg

### Community 33 - "Community 33"
Cohesion: 0.0
Nodes (2): File Icon, file.svg

### Community 34 - "Community 34"
Cohesion: 0.0
Nodes (2): Globe Icon, globe.svg

### Community 35 - "Community 35"
Cohesion: 0.0
Nodes (2): Spendly Brand Mark, logo.png

## Ambiguous Edges - Review These
- `STORIES.md` → `team-setup_story.md`  [AMBIGUOUS]
   · relation: has_status_conflict_with

## Knowledge Gaps
- **Thin community `Community 15`** (4 nodes): `page.tsx`, `page.tsx`, `handleCreateInvite()`, `loadInvites()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (4 nodes): `workspace-top-nav.tsx`, `workspace-top-nav.tsx`, `handleEscape()`, `handlePointerDown()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (3 nodes): `utils.ts`, `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (3 nodes): `layout.tsx`, `layout.tsx`, `RootLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (3 nodes): `page.tsx`, `page.tsx`, `AboutPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (3 nodes): `page.tsx`, `page.tsx`, `ContactPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (3 nodes): `page.tsx`, `page.tsx`, `handleAcceptInvite()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (3 nodes): `page.tsx`, `page.tsx`, `TermsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (3 nodes): `page.tsx`, `page.tsx`, `PrivacyPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (3 nodes): `logout-button.tsx`, `logout-button.tsx`, `LogoutButton()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (3 nodes): `workspace-shell.tsx`, `workspace-shell.tsx`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (3 nodes): `policy-setup-toast.tsx`, `policy-setup-toast.tsx`, `PolicySetupToast()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (3 nodes): `label.tsx`, `label.tsx`, `Label()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (3 nodes): `Badge()`, `badge.tsx`, `badge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (3 nodes): `separator.tsx`, `separator.tsx`, `Separator()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (2 nodes): `Next.js Wordmark`, `next.svg`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (2 nodes): `Window Icon`, `window.svg`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `Vercel Logo`, `vercel.svg`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `File Icon`, `file.svg`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (2 nodes): `Globe Icon`, `globe.svg`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (2 nodes): `Spendly Brand Mark`, `logo.png`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.