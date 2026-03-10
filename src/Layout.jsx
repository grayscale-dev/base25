import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from '@/lib/router';
import Link from '@/components/common/AppLink';
import { 
  Folder, LogOut, ChevronDown, Settings,
  LayoutDashboard, MessageSquare, Map, History, Menu, X, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import {
  getDefaultWorkspaceSection,
  resolveWorkspaceSection,
} from '@/lib/workspace-sections';

const adminNavItems = [
  { name: 'All', icon: LayoutDashboard, page: 'All', section: 'all' },
  { name: 'Feedback', icon: MessageSquare, page: 'Feedback', section: 'feedback' },
  { name: 'Roadmap', icon: Map, page: 'Roadmap', section: 'roadmap' },
  { name: 'Changelog', icon: History, page: 'Changelog', section: 'changelog' },
];

const memberNavItems = [
  { name: 'Feedback', icon: MessageSquare, page: 'Feedback', section: 'feedback' },
  { name: 'Roadmap', icon: Map, page: 'Roadmap', section: 'roadmap' },
  { name: 'Changelog', icon: History, page: 'Changelog', section: 'changelog' },
];

export default function Layout({ children, currentPageName }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [role, setRole] = useState('viewer');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isPublicViewing, setIsPublicViewing] = useState(false);
  const [noAccessMessage, setNoAccessMessage] = useState(null);
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
          setRole('viewer');
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
      setRole(storedRole || 'viewer');
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
    let nextRole = 'viewer';
    if (user?.id) {
      try {
        const roles = await base44.entities.WorkspaceRole.filter({
          workspace_id: ws.id,
          user_id: user.id,
        });
        nextRole = roles[0]?.role || 'viewer';
      } catch {
        nextRole = 'viewer';
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

  const isAdmin = role === 'admin' && !isPublicViewing;
  const canOpenSettings = Boolean(user && workspace && !isPublicViewing);
  const visibleNavItems = isAdmin ? adminNavItems : memberNavItems;
  const activeSection =
    resolveWorkspaceSection(pathSection || currentPageName?.toLowerCase(), role, isPublicViewing) ||
    getDefaultWorkspaceSection(role, isPublicViewing);
  const workspaceHomeSection = activeSection;
  const isActive = (section) => section === activeSection;

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
    <div className="min-h-screen bg-slate-50">
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
                        {workspace.logo_url ? (
                          <img src={workspace.logo_url} alt={workspace.name} className="h-8 w-8 object-contain rounded-lg" />
                        ) : (
                          <div className="p-1.5 rounded-lg" style={{ backgroundColor: workspace.primary_color || '#0f172a' }}>
                            <Folder className="h-4 w-4 text-white" />
                          </div>
                        )}
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
                          {workspace.logo_url ? (
                            <img src={workspace.logo_url} alt={workspace.name} className="h-8 w-8 object-contain rounded-lg" />
                          ) : (
                            <div className="p-1.5 rounded-lg" style={{ backgroundColor: workspace.primary_color || '#0f172a' }}>
                              <Folder className="h-4 w-4 text-white" />
                            </div>
                          )}
                          <span className="font-semibold text-slate-900 hidden sm:inline">
                            {workspace.name}
                          </span>
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64">
                      {workspaces.map((ws) => (
                        <DropdownMenuItem
                          key={ws.id}
                          onClick={() => handleWorkspaceSwitch(ws)}
                          className="cursor-pointer flex w-full items-center"
                        >
                          {ws.logo_url ? (
                            <img src={ws.logo_url} alt={ws.name} className="h-4 w-4 mr-2 object-contain" />
                          ) : (
                            <div className="h-4 w-4 mr-2 rounded" style={{ backgroundColor: ws.primary_color || '#0f172a' }}>
                              <Folder className="h-3 w-3 text-white" style={{ transform: 'scale(0.75)' }} />
                            </div>
                          )}
                          <span>{ws.name}</span>
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
                  <div className="p-1.5 rounded-lg" style={{ backgroundColor: workspace?.primary_color || '#0f172a' }}>
                    <Folder className="h-4 w-4 text-white" />
                  </div>
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
                        style={active ? { backgroundColor: `${workspace.primary_color || '#0f172a'}15` } : {}}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                          active 
                            ? 'text-slate-900' 
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
                    onClick={() => base44.auth.redirectToLogin(window.location.href)}
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
                
                {canOpenSettings && (
                  <div className="hidden md:flex items-center gap-1">
                    <Link to={createPageUrl('WorkspaceSettings')}>
                      <Button
                        variant="ghost"
                        className="h-auto gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
                                ? 'bg-slate-100 text-slate-900' 
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
                        <div className="border-t border-slate-200 pt-4 mt-2">
                          <p className="px-4 text-xs font-medium text-slate-400 uppercase mb-2">Settings</p>
                          <button
                            type="button"
                            onClick={() => {
                              setMobileMenuOpen(false);
                              navigate(createPageUrl('WorkspaceSettings'));
                            }}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
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
