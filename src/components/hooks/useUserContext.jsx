import { useState, useEffect, createContext, useContext } from 'react';
import { base44 } from '@/api/base44Client';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [boards, setBoards] = useState([]);
  const [boardRoles, setBoardRoles] = useState([]);
  const [currentBoard, setCurrentBoard] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    loadUserContext();
  }, []);

  const loadUserContext = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Load board roles
      const rolesData = await base44.entities.BoardRole.filter({ 
        user_id: currentUser.id 
      });
      setBoardRoles(rolesData);

      // Load accessible boards
      if (rolesData.length > 0) {
        const boardIds = [...new Set(rolesData.map(r => r.board_id).filter(Boolean))];
        const boardsData = await Promise.all(
          boardIds.map(id => base44.entities.Board.filter({ id }))
        );
        const activeBoards = boardsData.flat().filter(board => board.status === 'active');
        setBoards(activeBoards);

        // Auto-select if only one board
        if (activeBoards.length === 1) {
          const board = activeBoards[0];
          const role = rolesData.find(r => r.board_id === board.id);
          setCurrentBoard(board);
          setCurrentRole(role?.role || 'viewer');
        }
      }

      setInitialized(true);
    } catch (error) {
      console.error('Failed to load user context:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectBoard = (board) => {
    setCurrentBoard(board);
    const role = boardRoles.find(r => r.board_id === board.id);
    setCurrentRole(role?.role || 'viewer');
  };

  const hasPermission = (permission) => {
    if (!currentRole) return false;
    
    const permissions = {
      viewer: ['view_feedback', 'view_roadmap', 'view_own_tickets'],
      contributor: ['view_feedback', 'view_roadmap', 'view_own_tickets', 'create_feedback', 'create_ticket', 'attach_files'],
      support: ['view_feedback', 'view_roadmap', 'view_own_tickets', 'create_feedback', 'create_ticket', 'attach_files', 
                'respond_feedback', 'edit_feedback_meta', 'manage_roadmap', 'manage_support'],
      admin: ['view_feedback', 'view_roadmap', 'view_own_tickets', 'create_feedback', 'create_ticket', 'attach_files',
              'respond_feedback', 'edit_feedback_meta', 'manage_roadmap', 'manage_support',
              'manage_access', 'manage_api', 'view_api_docs', 'manage_settings']
    };
    
    return permissions[currentRole]?.includes(permission) || false;
  };

  const isStaff = () => ['support', 'admin'].includes(currentRole);
  const isAdmin = () => currentRole === 'admin';

  const value = {
    user,
    boards,
    boardRoles,
    currentBoard,
    currentRole,
    loading,
    initialized,
    selectBoard,
    hasPermission,
    isStaff,
    isAdmin,
    refresh: loadUserContext
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUserContext must be used within a UserProvider');
  }
  return context;
}

export default useUserContext;
