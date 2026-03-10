const BOARD_SESSION_KEYS = {
  workspace: 'selectedWorkspace',
  workspaceId: 'selectedWorkspaceId',
  role: 'currentRole',
  isPublicAccess: 'isPublicAccess',
  analyticsSessionId: 'analytics_session_id',
};

function getSessionStorage() {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.sessionStorage;
}

function parseJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getBoardSession() {
  const storage = getSessionStorage();
  if (!storage) {
    return {
      workspace: null,
      workspaceId: null,
      role: 'viewer',
      isPublicAccess: false,
    };
  }

  const workspace = parseJson(storage.getItem(BOARD_SESSION_KEYS.workspace));
  const workspaceId =
    storage.getItem(BOARD_SESSION_KEYS.workspaceId) ||
    workspace?.id ||
    null;
  const role = storage.getItem(BOARD_SESSION_KEYS.role) || 'viewer';
  const isPublicAccess = storage.getItem(BOARD_SESSION_KEYS.isPublicAccess) === 'true';

  return { workspace, workspaceId, role, isPublicAccess };
}

export function setBoardSession({ workspace = null, workspaceId = null, role = 'viewer', isPublicAccess = false }) {
  const storage = getSessionStorage();
  if (!storage) return;

  if (workspace) {
    storage.setItem(BOARD_SESSION_KEYS.workspace, JSON.stringify(workspace));
  }

  const resolvedWorkspaceId = workspaceId || workspace?.id;
  if (resolvedWorkspaceId) {
    storage.setItem(BOARD_SESSION_KEYS.workspaceId, resolvedWorkspaceId);
  }

  storage.setItem(BOARD_SESSION_KEYS.role, role || 'viewer');
  storage.setItem(BOARD_SESSION_KEYS.isPublicAccess, String(Boolean(isPublicAccess)));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('workspace-session-updated'));
  }
}

export function clearBoardSession() {
  const storage = getSessionStorage();
  if (!storage) return;

  storage.removeItem(BOARD_SESSION_KEYS.workspace);
  storage.removeItem(BOARD_SESSION_KEYS.workspaceId);
  storage.removeItem(BOARD_SESSION_KEYS.role);
  storage.removeItem(BOARD_SESSION_KEYS.isPublicAccess);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('workspace-session-updated'));
  }
}

export function getOrCreateAnalyticsSessionId() {
  const storage = getSessionStorage();
  if (!storage) return null;

  let sessionId = storage.getItem(BOARD_SESSION_KEYS.analyticsSessionId);
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    storage.setItem(BOARD_SESSION_KEYS.analyticsSessionId, sessionId);
  }

  return sessionId;
}
