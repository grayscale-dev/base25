import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from '@/lib/router';
import Link from '@/components/common/AppLink';
import { 
  LogOut, ChevronDown, Settings, Bell, Search as SearchIcon,
  LayoutDashboard, MessageSquare, Map, History, Menu, X, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { workspaceUrl } from '@/components/utils/workspaceUrl';
import { cn } from '@/lib/utils';
import { WorkspaceProvider } from '@/components/context/WorkspaceContext';
import { getWorkspaceSession, setWorkspaceSession } from '@/lib/workspace-session';
import WorkspaceAvatar from '@/components/workspace/WorkspaceAvatar';
import { startWorkspaceLogin } from '@/lib/start-workspace-login';
import { isAdminRole } from '@/lib/roles';
import {
  getDefaultWorkspaceSection,
  resolveWorkspaceSection,
} from '@/lib/workspace-sections';

const adminNavItems = [
  { name: 'All', icon: LayoutDashboard, page: 'All', section: 'all' },
  { name: 'Feedback', icon: MessageSquare, page: 'Feedback', section: 'feedback' },
  { name: 'Roadmap', icon: Map, page: 'Roadmap', section: 'roadmap' },
];

const memberNavItems = [
  { name: 'Feedback', icon: MessageSquare, page: 'Feedback', section: 'feedback' },
  { name: 'Roadmap', icon: Map, page: 'Roadmap', section: 'roadmap' },
];

const DEFAULT_WORKSPACE_BRAND = '#0f172a';

function normalizeHexColor(value, fallback = DEFAULT_WORKSPACE_BRAND) {
  const normalized = String(value || '').trim();
  if (!normalized) return fallback;
  const shortMatch = normalized.match(/^#([0-9a-fA-F]{3})$/);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const fullMatch = normalized.match(/^#([0-9a-fA-F]{6})$/);
  if (fullMatch) return `#${fullMatch[1]}`.toLowerCase();
  return fallback;
}

function hexToRgba(hex, alpha) {
  const normalized = normalizeHexColor(hex);
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getQueryParam(search, key) {
  const params = new URLSearchParams(String(search || ''));
  return params.get(key) || '';
}

export default function Layout({ children, currentPageName }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [role, setRole] = useState('contributor');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isPublicViewing, setIsPublicViewing] = useState(false);
  const [noAccessMessage, setNoAccessMessage] = useState(null);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const pathParts = location.pathname.split('/').filter(Boolean);
  const pathSection = pathParts[0] === 'workspace' ? pathParts[2]?.toLowerCase() : null;

  // Public pages that don't need auth or workspace context
  const publicPages = ['Home', 'About', 'Pricing', 'Features'];
  const isPublicPage = publicPages.includes(currentPageName);
  
  // Pages that need auth but not workspace context
  const noWorkspacePages = ['Workspaces', 'JoinWorkspace'];
  const needsWorkspace = !noWorkspacePages.includes(currentPageName) && !isPublicPage;

  useEffect(() => {
    // Skip loading context for public pages
    if (isPublicPage) {
      return;
    }
    
    loadContext();
  }, [currentPageName, location.search, location.pathname]);

  useEffect(() => {
    const handleWorkspaceSessionUpdate = () => {
      if (!isPublicPage) {
        loadContext();
      }
    };

    window.addEventListener('workspace-session-updated', handleWorkspaceSessionUpdate);
    return () => {
      window.removeEventListener('workspace-session-updated', handleWorkspaceSessionUpdate);
    };
  }, [isPublicPage, currentPageName]);

  const loadContext = async () => {
    // Context is set by Workspace router via sessionStorage
    // We just read it here for layout rendering
    
    // Try to authenticate
    let currentUser = null;
    let isAuthenticated = false;
    
    try {
      currentUser = await base44.auth.me();
      setUser(currentUser);
      isAuthenticated = true;
    } catch {
      // User not authenticated
      isAuthenticated = false;
    }

    if (needsWorkspace) {
      // Read workspace context from sessionStorage (set by Workspace router)
      const {
        workspace: storedWorkspace,
        role: storedRole,
        isPublicAccess: storedIsPublicAccess,
      } = getWorkspaceSession();
      
      if (!storedWorkspace) {
        if (location.pathname.startsWith('/workspace/')) {
          setWorkspace(null);
          setRole('contributor');
          setIsPublicViewing(false);
          return;
        }

        // No workspace context - redirect to home or workspaces
        if (isAuthenticated) {
          navigate(createPageUrl('Workspaces'));
        } else {
          navigate(createPageUrl('Home'));
        }
        return;
      }
      
      setWorkspace(storedWorkspace);
      setRole(storedRole || 'contributor');
      setIsPublicViewing(storedIsPublicAccess);
      
      if (storedIsPublicAccess) {
        setNoAccessMessage('You don\'t have permission to contribute to this workspace. Contact the admin to request access.');
      } else {
        setNoAccessMessage(null);
      }
      
      // Load user workspaces for switcher (if authenticated with role)
      if (isAuthenticated && !storedIsPublicAccess) {
        try {
          const allRoles = await base44.entities.WorkspaceRole.filter({ user_id: currentUser.id });
          if (allRoles.length > 0) {
            const workspaceIds = [...new Set(allRoles.map(r => r.workspace_id))];
            const wsData = await Promise.all(
              workspaceIds.map(async (id) => {
                const results = await base44.entities.Workspace.filter({ id });
                return results[0];
              })
            );
            setWorkspaces(wsData.filter(w => w && w.status === 'active'));
          }
        } catch (error) {
          console.error('Failed to load user workspaces:', error);
        }
      }
    }
  };

  const handleWorkspaceSwitch = async (ws) => {
    let nextRole = 'contributor';
    if (user?.id) {
      try {
        const roles = await base44.entities.WorkspaceRole.filter({
          workspace_id: ws.id,
          user_id: user.id,
        });
        nextRole = roles[0]?.role || 'contributor';
      } catch {
        nextRole = 'contributor';
      }
    }

    setWorkspaceSession({ workspace: ws, role: nextRole, isPublicAccess: false });
    setWorkspace(ws);
    setRole(nextRole);
    const requestedSection = pathSection || currentPageName?.toLowerCase() || 'items';
    const targetSection =
      resolveWorkspaceSection(requestedSection, nextRole, false) ||
      getDefaultWorkspaceSection(nextRole, false);
    navigate(workspaceUrl(ws.slug, targetSection));
  };

  const handleLogout = () => {
    sessionStorage.clear();
    base44.auth.logout(window.location.origin + createPageUrl('Home'));
  };

  const handleInteractiveSignIn = async (event) => {
    event?.preventDefault?.();
    await startWorkspaceLogin({ redirectTo: window.location.href });
  };

  const isAdmin = isAdminRole(role) && !isPublicViewing;
  const canOpenSettings = Boolean(user && workspace && !isPublicViewing);
  const isSettingsPage = currentPageName === 'WorkspaceSettings' || location.pathname.startsWith('/workspace-settings');
  const isAlertsPage = location.pathname.startsWith('/alerts');
  const isSearchPage = location.pathname.startsWith('/search');
  const isWorkspaceUtilityPage = isSettingsPage || isAlertsPage || isSearchPage;
  const visibleNavItems = isAdmin ? adminNavItems : memberNavItems;
  const activeSection = isWorkspaceUtilityPage
    ? null
    : (
      resolveWorkspaceSection(pathSection || currentPageName?.toLowerCase(), role, isPublicViewing) ||
      getDefaultWorkspaceSection(role, isPublicViewing)
    );
  const workspaceBrandColor = normalizeHexColor(
    isPublicPage ? DEFAULT_WORKSPACE_BRAND : workspace?.primary_color || DEFAULT_WORKSPACE_BRAND
  );
  const workspaceThemeStyle = {
    '--workspace-brand': workspaceBrandColor,
    '--workspace-brand-soft': hexToRgba(workspaceBrandColor, 0.12),
    '--workspace-brand-soft-strong': hexToRgba(workspaceBrandColor, 0.22),
    '--workspace-brand-fg': workspaceBrandColor,
  };
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--workspace-brand', workspaceBrandColor);
    root.style.setProperty('--workspace-brand-soft', hexToRgba(workspaceBrandColor, 0.12));
    root.style.setProperty('--workspace-brand-soft-strong', hexToRgba(workspaceBrandColor, 0.22));
    root.style.setProperty('--workspace-brand-fg', workspaceBrandColor);
  }, [workspaceBrandColor]);
  const workspaceHomeSection = getDefaultWorkspaceSection(role, isPublicViewing);
  const isActive = (section) => !isSettingsPage && section === activeSection;
  const isChangelogPage = activeSection === 'changelog';

  useEffect(() => {
    if (!isSearchPage) return;
    setHeaderSearchQuery(getQueryParam(location.search, 'q'));
  }, [isSearchPage, location.search]);

  useEffect(() => {
    if (!workspace?.id || !canOpenSettings) {
      setUnreadAlerts(0);
      return;
    }

    let cancelled = false;
    const loadUnreadAlerts = async () => {
      try {
        const { data } = await base44.functions.invoke(
          'getUnreadAlertCount',
          { workspace_id: workspace.id },
          { authMode: 'user' },
        );
        if (!cancelled) {
          setUnreadAlerts(Number(data?.unread_count || 0));
        }
      } catch (error) {
        if (!cancelled) {
          setUnreadAlerts(0);
        }
        console.error('Failed to load unread alerts:', error);
      }
    };

    const onAlertsUpdated = (event) => {
      const eventWorkspaceId = event?.detail?.workspaceId || null;
      if (eventWorkspaceId && eventWorkspaceId !== workspace.id) return;
      void loadUnreadAlerts();
    };
    const onAlertsRead = (event) => {
      const eventWorkspaceId = event?.detail?.workspaceId || null;
      if (eventWorkspaceId && eventWorkspaceId !== workspace.id) return;
      setUnreadAlerts(0);
    };

    void loadUnreadAlerts();
    const intervalId = window.setInterval(() => {
      void loadUnreadAlerts();
    }, 60000);
    window.addEventListener('workspace-alerts-updated', onAlertsUpdated);
    window.addEventListener('workspace-alerts-read', onAlertsRead);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('workspace-alerts-updated', onAlertsUpdated);
      window.removeEventListener('workspace-alerts-read', onAlertsRead);
    };
  }, [workspace?.id, canOpenSettings]);

  const handleOpenAlerts = () => {
    navigate(createPageUrl('Alerts'));
  };

  const handleHeaderSearchSubmit = (event) => {
    event.preventDefault();
    const query = String(headerSearchQuery || '').trim();
    if (!query) return;
    navigate(`${createPageUrl('Search')}?q=${encodeURIComponent(query)}`);
  };

  // No layout for public pages, workspaces hub, or join page
  if (['Home', 'About', 'Pricing', 'Features', 'Workspaces', 'JoinWorkspace'].includes(currentPageName)) {
    return children;
  }
  
  // Show permission error for authenticated users without access to private workspace
  if (user && noAccessMessage && workspace?.visibility === 'restricted') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <X className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600 mb-6">{noAccessMessage}</p>
          <Button 
            onClick={() => navigate(createPageUrl('Workspaces'))}
            className="bg-slate-900 hover:bg-slate-800"
          >
            View My Workspaces
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 base25-workspace-theme" style={workspaceThemeStyle}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo & Workspace Switcher */}
            <div className="flex items-center gap-4">
              {workspace ? (
                isPublicViewing ? (
                  // Simple link for incognito/public users
                  <Link to={workspaceUrl(workspace.slug, workspaceHomeSection)}>
                    <Button variant="ghost" className="h-auto p-2 hover:bg-slate-100">
                        <div className="flex items-center gap-3">
                        <WorkspaceAvatar workspace={workspace} size="md" />
                        <span className="font-semibold text-slate-900 hidden sm:inline">
                          {workspace.name}
                        </span>
                      </div>
                    </Button>
                  </Link>
                ) : (
                  // Dropdown menu for authenticated users with workspace access
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-auto p-2 hover:bg-slate-100">
                        <div className="flex items-center gap-3">
                          <WorkspaceAvatar workspace={workspace} size="md" />
                          <span className="font-semibold text-slate-900 hidden sm:inline">
                            {workspace.name}
                          </span>
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64 p-0">
                      {workspaces.map((ws) => (
                        <DropdownMenuItem
                          key={ws.id}
                          onClick={() => handleWorkspaceSwitch(ws)}
                          className="cursor-pointer !w-full !justify-start rounded-none px-3 py-2"
                        >
                          <WorkspaceAvatar workspace={ws} size="sm" />
                          <span className="ml-2 flex-1 truncate text-left">{ws.name}</span>
                          {ws.id === workspace.id && (
                            <span className="ml-auto text-xs text-slate-400">Current</span>
                          )}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => navigate(createPageUrl('Workspaces'))}
                        className="cursor-pointer"
                      >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        View all workspaces
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              ) : (
                <div className="flex items-center gap-2">
                  <WorkspaceAvatar workspace={workspace} size="md" />
                  <span className="font-semibold text-slate-900">Portal</span>
                </div>
              )}

              {/* Desktop Navigation */}
              {workspace && (
                <nav className="hidden md:flex items-center gap-1 ml-6">
                  {visibleNavItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.section);

                    return (
                      <Link
                        key={item.page}
                        to={workspaceUrl(workspace.slug, item.section)}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                          active 
                            ? 'bg-[var(--workspace-brand-soft)] text-[var(--workspace-brand-fg)]'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
              )}
            </div>

            {/* Right: User menu & Admin links */}
            <div className="flex items-center gap-2">
                {/* Login prompt for public viewers */}
                {isPublicViewing && !user && (
                  <Button 
                    onClick={handleInteractiveSignIn}
                    className="bg-slate-900 hover:bg-slate-800 text-white"
                  >
                    Login to Contribute
                  </Button>
                )}
                
                {/* No access message for authenticated users without role */}
                {isPublicViewing && user && noAccessMessage && (
                  <div className="hidden md:block text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">
                    Read-only access
                  </div>
                )}
                
                {canOpenSettings && workspace && (
                  <div className="hidden md:flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleOpenAlerts}
                      aria-label="Open alerts"
                      title="Alerts"
                      className={cn(
                        "relative h-9 w-9",
                        isAlertsPage ? "bg-slate-100 text-slate-900" : "hover:bg-slate-50"
                      )}
                    >
                      <Bell
                        className={cn(
                          "h-4 w-4",
                          unreadAlerts > 0 ? "text-blue-600" : "text-slate-500"
                        )}
                      />
                      {unreadAlerts > 0 ? (
                        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-600" />
                      ) : null}
                    </Button>
                    <form onSubmit={handleHeaderSearchSubmit} className="relative hidden md:block">
                      <SearchIcon className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        value={headerSearchQuery}
                        onChange={(event) => setHeaderSearchQuery(event.target.value)}
                        placeholder="Search workspace..."
                        className="h-9 w-56 bg-white pl-8"
                        aria-label="Search workspace items"
                      />
                    </form>
                    <Link to={workspaceUrl(workspace.slug, 'changelog')}>
                      <Button
                        variant="ghost"
                        className={cn(
                          "h-auto gap-2 rounded-lg px-4 py-2 text-sm font-medium hover:text-slate-900",
                          isChangelogPage
                            ? "bg-slate-100 text-slate-900"
                            : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <History className="h-4 w-4" />
                        Changelog
                      </Button>
                    </Link>
                    <Link to={createPageUrl('WorkspaceSettings')}>
                      <Button
                        variant="ghost"
                        className={cn(
                          "h-auto gap-2 rounded-lg px-4 py-2 text-sm font-medium hover:text-slate-900",
                          isSettingsPage
                            ? "bg-slate-100 text-slate-900"
                            : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <Settings className="h-4 w-4" />
                        Settings
                      </Button>
                    </Link>
                  </div>
                )}

              {/* Mobile menu button */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72">
                  <div className="flex flex-col h-full">
                    <div className="space-y-1 py-4">
                      {workspace && visibleNavItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.section);

                        return (
                          <button
                            type="button"
                            key={item.page}
                            onClick={() => {
                              setMobileMenuOpen(false);
                              navigate(workspaceUrl(workspace.slug, item.section));
                            }}
                            className={cn(
                              'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                              active 
                                ? 'bg-[var(--workspace-brand-soft)] text-[var(--workspace-brand-fg)]'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                            )}
                          >
                            <Icon className="h-5 w-5" />
                            {item.name}
                          </button>
                        );
                      })}
                    </div>
                    
                    {canOpenSettings && (
                      <>
                        <div className="border-t border-slate-200 pt-4 mt-2 space-y-1">
                          <p className="px-4 text-xs font-medium text-slate-400 uppercase mb-2">Workspace</p>
                          <button
                            type="button"
                            onClick={() => {
                              setMobileMenuOpen(false);
                              handleOpenAlerts();
                            }}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-4 py-3 text-sm",
                              isAlertsPage
                                ? "bg-[var(--workspace-brand-soft)] font-medium text-[var(--workspace-brand-fg)]"
                                : "text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            <div className="relative">
                              <Bell className={cn("h-5 w-5", unreadAlerts > 0 ? "text-blue-600" : "text-slate-500")} />
                              {unreadAlerts > 0 ? (
                                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-blue-600" />
                              ) : null}
                            </div>
                            Alerts
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMobileMenuOpen(false);
                              navigate(createPageUrl('Search'));
                            }}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-4 py-3 text-sm",
                              isSearchPage
                                ? "bg-[var(--workspace-brand-soft)] font-medium text-[var(--workspace-brand-fg)]"
                                : "text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            <SearchIcon className="h-5 w-5" />
                            Search
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMobileMenuOpen(false);
                              navigate(workspaceUrl(workspace.slug, 'changelog'));
                            }}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-4 py-3 text-sm",
                              isChangelogPage
                                ? "bg-[var(--workspace-brand-soft)] font-medium text-[var(--workspace-brand-fg)]"
                                : "text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            <History className="h-5 w-5" />
                            Changelog
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMobileMenuOpen(false);
                              navigate(createPageUrl('WorkspaceSettings'));
                            }}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-4 py-3 text-sm",
                              isSettingsPage
                                ? "bg-[var(--workspace-brand-soft)] font-medium text-[var(--workspace-brand-fg)]"
                                : "text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            <Settings className="h-5 w-5" />
                            Settings
                          </button>
                        </div>
                      </>
                    )}
                    
                    <div className="mt-auto border-t border-slate-200 pt-4">
                      <Button 
                        variant="ghost" 
                        onClick={handleLogout}
                        className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <LogOut className="h-5 w-5 mr-3" />
                        Sign Out
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <WorkspaceProvider>
          {children}
        </WorkspaceProvider>
      </main>
    </div>
  );
}
