import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Folder, LogOut, User, ChevronDown, Settings, Key, 
  MessageSquareText, Map, HeadphonesIcon, Menu, X, Sparkles, ArrowLeft, BookOpen 
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
import { cn } from '@/lib/utils';
import { BoardProvider } from '@/components/context/BoardContext';

const navItems = [
  { name: 'Feedback', icon: MessageSquareText, page: 'Feedback' },
  { name: 'Roadmap', icon: Map, page: 'Roadmap' },
  { name: 'Changelog', icon: Sparkles, page: 'Changelog' },
  { name: 'Docs', icon: BookOpen, page: 'Docs' },
  { name: 'Support', icon: HeadphonesIcon, page: 'Support', requiresSupport: true },
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
  const [showNoAccessDialog, setShowNoAccessDialog] = useState(false);

  // Public pages that don't need auth or workspace context
  const publicPages = ['Home', 'About', 'Pricing'];
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
  }, [currentPageName, location.search]);

  const loadContext = async () => {
    // NEW FLOW: Context is set by Board router via sessionStorage
    // We just read it here for layout rendering
    
    // Try to authenticate
    let currentUser = null;
    let isAuthenticated = false;
    
    try {
      currentUser = await base44.auth.me();
      setUser(currentUser);
      isAuthenticated = true;
    } catch (error) {
      // User not authenticated
      isAuthenticated = false;
    }

    if (needsWorkspace) {
      // Read workspace context from sessionStorage (set by Board router)
      const storedWorkspace = sessionStorage.getItem('selectedWorkspace');
      const storedRole = sessionStorage.getItem('currentRole');
      const storedIsPublicAccess = sessionStorage.getItem('isPublicAccess') === 'true';
      
      if (!storedWorkspace) {
        // No workspace context - redirect to home or workspaces
        if (isAuthenticated) {
          navigate(createPageUrl('Workspaces'));
        } else {
          navigate(createPageUrl('Home'));
        }
        return;
      }
      
      const targetWorkspace = JSON.parse(storedWorkspace);
      setWorkspace(targetWorkspace);
      setRole(storedRole || 'viewer');
      setIsPublicViewing(storedIsPublicAccess);
      
      if (storedIsPublicAccess) {
        setNoAccessMessage('You don\'t have permission to contribute to this board. Contact the admin to request access.');
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

  const handleWorkspaceSwitch = (ws) => {
    const role = workspaces.find(w => w.id === ws.id);
    sessionStorage.setItem('selectedWorkspaceId', ws.id);
    sessionStorage.setItem('selectedWorkspace', JSON.stringify(ws));
    setWorkspace(ws);
    window.location.reload(); // Reload to refresh role context
  };

  const handleLogout = () => {
    sessionStorage.clear();
    base44.auth.logout();
  };

  const isActive = (page) => {
    return currentPageName === page;
  };

  const isAdmin = role === 'admin' && !isPublicViewing;
  const isStaff = ['support', 'admin'].includes(role) && !isPublicViewing;

  // No layout for public pages, workspaces hub, or join page
  if (['Home', 'About', 'Pricing', 'Workspaces', 'JoinWorkspace'].includes(currentPageName)) {
    return children;
  }
  
  // Show permission error for authenticated users without access to private board
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
            View My Boards
          </Button>
        </div>
      </div>
    );
  }

  // Filter nav items based on permissions
  const visibleNavItems = navItems.filter(item => {
    // Hide support from public viewers entirely
    if (item.requiresSupport && (isPublicViewing || !workspace?.support_enabled)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo & Workspace Switcher */}
            <div className="flex items-center gap-4">
              {workspace ? (
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
                        className="cursor-pointer flex items-center"
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
                    <DropdownMenuItem asChild>
                      <Link to={createPageUrl('Workspaces')} className="cursor-pointer">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        View all boards
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg" style={{ backgroundColor: workspace?.primary_color || '#0f172a' }}>
                    <Folder className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-semibold text-slate-900">Portal</span>
                </div>
              )}

              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center gap-1 ml-6">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.page);
                  
                  return (
                    <Link
                      key={item.page}
                      to={`/board/${workspace.slug}/${item.page.toLowerCase()}`}
                      style={active ? { backgroundColor: `${workspace?.primary_color || '#0f172a'}15` } : {}}
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
                
                {isAdmin && (
                  <div className="hidden md:flex items-center gap-1">
                    <Link to={createPageUrl('ApiDocs')}>
                      <Button variant="ghost" size="sm" className="text-slate-600">
                        <Key className="h-4 w-4 mr-2" />
                        API
                      </Button>
                    </Link>
                    <Link to={createPageUrl('WorkspaceSettings')}>
                      <Button variant="ghost" size="sm" className="text-slate-600">
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </Button>
                    </Link>
                  </div>
                )}

              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-slate-200 flex items-center justify-center">
                        <User className="h-4 w-4 text-slate-600" />
                      </div>
                      <span className="hidden sm:inline text-sm text-slate-600">
                        {user.email}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <div className="px-2 py-1.5 text-xs text-slate-500">
                      Role: {role.charAt(0).toUpperCase() + role.slice(1)}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                      {visibleNavItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.page);
                        
                        return (
                          <Link
                            key={item.page}
                            to={`/board/${workspace.slug}/${item.page.toLowerCase()}`}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                              active 
                                ? 'bg-slate-100 text-slate-900' 
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                            )}
                          >
                            <Icon className="h-5 w-5" />
                            {item.name}
                          </Link>
                        );
                      })}
                    </div>
                    
                    {isAdmin && (
                      <>
                        <div className="border-t border-slate-200 pt-4 mt-2">
                          <p className="px-4 text-xs font-medium text-slate-400 uppercase mb-2">Admin</p>
                          <Link
                            to={createPageUrl('ApiDocs')}
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                          >
                            <Key className="h-5 w-5" />
                            API Documentation
                          </Link>
                          <Link
                            to={createPageUrl('WorkspaceSettings')}
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                          >
                            <Settings className="h-5 w-5" />
                            Settings
                          </Link>
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
        <BoardProvider>
          {children}
        </BoardProvider>
      </main>
    </div>
  );
}