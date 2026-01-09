import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, HeadphonesIcon, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import SupportThreadList from '@/components/support/SupportThreadList';
import SupportThreadDetail from '@/components/support/SupportThreadDetail';
import NewThreadModal from '@/components/support/NewThreadModal';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';

export default function Support() {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [role, setRole] = useState('viewer');
  const [user, setUser] = useState(null);
  const [threads, setThreads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedThread, setSelectedThread] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('all'); // 'my' or 'all' for staff

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
      
      const ws = JSON.parse(storedWorkspace);
      if (!ws.support_enabled) {
        navigate(createPageUrl('Feedback'));
        return;
      }
      
      setWorkspace(ws);
      setRole(storedRole || 'viewer');
      loadData();
    }
  }, []);
  
  const loadWorkspaceBySlug = async (slug) => {
    try {
      const workspaces = await base44.entities.Workspace.filter({ slug });
      if (workspaces[0]) {
        const ws = workspaces[0];
        if (!ws.support_enabled) {
          navigate(createPageUrl('Feedback') + `?slug=${slug}`);
          return;
        }
        setWorkspace(ws);
        const storedRole = sessionStorage.getItem('currentRole') || 'viewer';
        setRole(storedRole);
        loadData(ws.id);
      }
    } catch (error) {
      console.error('Failed to load workspace:', error);
    }
  };

  const loadData = async (workspaceIdOverride = null) => {
    try {
      // Try to get authenticated user
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        setUser(null);
      }
      
      const workspaceId = workspaceIdOverride || sessionStorage.getItem('selectedWorkspaceId');
      if (!workspaceId) {
        setLoading(false);
        return;
      }
      const storedRole = sessionStorage.getItem('currentRole');
      const isStaff = ['support', 'admin'].includes(storedRole);
      
      let threadList;
      if (isStaff) {
        threadList = await base44.entities.SupportThread.filter(
          { workspace_id: workspaceId },
          '-last_message_at'
        );
      } else {
        threadList = await base44.entities.SupportThread.filter(
          { workspace_id: workspaceId, requester_id: currentUser.id },
          '-last_message_at'
        );
      }
      setThreads(threadList);
    } catch (error) {
      console.error('Failed to load support threads:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadThreadMessages = async (threadId) => {
    const workspaceId = sessionStorage.getItem('selectedWorkspaceId');
    const threadMessages = await base44.entities.SupportMessage.filter(
      { thread_id: threadId, workspace_id: workspaceId },
      'created_date'
    );
    setMessages(threadMessages);
  };

  const handleThreadSelect = async (thread) => {
    await loadThreadMessages(thread.id);
    setSelectedThread(thread);
  };

  const handleNewThreadSuccess = (thread) => {
    loadData();
    handleThreadSelect(thread);
  };

  const handleThreadUpdate = async () => {
    await loadData();
    if (selectedThread) {
      await loadThreadMessages(selectedThread.id);
      // Refresh thread data
      const updated = threads.find(t => t.id === selectedThread.id);
      if (updated) setSelectedThread(updated);
    }
  };

  const canCreateThread = ['contributor', 'support', 'admin'].includes(role);
  const isPublicAccess = sessionStorage.getItem('isPublicAccess') === 'true';
  const isStaff = ['support', 'admin'].includes(role) && !isPublicAccess;

  // Filter threads
  const filteredThreads = threads.filter(thread => {
    // View mode filter for staff
    if (isStaff && viewMode === 'my' && thread.requester_id !== user?.id && thread.assigned_to !== user?.id) {
      return false;
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!thread.subject.toLowerCase().includes(query) && 
          !(thread.requester_email || '').toLowerCase().includes(query)) {
        return false;
      }
    }
    if (statusFilter !== 'all' && thread.status !== statusFilter) {
      return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" text="Loading support..." />
      </div>
    );
  }

  if (selectedThread) {
    return (
      <SupportThreadDetail
        thread={selectedThread}
        messages={messages}
        isStaff={isStaff}
        workspaceName={workspace?.name}
        currentUserId={user?.id}
        onBack={() => setSelectedThread(null)}
        onUpdate={handleThreadUpdate}
      />
    );
  }

  return (
    <div className="space-y-6">
      {isPublicAccess && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <p className="text-blue-900">
            👀 Viewing support in read-only mode. <button onClick={() => base44.auth.redirectToLogin(window.location.href)} className="underline font-medium">Login</button> to create requests and get help.
          </p>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isStaff ? 'Support Inbox' : 'Support'}
          </h1>
          <p className="text-slate-500 mt-1">
            {isStaff 
              ? `${filteredThreads.length} threads`
              : 'Get help from our support team'
            }
          </p>
        </div>
        {canCreateThread && (
          <Button 
            onClick={() => setShowNewModal(true)}
            style={{ backgroundColor: workspace?.primary_color || '#0f172a' }}
            className="hover:opacity-90 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        {isStaff && (
          <Tabs value={viewMode} onValueChange={setViewMode}>
            <TabsList className="bg-slate-100">
              <TabsTrigger value="my">My Threads</TabsTrigger>
              <TabsTrigger value="all">All Threads</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder={isStaff ? "Search by subject or email..." : "Search..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="awaiting_user">Awaiting User</SelectItem>
            <SelectItem value="awaiting_support">Awaiting Support</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Thread List */}
      {filteredThreads.length === 0 ? (
        <EmptyState
          icon={isStaff ? Inbox : HeadphonesIcon}
          title={threads.length === 0 ? "No support requests" : "No matching threads"}
          description={threads.length === 0 
            ? (canCreateThread ? "Create your first support request" : "No support threads yet")
            : "Try adjusting your filters"}
          action={canCreateThread && threads.length === 0 ? () => setShowNewModal(true) : undefined}
          actionLabel={canCreateThread && threads.length === 0 ? "New Request" : undefined}
        />
      ) : (
        <SupportThreadList
          threads={filteredThreads}
          onSelect={handleThreadSelect}
          isStaff={isStaff}
        />
      )}

      {/* New Thread Modal */}
      <NewThreadModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        workspaceId={workspace?.id}
        onSuccess={handleNewThreadSuccess}
      />
    </div>
  );
}