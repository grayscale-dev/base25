# Mutation Endpoints Inventory & Authorization

## Authorization Model

**ALL mutation endpoints use**: `authorizeWriteAction(base44, req, workspaceId, minRole)`

**Enforces**:
1. ✅ Authentication (user must be logged in)
2. ✅ Workspace validation (exists + active)
3. ✅ Role check (user has minimum required role)
4. ✅ Display name (NAME_REQUIRED if missing)

**Error Responses**:
- 401: UNAUTHORIZED - Not authenticated
- 403: NO_ACCESS - No workspace role
- 403: INSUFFICIENT_ROLE - Below minimum role
- 403: NAME_REQUIRED - Display name missing
- 404: WORKSPACE_NOT_FOUND - Invalid workspace

---

## Feedback Operations

### 1. Create Feedback
**Endpoint**: `createFeedback`  
**Role**: `contributor`  
**Display Name**: ✅ Required  
**Enforcement**: `authorizeWriteAction()`

**Action**: Create new feedback item  
**Params**: workspace_id, title, type, description, steps_to_reproduce, expected_behavior, actual_behavior, environment, attachments

---

### 2. Update Feedback
**Endpoint**: `updateFeedback`  
**Role**: `support` (staff only)  
**Display Name**: ✅ Required  
**Enforcement**: `authorizeWriteAction()`

**Action**: Update feedback status, priority, metadata  
**Params**: feedback_id, workspace_id, status, priority, assigned_to, tags

---

### 3. Create Feedback Response
**Endpoint**: `createFeedbackResponse`  
**Role**: `contributor`  
**Display Name**: ✅ Required  
**Enforcement**: `authorizeWriteAction()`

**Action**: Add comment/reply to feedback  
**Params**: feedback_id, workspace_id, content, attachments

---

## Support Operations

### 4. Create Support Thread
**Endpoint**: `createSupportThread`  
**Role**: `contributor`  
**Display Name**: ✅ Required  
**Enforcement**: `authorizeWriteAction()`

**Action**: Create new support ticket  
**Params**: workspace_id, subject, priority

---

### 5. Create Support Message
**Endpoint**: `createSupportMessage`  
**Role**: `contributor`  
**Display Name**: ✅ Required  
**Enforcement**: `authorizeWriteAction()`

**Action**: Reply to support thread  
**Params**: thread_id, workspace_id, content, attachments, is_internal_note

---

## Roadmap Operations

### 6. Create Roadmap Item
**Endpoint**: `createRoadmapItem`  
**Role**: `support` (staff only)  
**Display Name**: ✅ Required  
**Enforcement**: `authorizeWriteAction()`

**Action**: Create new roadmap item  
**Params**: workspace_id, title, description, status, target_date, target_quarter, tags

---

### 7. Update Roadmap Item
**Endpoint**: `updateRoadmapItem`  
**Role**: `support` (staff only)  
**Display Name**: ✅ Required  
**Enforcement**: `authorizeWriteAction()`

**Action**: Update roadmap item (status, position, metadata)  
**Params**: item_id, workspace_id, title, description, status, display_order, target_date, tags

**Special**: Drag/drop status changes use this endpoint (staff-only)

---

## Documentation Operations

### 8. Create Doc Comment
**Endpoint**: `createDocComment`  
**Role**: `contributor`  
**Display Name**: ✅ Required  
**Enforcement**: `authorizeWriteAction()`

**Action**: Add comment/question to docs  
**Params**: doc_page_id, workspace_id, content, is_question

---

## Votes & Reactions

### 9. Vote on Feedback
**Endpoint**: `voteFeedback`  
**Role**: `contributor`  
**Display Name**: ✅ Required  
**Enforcement**: `authorizeWriteAction()`

**Action**: Upvote feedback item  
**Params**: feedback_id, workspace_id

**Status**: 🔄 TO BE IMPLEMENTED

---

### 10. Unvote Feedback
**Endpoint**: `unvoteFeedback`  
**Role**: `contributor`  
**Display Name**: ✅ Required  
**Enforcement**: `authorizeWriteAction()`

**Action**: Remove upvote from feedback  
**Params**: feedback_id, workspace_id

**Status**: 🔄 TO BE IMPLEMENTED

---

## File Attachments

### 11. Upload File
**Endpoint**: Core.UploadFile (integration)  
**Role**: `contributor` (implicit via auth)  
**Display Name**: ✅ Required (enforced by parent action)  
**Enforcement**: Authenticated upload, used within feedback/support/doc creation

**Action**: Upload file to storage  
**Params**: file (binary)

**Note**: Files are only attached when parent mutation (feedback/support) succeeds

---

### 12. Link Attachment (Future)
**Endpoint**: `attachFile`  
**Role**: `contributor`  
**Display Name**: ✅ Required  
**Enforcement**: `authorizeWriteAction()`

**Action**: Attach file to existing feedback/support  
**Params**: entity_type, entity_id, workspace_id, file_url

**Status**: 🔄 TO BE IMPLEMENTED (currently attachments added during creation only)

---

## Profile Operations

### 13. Update User Profile
**Endpoint**: `updateUserProfile`  
**Role**: `viewer` (self only)  
**Display Name**: ❌ Not required (this IS the endpoint to set it)  
**Enforcement**: Custom auth (self-update only)

**Action**: Update own display name and profile photo  
**Params**: full_name, profile_photo_url

**Special**: Does NOT require display name (circular dependency)

---

## Admin Operations

### 14. Update Workspace Settings
**Endpoint**: `updateWorkspaceSettings`  
**Role**: `admin`  
**Display Name**: ✅ Required  
**Enforcement**: `authorizeWriteAction()`

**Action**: Modify workspace settings  
**Params**: workspace_id, settings object

**Status**: 🔄 TO BE IMPLEMENTED

---

### 15. Manage Access Rules
**Endpoint**: `manageAccessRules`  
**Role**: `admin`  
**Display Name**: ✅ Required  
**Enforcement**: `authorizeWriteAction()`

**Action**: Create/update/delete access rules  
**Params**: workspace_id, pattern, default_role

**Status**: 🔄 TO BE IMPLEMENTED

---

### 16. Assign Workspace Role
**Endpoint**: `assignWorkspaceRole`  
**Role**: `admin`  
**Display Name**: ✅ Required  
**Enforcement**: `authorizeWriteAction()`

**Action**: Grant/revoke workspace roles  
**Params**: workspace_id, user_id, role

**Status**: 🔄 TO BE IMPLEMENTED

---

## Changelog Operations

### 17. Create Changelog Entry
**Endpoint**: `createChangelogEntry`  
**Role**: `support` (staff only)  
**Display Name**: ✅ Required  
**Enforcement**: `authorizeWriteAction()`

**Action**: Create new changelog entry  
**Params**: workspace_id, title, description, release_date, roadmap_item_ids, tags

**Status**: 🔄 TO BE IMPLEMENTED (currently inline in UI)

---

## Summary

### Implemented & Enforced (8 endpoints)
✅ createFeedback  
✅ createFeedbackResponse  
✅ createSupportThread  
✅ createSupportMessage  
✅ createRoadmapItem  
✅ updateRoadmapItem (includes drag/drop)  
✅ createDocComment  
✅ updateUserProfile (special case - no name required)

### To Be Implemented (9 endpoints)
🔄 voteFeedback  
🔄 unvoteFeedback  
🔄 attachFile  
🔄 updateWorkspaceSettings  
🔄 manageAccessRules  
🔄 assignWorkspaceRole  
🔄 createChangelogEntry  
🔄 updateFeedback (exists, verify enforcement)  
🔄 linkEntityToEntity (cross-links between feedback/roadmap/docs)

---

## Roadmap Drag/Drop Specifics

**Frontend Component**: `components/roadmap/RoadmapBoard.js`  
**Backend Endpoint**: `updateRoadmapItem`  
**Required Role**: `support` or `admin` (staff-only)  
**Display Name**: ✅ Required

**Enforcement Points**:
1. Frontend: `permissions.canCreateRoadmap` checks staff role
2. Backend: `authorizeWriteAction(base44, req, workspaceId, 'support')`

**Drag Actions That Trigger**:
- Moving item between status columns (status change)
- Reordering items within column (display_order change)
- Both require `support` role minimum

**UX for Non-Staff**:
- Roadmap board visible in read-only mode
- No drag handles shown
- No "Add Item" button
- Status/position updates blocked

---

## Frontend Permission Gates

All write actions gated by `useBoardContext` permissions:
- `canCreateFeedback` → contributor+
- `canCreateRoadmap` → staff (support/admin)
- `canCreateSupport` → contributor+
- `canComment` → contributor+
- `canManageSettings` → admin
- `canModerateContent` → staff

Public/unauthenticated: All `false` (read-only)

---

## Display Name Enforcement

**Every mutation EXCEPT `updateUserProfile`** enforces display name via `authorizeWriteAction()`.

**Flow**:
1. User attempts write action
2. Frontend `useProfileGuard` checks `user.full_name`
3. If missing → show modal, block action
4. User enters name → `updateUserProfile` (no name requirement)
5. Retry original action
6. Backend validates again (defense in depth)

**Error Response** (403):
```json
{
  "error": "Name required",
  "code": "NAME_REQUIRED",
  "message": "Please set your display name before performing this action"
}
``