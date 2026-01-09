import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Search, Plus, FolderOpen, FileText, MessageSquare, Edit } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import DocEditor from '@/components/docs/DocEditor';
import DocViewer from '@/components/docs/DocViewer';
import DocSidebar from '@/components/docs/DocSidebar';
import QuestionsPanel from '@/components/docs/QuestionsPanel';
import DocQueuePanel from '@/components/docs/DocQueuePanel';

export default function Docs() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [workspace, setWorkspace] = useState(null);
  const [role, setRole] = useState('viewer');
  const [docs, setDocs] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showQuestionsPanel, setShowQuestionsPanel] = useState(false);
  const [showDocQueue, setShowDocQueue] = useState(false);

  const isPublicAccess = sessionStorage.getItem('isPublicAccess') === 'true';
  const isStaff = ['support', 'admin'].includes(role) && !isPublicAccess;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    
    if (slug) {
      loadWorkspaceBySlug(slug);
    } else {
      const storedWorkspace = sessionStorage.getItem('selectedWorkspace');
      const storedRole = sessionStorage.getItem('currentRole');
      
      if (!storedWorkspace) {
        navigate(createPageUrl('Workspaces'));
        return;
      }
      
      setWorkspace(JSON.parse(storedWorkspace));
      setRole(storedRole || 'viewer');
      loadDocs();
    }
  }, []);
  
  const loadWorkspaceBySlug = async (slug) => {
    try {
      const workspaces = await base44.entities.Workspace.filter({ slug });
      if (workspaces[0]) {
        setWorkspace(workspaces[0]);
        const storedRole = sessionStorage.getItem('currentRole') || 'viewer';
        setRole(storedRole);
        loadDocs(workspaces[0].id);
      }
    } catch (error) {
      console.error('Failed to load workspace:', error);
    }
  };

  useEffect(() => {
    const docSlug = searchParams.get('doc');
    if (docSlug && docs.length > 0) {
      const doc = docs.find(d => d.slug === docSlug);
      if (doc) {
        setSelectedDoc(doc);
      }
    }
  }, [searchParams, docs]);

  const loadDocs = async (workspaceIdOverride = null) => {
    try {
      const workspaceId = workspaceIdOverride || sessionStorage.getItem('selectedWorkspaceId');
      if (!workspaceId) {
        setLoading(false);
        return;
      }
      const docPages = await base44.entities.DocPage.filter(
        { workspace_id: workspaceId, is_published: true },
        'order'
      );
      setDocs(docPages);
      
      if (!searchParams.get('doc') && docPages.length > 0) {
        const firstPage = docPages.find(d => d.type === 'page');
        if (firstPage) {
          setSelectedDoc(firstPage);
          setSearchParams({ doc: firstPage.slug });
        }
      }
    } catch (error) {
      console.error('Failed to load docs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDoc = (doc) => {
    if (doc.type === 'page') {
      setSelectedDoc(doc);
      setSearchParams({ doc: doc.slug });
      setEditing(false);
    }
  };

  const handleSave = () => {
    setEditing(false);
    loadDocs();
  };

  const filteredDocs = docs.filter(doc => 
    doc.type === 'page' && doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" text="Loading documentation..." />
      </div>
    );
  }

  return (
    <div className="flex gap-6 -mx-4 -my-8 h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-72 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="font-semibold text-slate-900">Documentation</h2>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <DocSidebar
          docs={searchQuery ? filteredDocs : docs}
          selectedDoc={selectedDoc}
          onSelect={handleSelectDoc}
          isStaff={isStaff}
          onRefresh={loadDocs}
        />

        {isStaff && (
          <div className="p-4 border-t border-slate-200 mt-auto space-y-2">
            <Button
              onClick={() => setShowQuestionsPanel(!showQuestionsPanel)}
              variant="outline"
              className="w-full"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Customer Questions
            </Button>
            <Button
              onClick={() => setShowDocQueue(!showDocQueue)}
              variant="outline"
              className="w-full"
            >
              <FileText className="h-4 w-4 mr-2" />
              Doc Queue
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {selectedDoc ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-slate-900">{selectedDoc.title}</h1>
              {isStaff && (
                <Button
                  onClick={() => setEditing(!editing)}
                  variant={editing ? 'secondary' : 'outline'}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {editing ? 'Cancel Edit' : 'Edit'}
                </Button>
              )}
            </div>

            {editing ? (
              <DocEditor doc={selectedDoc} onSave={handleSave} />
            ) : (
              <DocViewer doc={selectedDoc} onRefresh={loadDocs} />
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400">
            <div className="text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Select a doc to view</p>
            </div>
          </div>
        )}
      </div>

      {/* Questions Panel */}
      {showQuestionsPanel && isStaff && (
        <QuestionsPanel
          workspaceId={workspace?.id}
          onClose={() => setShowQuestionsPanel(false)}
        />
      )}

      {/* Doc Queue Panel */}
      {showDocQueue && isStaff && (
        <DocQueuePanel
          workspaceId={workspace?.id}
          docs={docs}
          onClose={() => setShowDocQueue(false)}
          onRefresh={loadDocs}
        />
      )}
    </div>
  );
}