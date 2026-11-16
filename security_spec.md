# Free City Organization — Firestore Security Specification

## 1. Data Invariants
1. **Default-Deny Baseline**: Every unspecified document path is denied (`allow read, write: if false`).
2. **Strict PII Isolation (`/users/{userId}`)**: Member profiles contain email addresses and are readable/writable only by the verified owner (`request.auth.uid == userId && request.auth.token.email_verified == true`) or an admin (`isAdmin()`). Blanket `list` queries on `/users` are forbidden for non-admins.
3. **Immutable Ownership & Temporal Integrity**: `uid`/`userId` and `createdAt` must match `request.auth.uid` and `request.time` on creation and can never be modified on update; `updatedAt` must equal `request.time` on every write.
4. **Server-Only Discord Secrets**: `/discordOAuthStates` and `/discordOAuthTokens` deny all client SDK reads and writes (`if false`). `/discordConnections/{userId}` allows owner/admin read only and denies all client writes.
5. **Terminal State & Status Integrity (`/applications/{applicationId}`)**: Members may only create applications with `status == 'pending'`, may edit details only while `status == 'pending'`, and may never self-approve or modify an application once it reaches a terminal state (`approved` or `rejected`). Only `isAdmin()` may transition `status` or modify reviewed applications.
6. **Public Event Read Gating (`/events/{eventId}`)**: Visitors may only read/list events where `resource.data.published == true`; only `isAdmin()` may read unpublished drafts or write events.
7. **ID & Payload Bounds**: Every document ID matches `^[a-zA-Z0-9_\-]+$` with length `<= 128`, every string has explicit `.size()` bounds matching `firebase-blueprint.json`, and `keys().hasOnly(...)` / `affectedKeys().hasOnly(...)` block shadow fields.

## 2. The "Dirty Dozen" Attack Payloads (Must Return `PERMISSION_DENIED`)
1. **Shadow Field Injection on Profile Create**: Creating `/users/u1` with `{ uid: "u1", email: "a@b.com", isAdmin: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }` → Denied by `keys().hasOnly(...)`.
2. **Identity Spoofing on Profile Create**: User `u1` creating `/users/u2` or setting `uid: "u2"` inside `/users/u1` → Denied by `request.auth.uid == userId` and `data.uid == request.auth.uid`.
3. **Unverified Email Spoofing**: User with `email: "michalmark496@gmail.com"` and `email_verified: false` reading `/users/other` or writing `/events/e1` → Denied by `request.auth.token.email_verified == true`.
4. **PII Cross-Member Read**: Signed-in user `u1` calling `getDoc(/users/u2)` or `getDocs(/users)` → Denied by `isOwner(userId) || isAdmin()` and `allow list: if isAdmin()`.
5. **Client Timestamp Tampering**: Creating `/users/u1` or `/applications/a1` with backdated `createdAt: "2020-01-01"` → Denied by `data.createdAt == request.time`.
6. **Immutable `createdAt` / `userId` Mutation**: Updating `/applications/a1` to change `userId` or `createdAt` → Denied by `incoming().userId == existing().userId && incoming().createdAt == existing().createdAt`.
7. **Self-Approval State Shortcutting**: Member `u1` creating `/applications/a1` with `status: "approved"` or updating `status` from `"pending"` to `"approved"` → Denied by `incoming().status == "pending"` and `affectedKeys().hasOnly(['characterName', 'discordHandle', 'backstory', 'updatedAt'])`.
8. **Terminal State Bypass**: Member `u1` updating `/applications/a1` after `existing().status == "approved"` → Denied by `existing().status == "pending"`.
9. **Resource Poisoning / Oversized String**: Submitting `/applications/a1` with a 5,000-char `backstory` or 500-char doc ID → Denied by `isValidId()` and `backstory.size() <= 2000`.
10. **Client Write to Server-Only Discord Secrets**: Any client reading/writing `/discordOAuthTokens/u1`, `/discordOAuthStates/s1`, or writing `/discordConnections/u1` → Denied by `if false`.
11. **Non-Admin Event Manipulation / Draft Scraping**: Non-admin user creating `/events/e1` or querying `/events` without filtering `published == true` → Denied by `allow list: if resource.data.published == true || isAdmin()` and `allow write: if isAdmin()`.
12. **Self-Admin Escalation**: User `u1` creating `/admins/u1` → Denied by `allow read, write: if false` on `/admins/{userId}`.
