import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Calendar } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import Badge from '@/components/common/Badge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';

export default function Changelog() {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedWorkspace = sessionStorage.getItem('selectedWorkspace');
    
    if (!storedWorkspace) {
      navigate(createPageUrl('Landing'));
      return;
    }
    
    setWorkspace(JSON.parse(storedWorkspace));
    loadChangelog();
  }, []);

  const loadChangelog = async () => {
    try {
      const workspaceId = sessionStorage.getItem('selectedWorkspaceId');
      const changelogEntries = await base44.entities.ChangelogEntry.filter(
        { workspace_id: workspaceId, visibility: 'public' },
        '-release_date'
      );
      setEntries(changelogEntries);
    } catch (error) {
      console.error('Failed to load changelog:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" text="Loading changelog..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Sparkles className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Changelog</h1>
          <p className="text-slate-500 mt-1">See what's new and improved</p>
        </div>
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

              {/* Tags */}
              {entry.tags && entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {entry.tags.map((tag, idx) => (
                    <Badge key={idx} variant="outline" size="sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
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