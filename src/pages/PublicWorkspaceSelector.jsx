import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, ArrowLeft, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';

export default function PublicWorkspaceSelector() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mark this as public access
    sessionStorage.setItem('isPublicAccess', 'true');
    loadPublicWorkspaces();
  }, []);

  const loadPublicWorkspaces = async () => {
    try {
      // Load all public workspaces
      const allWorkspaces = await base44.entities.Workspace.filter({ 
        visibility: 'public',
        status: 'active' 
      });
      setWorkspaces(allWorkspaces);
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWorkspace = (workspace) => {
    sessionStorage.setItem('selectedWorkspaceId', workspace.id);
    sessionStorage.setItem('selectedWorkspace', JSON.stringify(workspace));
    sessionStorage.setItem('currentRole', 'viewer');
    sessionStorage.setItem('isPublicAccess', 'true');
    navigate(createPageUrl('Feedback'));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading workspaces..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-xl">
              <Folder className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-slate-900">Public Workspaces</span>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(createPageUrl('Landing'))}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg mb-4">
            <Eye className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Customer Portal - Public Access</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Select a Workspace
          </h1>
          <p className="text-slate-500">
            Browse public workspaces to view feedback, roadmap, and changelog. No login required.
          </p>
        </div>

        {workspaces.length === 0 ? (
          <EmptyState
            icon={Folder}
            title="No public workspaces"
            description="There are no public workspaces available at the moment."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => handleSelectWorkspace(workspace)}
                className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg hover:border-slate-300 transition-all text-left"
              >
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  {workspace.name}
                </h3>
                {workspace.description && (
                  <p className="text-slate-500 text-sm mb-4">
                    {workspace.description}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-full">
                    Public
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}