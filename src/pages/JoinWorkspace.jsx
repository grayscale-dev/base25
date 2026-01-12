import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Check, X, LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

export default function JoinWorkspace() {
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);
  const [alreadyMember, setAlreadyMember] = useState(false);

  useEffect(() => {
    validateAndLoadWorkspace();
  }, []);

  const validateAndLoadWorkspace = async () => {
    try {
      // Get board slug from URL
      const urlParams = new URLSearchParams(window.location.search);
      const slug = urlParams.get('board');

      if (!slug) {
        setError('Invalid join link - no board specified');
        setLoading(false);
        return;
      }

      // Check if user is authenticated
      let currentUser;
      try {
        currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (authError) {
        // Not authenticated - redirect to login and come back
        const returnUrl = window.location.pathname + window.location.search;
        base44.auth.redirectToLogin(window.location.origin + returnUrl);
        return;
      }

      // Load board
      const boards = await base44.entities.Board.filter({
        slug: slug,
        status: 'active'
      });

      if (boards.length === 0) {
        setError('Board not found or no longer active');
        setLoading(false);
        return;
      }

      const ws = boards[0];
      setBoard(ws);

      // Check if already a member
      const existingRoles = await base44.entities.BoardRole.filter({
        board_id: ws.id,
        user_id: currentUser.id
      });

      if (existingRoles.length > 0) {
        setAlreadyMember(true);
      }

      // Validate if user is allowed to join
      if (existingRoles.length === 0) {
        const canJoin = await validateJoinPermission(ws, currentUser);
        if (!canJoin) {
          setError('You do not have permission to join this board');
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to validate join:', err);
      setError('Failed to load board. Please try again.');
      setLoading(false);
    }
  };

  const validateJoinPermission = async (ws, user) => {
    // If board is public, anyone can join
    if (ws.visibility === 'public') {
      return true;
    }

    // Check if there's an explicit BoardRole assigned to this email (pre-authorized)
    const emailRoles = await base44.entities.BoardRole.filter({
      board_id: ws.id,
      email: user.email
    });

    if (emailRoles.length > 0) {
      return true;
    }

    // For rule-based access, we rely on RLS during the join attempt.
    return true;
  };

  const handleJoinWorkspace = async () => {
    if (!board || !user) return;

    setJoining(true);
    try {
      // Check if there's a pre-existing role assignment by email
      const emailRoles = await base44.entities.BoardRole.filter({
        board_id: board.id,
        email: user.email
      });

      let assignedRole = 'viewer';
      
      if (emailRoles.length > 0) {
        // Update existing role with actual user_id
        const existingRole = emailRoles[0];
        assignedRole = existingRole.role;
        await base44.entities.BoardRole.update(existingRole.id, {
          user_id: user.id
        });
      } else {
        // Create new BoardRole
        await base44.entities.BoardRole.create({
          board_id: board.id,
          user_id: user.id,
          email: user.email,
          role: 'viewer',
          assigned_via: 'explicit'
        });
      }

      // Navigate to board with their assigned role
      sessionStorage.setItem('selectedBoardId', board.id);
      sessionStorage.setItem('selectedBoard', JSON.stringify(board));
      sessionStorage.setItem('currentRole', assignedRole);
      navigate(createPageUrl('Workspaces'));
    } catch (err) {
      console.error('Failed to join board:', err);
      setError('Failed to join board. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleOpenWorkspace = () => {
    if (!board) return;

    sessionStorage.setItem('selectedBoardId', board.id);
    sessionStorage.setItem('selectedBoard', JSON.stringify(board));
    sessionStorage.setItem('currentRole', 'viewer');
    navigate(createPageUrl('Feedback'));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Validating invite...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Unable to Join</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <Button
            onClick={() => navigate(createPageUrl('Workspaces'))}
            variant="outline"
            className="w-full"
          >
            Back to Boards
          </Button>
        </div>
      </div>
    );
  }

  if (alreadyMember && board) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Already a Member</h1>
          <p className="text-slate-600 mb-2">
            You're already a member of <strong>{board.name}</strong>
          </p>
          <p className="text-sm text-slate-500 mb-6">
            You can access this board from your customer portal.
          </p>
          <div className="space-y-3">
            <Button
              onClick={handleOpenWorkspace}
              className="w-full bg-slate-900 hover:bg-slate-800"
            >
              Open Board
            </Button>
            <Button
              onClick={() => navigate(createPageUrl('Workspaces'))}
              variant="outline"
              className="w-full"
            >
              Back to Boards
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!board) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Folder className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Join Board
          </h1>
          <p className="text-slate-500">
            You've been invited to join
          </p>
        </div>

        <div className="bg-slate-50 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            {board.name}
          </h2>
          {board.description && (
            <p className="text-sm text-slate-600">
              {board.description}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleJoinWorkspace}
            disabled={joining}
            className="w-full bg-slate-900 hover:bg-slate-800"
          >
            {joining ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Join Board
              </>
            )}
          </Button>
          <Button
            onClick={() => navigate(createPageUrl('Workspaces'))}
            variant="outline"
            className="w-full"
            disabled={joining}
          >
            Cancel
          </Button>
        </div>

        <p className="text-xs text-slate-500 text-center mt-6">
          By joining, you'll be able to view feedback, roadmap, and submit your own feedback.
        </p>
      </div>
    </div>
  );
}
