import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import LoadingSpinner from '@/components/common/LoadingSpinner';

// Import all section components
import Feedback from './Feedback';
import Roadmap from './Roadmap';
import Changelog from './Changelog';
import Docs from './Docs';
import Support from './Support';
import WorkspaceSettings from './WorkspaceSettings';
import ApiDocs from './ApiDocs';

/**
 * Board Router
 * 
 * Matches: /board/:slug/:section
 * - Parses slug and section from URL
 * - Loads workspace and user context
 * - Renders the appropriate section component
 */
export default function Board() {
  const navigate = useNavigate();
  const { slug: routeSlug, section: routeSection } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [slug, setSlug] = useState(null);
  const [section, setSection] = useState(null);

  // Map of section names to components
  const sectionComponents = {
    feedback: Feedback,
    roadmap: Roadmap,
    changelog: Changelog,
    docs: Docs,
    support: Support,
    settings: WorkspaceSettings,
    api: ApiDocs,
  };

  useEffect(() => {
    initializeBoard(routeSlug, routeSection);
  }, [routeSlug, routeSection]);

  const initializeBoard = async (routeSlugParam, routeSectionParam) => {
    try {
      setLoading(true);
      setError(null);

      if (!routeSlugParam || !routeSectionParam) {
        setError('Invalid board URL');
        setLoading(false);
        return;
      }

      const boardSlug = routeSlugParam;
      const boardSection = routeSectionParam;

      // Validate section exists
      if (!sectionComponents[boardSection]) {
        setError(`Unknown section: ${boardSection}`);
        setLoading(false);
        return;
      }

      setSlug(boardSlug);
      setSection(boardSection);

      // Load workspace context via public endpoint
      try {
        let workspace = null;
        try {
          const { data } = await base44.functions.invoke('publicGetBoard', {
            slug: boardSlug
          });
          workspace = data;
        } catch (publicError) {
          const status = publicError?.status || publicError?.response?.status;
          if (status === 403) {
            const results = await base44.entities.Board.filter({ slug: boardSlug });
            workspace = results[0] || null;
          } else {
            throw publicError;
          }
        }

        if (!workspace) {
          setError('Board not found');
          setLoading(false);
          return;
        }

        // Try to get user role if authenticated
        let user = null;
        let role = 'viewer';
        let isPublicAccess = false;

        try {
          user = await base44.auth.me();

          // Check if user has a role in this workspace
          const roles = await base44.entities.BoardRole.filter({
            board_id: workspace.id,
            user_id: user.id
          });

          if (roles.length > 0) {
            role = roles[0].role;
            isPublicAccess = false;
          } else {
            // Authenticated but no explicit role
            role = 'viewer';
            isPublicAccess = true;
          }
        } catch (authError) {
          // Not authenticated - public access
          if (workspace.visibility !== 'public') {
            // Private workspace and not authenticated
            setError('This board is private. Please log in to access it.');
            setLoading(false);
            return;
          }
          isPublicAccess = true;
        }

        // Store workspace context in sessionStorage for layout and components
        sessionStorage.setItem('selectedBoard', JSON.stringify(workspace));
        sessionStorage.setItem('selectedBoardId', workspace.id);
        sessionStorage.setItem('currentRole', role);
        sessionStorage.setItem('isPublicAccess', isPublicAccess.toString());

        setLoading(false);
      } catch (contextError) {
        console.error('Failed to load board context:', contextError);
        setError('Failed to load board');
        setLoading(false);
      }
    } catch (error) {
      console.error('Board initialization error:', error);
      setError('An error occurred');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <LoadingSpinner size="lg" text="Loading board..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Oops!</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Render the appropriate section component
  const SectionComponent = sectionComponents[section];
  
  if (!SectionComponent) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900">Section not found</h2>
        </div>
      </div>
    );
  }

  return <SectionComponent />;
}
