import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Calendar, Plus, Map } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { boardUrl } from '@/components/utils/boardUrl';
import { format } from 'date-fns';
import Badge from '@/components/common/Badge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import LinksPanel from '@/components/common/LinksPanel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function Changelog() {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [role, setRole] = useState('viewer');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [newEntry, setNewEntry] = useState({
    title: '',
    description: '',
    release_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    // Context is set by Board router via sessionStorage
    const storedWorkspace = sessionStorage.getItem('selectedBoard');
    const storedRole = sessionStorage.getItem('currentRole');
    
    if (!storedWorkspace) {
      navigate(createPageUrl('Home'));
      return;
    }
    
    setWorkspace(JSON.parse(storedWorkspace));
    setRole(storedRole || 'viewer');
    loadChangelog();
  }, []);

  const loadChangelog = async (workspaceIdOverride = null) => {
    try {
      const workspaceId = workspaceIdOverride || sessionStorage.getItem('selectedBoardId');
      if (!workspaceId) {
        setLoading(false);
        return;
      }
      const changelogEntries = await base44.entities.ChangelogEntry.filter(
        { board_id: workspaceId, visibility: 'public' },
        '-release_date'
      );

      // Load linked roadmap items and feedback types
      const entriesWithLinks = await Promise.all(
        changelogEntries.map(async (entry) => {
          let roadmapItem = null;
          let feedbackType = null;

          if (entry.roadmap_item_id) {
            const items = await base44.entities.RoadmapItem.filter({ id: entry.roadmap_item_id });
            roadmapItem = items[0];

            if (roadmapItem) {
              // Find linked feedback to get the type
              const feedback = await base44.entities.Feedback.filter({ roadmap_item_id: roadmapItem.id });
              if (feedback.length > 0) {
                feedbackType = feedback[0].type;
              }
            }
          }

          return { ...entry, roadmapItem, feedbackType };
        })
      );

      setEntries(entriesWithLinks);
    } catch (error) {
      console.error('Failed to load changelog:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEntry = async () => {
    if (!newEntry.title || !newEntry.release_date) return;

    setCreating(true);
    try {
      const workspaceId = sessionStorage.getItem('selectedBoardId');
      const entry = await base44.entities.ChangelogEntry.create({
        board_id: workspaceId,
        title: newEntry.title,
        description: newEntry.description,
        release_date: newEntry.release_date,
        visibility: 'public'
      });

      // Add to doc queue
      await base44.entities.DocQueue.create({
        board_id: workspaceId,
        changelog_entry_id: entry.id,
        title: newEntry.title,
        status: 'pending',
        doc_page_ids: []
      });

      setShowCreateModal(false);
      setNewEntry({
        title: '',
        description: '',
        release_date: new Date().toISOString().split('T')[0]
      });
      loadChangelog();
    } catch (error) {
      console.error('Failed to create changelog entry:', error);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" text="Loading changelog..." />
      </div>
    );
  }

  const isPublicAccess = sessionStorage.getItem('isPublicAccess') === 'true';
  const isAdmin = role === 'admin' && !isPublicAccess;

  return (
    <div className="space-y-6">
      {isPublicAccess && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <p className="text-blue-900">
            👀 Viewing changelog in read-only mode. <button onClick={() => base44.auth.redirectToLogin(window.location.href)} className="underline font-medium">Login</button> to access more features.
          </p>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Changelog</h1>
          <p className="text-slate-500 mt-1">See what's new and improved</p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setShowCreateModal(true)}
            style={{ backgroundColor: workspace?.primary_color || '#0f172a' }}
            className="hover:opacity-90 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        )}
      </div>

      {/* Changelog Entries */}
      {entries.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No releases yet"
          description="Check back later for updates on what we've shipped!"
        />
      ) : (
        <div className="space-y-8">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow"
            >
              {/* Date */}
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(entry.release_date), 'MMMM d, yyyy')}</span>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-slate-900 mb-3">
                {entry.title}
              </h2>

              {/* Description */}
              <p className="text-slate-600 leading-relaxed mb-4">
                {entry.description}
              </p>

              {/* Links Panel */}
              <LinksPanel
                workspaceId={workspace?.id}
                workspaceSlug={workspace?.slug}
                itemType="changelog"
                itemId={entry.id}
                links={{
                  roadmap_item_ids: entry.roadmap_item_ids || [],
                  feedback_ids: entry.feedback_ids || [],
                  doc_page_ids: entry.doc_page_ids || [],
                  support_thread_ids: entry.support_thread_ids || []
                }}
                onUpdate={loadChangelog}
                isStaff={isAdmin}
              />
            </div>
          ))}
        </div>
      )}

      {/* Create Entry Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Changelog Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={newEntry.title}
                onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                placeholder="What's new?"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newEntry.description}
                onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                placeholder="Describe what changed..."
                className="mt-1.5 h-32"
              />
            </div>
            <div>
              <Label>Release Date</Label>
              <Input
                type="date"
                value={newEntry.release_date}
                onChange={(e) => setNewEntry({ ...newEntry, release_date: e.target.value })}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateEntry}
              disabled={!newEntry.title || !newEntry.release_date || creating}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {creating ? 'Creating...' : 'Create Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}