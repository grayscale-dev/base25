import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Plus, LogOut, User, Link as LinkIcon } from 'lucide-react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import WorkspaceCard from '@/components/workspace/WorkspaceCard';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function Workspaces() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [boards, setBoards] = useState([]);
  const [boardRoles, setBoardRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joinLink, setJoinLink] = useState('');
  const [joining, setJoining] = useState(false);
  const [newBoard, setNewBoard] = useState({ name: '', slug: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [slugStatus, setSlugStatus] = useState({ checking: false, available: null, message: '' });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!newBoard.slug) {
      setSlugStatus({ checking: false, available: null, message: '' });
      return;
    }

    const handle = setTimeout(async () => {
      setSlugStatus({ checking: true, available: null, message: '' });
      try {
        const { data } = await base44.functions.invoke('checkBoardSlug', { slug: newBoard.slug });
        if (data?.available) {
          setSlugStatus({ checking: false, available: true, message: 'Slug is available' });
        } else {
          setSlugStatus({ checking: false, available: false, message: 'Slug is already in use' });
        }
      } catch (error) {
        console.error('Failed to check slug:', error);
        setSlugStatus({ checking: false, available: null, message: 'Unable to check slug' });
      }
    }, 400);

    return () => clearTimeout(handle);
  }, [newBoard.slug]);

  const loadData = async () => {
    try {
      // Ensure user is authenticated
      let currentUser;
      try {
        currentUser = await base44.auth.me();
      } catch (error) {
        // Not authenticated, redirect to login
        base44.auth.redirectToLogin(window.location.origin + createPageUrl('Workspaces'));
        return;
      }
      
      setUser(currentUser);

      // Load board roles
      const roles = await base44.entities.BoardRole.filter({ 
        user_id: currentUser.id 
      });
      setBoardRoles(roles);

      if (roles.length > 0) {
        const boardIds = [...new Set(roles.map(r => r.board_id).filter(Boolean))];
        const boardsData = await Promise.all(
          boardIds.map(async (id) => {
            const results = await base44.entities.Board.filter({ id });
            return results[0];
          })
        );
        const activeBoards = boardsData.filter(board => board && board.status === 'active');
        setBoards(activeBoards);
      }
    } catch (error) {
      console.error('Failed to load boards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBoard = (board) => {
    // Store selected board and navigate to canonical board route
    const role = boardRoles.find(r => r.board_id === board.id);
    sessionStorage.setItem('selectedBoardId', board.id);
    sessionStorage.setItem('selectedBoard', JSON.stringify(board));
    sessionStorage.setItem('currentRole', role?.role || 'viewer');
    navigate(`/board/${board.slug}/feedback`);
  };

  const handleJoinBoard = async () => {
    if (!joinLink.trim()) return;

    setJoining(true);
    try {
      // Parse the join link to extract workspace slug
      let slug;
      
      // Handle full URL or just slug
      if (joinLink.includes('board=')) {
        const url = new URL(joinLink);
        slug = url.searchParams.get('board');
      } else if (joinLink.startsWith('http')) {
        const url = new URL(joinLink);
        slug = url.searchParams.get('board');
      } else {
        // Assume it's just a slug
        slug = joinLink.trim();
      }

      if (!slug) {
        alert('Invalid join link or code');
        setJoining(false);
        return;
      }

      // Navigate to join page
      navigate(createPageUrl('JoinWorkspace') + `?board=${slug}`);
    } catch (error) {
      console.error('Failed to parse join link:', error);
      alert('Invalid join link format');
      setJoining(false);
    }
  };

  const handleCreateBoard = async () => {
    if (!newBoard.name || !newBoard.slug) return;
    
    setCreating(true);
    try {
      const { data: board } = await base44.functions.invoke('createBoard', {
        name: newBoard.name,
        slug: newBoard.slug,
        description: newBoard.description,
        visibility: 'restricted',
        support_enabled: true
      });

      setShowCreateModal(false);
      setNewBoard({ name: '', slug: '', description: '' });
      loadData();
    } catch (error) {
      console.error('Failed to create board:', error);
      alert('Failed to create board. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.clear();
    base44.auth.logout();
  };

  const getRoleForBoard = (boardId) => {
    const role = boardRoles.find(r => r.board_id === boardId);
    return role?.role || 'viewer';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading your boards..." />
      </div>
    );
  }

  return (
    <ProtectedRoute>
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
              <img 
                src="/base25-logo.png" 
                alt="Nexus" 
                className="h-8 w-8 object-contain"
              />
              <span className="text-lg font-semibold text-slate-900">nexus</span>
            </div>
          
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <User className="h-4 w-4" />
                <span>{user.email}</span>
              </div>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-slate-600"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Actions */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Your Boards
              </h1>
              <p className="text-slate-500">
                {boards.length > 0 
                  ? `You have access to ${boards.length} board${boards.length === 1 ? '' : 's'}`
                  : 'Join or create a board to get started'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button 
              onClick={() => setShowJoinModal(true)}
              size="lg"
              className="bg-slate-900 hover:bg-slate-800"
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Join a Board
            </Button>
            <Button 
              onClick={() => setShowCreateModal(true)}
              size="lg"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create a Board
            </Button>
          </div>
        </div>

        {/* Boards Grid */}
        {boards.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {boards.map((board) => (
              <WorkspaceCard
                key={board.id}
                workspace={board}
                role={getRoleForBoard(board.id)}
                onClick={() => handleSelectBoard(board)}
              />
            ))}
          </div>
        )}

        {/* Join Board Modal */}
        <Dialog open={showJoinModal} onOpenChange={setShowJoinModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Join a Board</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Invite Link or Code</Label>
                <Input
                  value={joinLink}
                  onChange={(e) => setJoinLink(e.target.value)}
                  placeholder="Paste invite link or enter board code"
                  className="mt-1.5"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleJoinBoard();
                  }}
                />
                <p className="text-xs text-slate-500 mt-2">
                  Example: board-slug or full URL
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setShowJoinModal(false);
                    setJoinLink('');
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleJoinBoard}
                  disabled={!joinLink.trim() || joining}
                  className="bg-slate-900 hover:bg-slate-800"
                >
                  {joining ? 'Joining...' : 'Continue'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Board Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Board</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Board Name</Label>
                <Input
                  value={newBoard.name}
                  onChange={(e) => setNewBoard({ ...newBoard, name: e.target.value })}
                  placeholder="e.g., Product Feedback"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Slug (URL-friendly)</Label>
                <Input
                  value={newBoard.slug}
                  onChange={(e) => setNewBoard({ ...newBoard, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="e.g., product-feedback"
                  className="mt-1.5"
                />
                {slugStatus.message && (
                  <p className={`text-xs mt-2 ${slugStatus.available === false ? 'text-red-600' : 'text-slate-500'}`}>
                    {slugStatus.checking ? 'Checking...' : slugStatus.message}
                  </p>
                )}
              </div>
              <div>
                <Label>Description (Optional)</Label>
                <Textarea
                  value={newBoard.description}
                  onChange={(e) => setNewBoard({ ...newBoard, description: e.target.value })}
                  placeholder="Brief description of this board"
                  className="mt-1.5"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateBoard}
                  disabled={!newBoard.name || !newBoard.slug || creating || slugStatus.available === false || slugStatus.checking}
                  className="bg-slate-900 hover:bg-slate-800"
                >
                  {creating ? 'Creating...' : 'Create Board'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
    </ProtectedRoute>
  );
}
