const WORKSPACE_SESSION_KEYS = {
  workspace: 'selectedWorkspace',
  workspaceId: 'selectedWorkspaceId',
  role: 'currentRole',
  isPublicAccess: 'isPublicAccess',
  analyticsSessionId: 'analytics_session_id',
  settingsTabIntent: 'workspace_settings_tab_intent',
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

export function getWorkspaceSession() {
  const storage = getSessionStorage();
  if (!storage) {
    return {
      workspace: null,
      workspaceId: null,
      role: 'contributor',
      isPublicAccess: false,
    };
  }

  const workspace = parseJson(storage.getItem(WORKSPACE_SESSION_KEYS.workspace));
  const workspaceId =
    storage.getItem(WORKSPACE_SESSION_KEYS.workspaceId) ||
    workspace?.id ||
    null;
  const role = storage.getItem(WORKSPACE_SESSION_KEYS.role) || 'contributor';
  const isPublicAccess = storage.getItem(WORKSPACE_SESSION_KEYS.isPublicAccess) === 'true';

  return { workspace, workspaceId, role, isPublicAccess };
}

export function setWorkspaceSession({ workspace = null, workspaceId = null, role = 'contributor', isPublicAccess = false }) {
  const storage = getSessionStorage();
  if (!storage) return;

  if (workspace) {
    storage.setItem(WORKSPACE_SESSION_KEYS.workspace, JSON.stringify(workspace));
  }

  const resolvedWorkspaceId = workspaceId || workspace?.id;
  if (resolvedWorkspaceId) {
    storage.setItem(WORKSPACE_SESSION_KEYS.workspaceId, resolvedWorkspaceId);
  }

  storage.setItem(WORKSPACE_SESSION_KEYS.role, role || 'contributor');
  storage.setItem(WORKSPACE_SESSION_KEYS.isPublicAccess, String(Boolean(isPublicAccess)));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('workspace-session-updated'));
  }
}

export function clearWorkspaceSession() {
  const storage = getSessionStorage();
  if (!storage) return;

  storage.removeItem(WORKSPACE_SESSION_KEYS.workspace);
  storage.removeItem(WORKSPACE_SESSION_KEYS.workspaceId);
  storage.removeItem(WORKSPACE_SESSION_KEYS.role);
  storage.removeItem(WORKSPACE_SESSION_KEYS.isPublicAccess);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('workspace-session-updated'));
  }
}

export function getOrCreateAnalyticsSessionId() {
  const storage = getSessionStorage();
  if (!storage) return null;

  let sessionId = storage.getItem(WORKSPACE_SESSION_KEYS.analyticsSessionId);
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    storage.setItem(WORKSPACE_SESSION_KEYS.analyticsSessionId, sessionId);
  }

  return sessionId;
}

export function setWorkspaceSettingsTabIntent(tab) {
  const storage = getSessionStorage();
  if (!storage) return;
  if (!tab) {
    storage.removeItem(WORKSPACE_SESSION_KEYS.settingsTabIntent);
    return;
  }
  storage.setItem(WORKSPACE_SESSION_KEYS.settingsTabIntent, String(tab));
}

export function consumeWorkspaceSettingsTabIntent() {
  const storage = getSessionStorage();
  if (!storage) return null;
  const intent = storage.getItem(WORKSPACE_SESSION_KEYS.settingsTabIntent);
  storage.removeItem(WORKSPACE_SESSION_KEYS.settingsTabIntent);
  return intent || null;
}
