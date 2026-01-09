import { useState, useEffect } from 'react';
import { X, Calendar, MessageSquare, Plus, Edit2, Trash2, Send, Sparkles } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { boardUrl } from '@/components/utils/boardUrl';
import LinksPanel from '@/components/common/LinksPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Badge from '@/components/common/Badge';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { useProfileGuard } from '@/components/auth/useProfileGuard';

export default function RoadmapItemModal({ 
  item, 
  updates = [],
  isOpen, 
  onClose, 
  isStaff,
  workspaceId,
  workspaceSlug,
  onSave,
  linkedFeedback = []
}) {
  const { guardAction, ProfileGuard } = useProfileGuard();
  const isNew = !item?.id;
  const [editing, setEditing] = useState(isNew);
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [status, setStatus] = useState(item?.status || 'planned');
  const [targetQuarter, setTargetQuarter] = useState(item?.target_quarter || '');
  const [updateContent, setUpdateContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [postingUpdate, setPostingUpdate] = useState(false);
  const [addToChangelog, setAddToChangelog] = useState(false);
  const [changelogEntry, setChangelogEntry] = useState(null);

  useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setDescription(item.description || '');
      setStatus(item.status || 'planned');
      setTargetQuarter(item.target_quarter || '');
      loadChangelogEntry();
    }
    setEditing(isNew);
    setAddToChangelog(false);
  }, [item, isNew]);

  const loadChangelogEntry = async () => {
    if (!item?.id) return;
    try {
      const entries = await base44.entities.ChangelogEntry.filter({
        roadmap_item_id: item.id
      });
      if (entries.length > 0) {
        setChangelogEntry(entries[0]);
      }
    } catch (error) {
      console.error('Failed to load changelog:', error);
    }
  };

  const handleSave = async () => {
    if (!title) return;
    
    setSaving(true);
    try {
      if (isNew) {
        // Use backend function to enforce auth + role + NAME_REQUIRED
        await base44.functions.invoke('createRoadmapItem', {
          workspace_id: workspaceId,
          title,
          description,
          status,
          target_quarter: targetQuarter,
          visibility: 'public',
        });
      } else {
        // Use backend function to enforce auth + role + NAME_REQUIRED
        await base44.functions.invoke('updateRoadmapItem', {
          item_id: item.id,
          workspace_id: workspaceId,
          updates: {
            title,
            description,
            status,
            target_quarter: targetQuarter,
          }
        });
        
        // If checkbox is checked and status is shipped, create changelog entry
        if (status === 'shipped' && addToChangelog) {
          const entry = await base44.entities.ChangelogEntry.create({
            workspace_id: workspaceId,
            roadmap_item_id: item.id,
            title,
            description,
            release_date: new Date().toISOString().split('T')[0],
            tags: item.tags || [],
            visibility: 'public'
          });

          // Add to doc queue
          await base44.entities.DocQueue.create({
            workspace_id: workspaceId,
            changelog_entry_id: entry.id,
            title,
            status: 'pending',
            doc_page_ids: []
          });
        }
      }
      onSave?.();
      onClose();
    } catch (error) {
      console.error('Failed to save:', error);
      if (error.response?.data?.code === 'NAME_REQUIRED') {
        alert('Please set your display name before creating or editing roadmap items.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePostUpdate = async () => {
    if (!updateContent.trim() || !item?.id) return;
    
    setPostingUpdate(true);
    try {
      await guardAction(async () => {
        // Use backend function to enforce auth + role + NAME_REQUIRED
        await base44.functions.invoke('createRoadmapUpdate', {
          roadmap_item_id: item.id,
          workspace_id: workspaceId,
          content: updateContent,
          update_type: 'progress',
        });
        setUpdateContent('');
        onSave?.();
      });
    } catch (error) {
      if (error.message !== 'Profile completion cancelled') {
        console.error('Failed to post update:', error);
      }
    } finally {
      setPostingUpdate(false);
    }
  };

  const handleDelete = async () => {
    if (!item?.id || !confirm('Are you sure you want to delete this item?')) return;
    
    try {
      await base44.entities.RoadmapItem.delete(item.id);
      onSave?.();
      onClose();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const quarters = ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'];

  return (
    <>
      <ProfileGuard />
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{isNew ? 'New Roadmap Item' : (editing ? 'Edit Item' : item?.title)}</span>
            {!isNew && isStaff && !editing && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {editing ? (
            <>
              <div>
                <Label className="text-sm font-medium">Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Feature or improvement name"
                  className="mt-1.5"
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium">Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this item includes..."
                  className="mt-1.5 min-h-[100px]"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="shipped">Shipped</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Target Quarter</Label>
                  <Select value={targetQuarter} onValueChange={setTargetQuarter}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select quarter" />
                    </SelectTrigger>
                    <SelectContent>
                      {quarters.map(q => (
                        <SelectItem key={q} value={q}>{q}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {status === 'shipped' && isStaff && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                  <input
                    type="checkbox"
                    id="addToChangelog"
                    checked={addToChangelog}
                    onChange={(e) => setAddToChangelog(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <label htmlFor="addToChangelog" className="text-sm text-green-900 cursor-pointer">
                    Add to Changelog when saving
                  </label>
                </div>
              )}
              
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="ghost" onClick={() => isNew ? onClose() : setEditing(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={!title || saving}
                  style={{ backgroundColor: JSON.parse(sessionStorage.getItem('selectedWorkspace') || '{}').primary_color || '#0f172a' }}
                  className="hover:opacity-90 text-white"
                >
                  {saving ? 'Saving...' : (isNew ? 'Create Item' : 'Save Changes')}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* View mode */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Badge 
                    variant={
                      status === 'shipped' ? 'success' : 
                      status === 'in_progress' ? 'primary' : 
                      'default'
                    }
                  >
                    {status === 'in_progress' ? 'In Progress' : 
                     status.charAt(0).toUpperCase() + status.slice(1)}
                  </Badge>
                  {item?.target_quarter && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {item.target_quarter}
                    </Badge>
                  )}
                </div>
                
                {item?.description && (
                  <p className="text-slate-600 whitespace-pre-wrap">{item.description}</p>
                )}
              </div>

              {/* Links Panel */}
              {item && (
                <LinksPanel
                  workspaceId={workspaceId}
                  workspaceSlug={workspaceSlug || JSON.parse(sessionStorage.getItem('selectedWorkspace') || '{}').slug}
                  itemType="roadmap"
                  itemId={item.id}
                  links={{
                    feedback_ids: item.linked_feedback_ids || [],
                    changelog_entry_ids: item.changelog_entry_ids || [],
                    doc_page_ids: item.doc_page_ids || []
                  }}
                  onUpdate={onSave}
                  isStaff={isStaff}
                />
              )}

              {/* Updates */}
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-3">Updates</h4>
                <div className="space-y-3 mb-4">
                  {updates.map((update) => (
                    <div key={update.id} className="p-3 bg-blue-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-blue-600 font-medium">
                          {format(new Date(update.created_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{update.content}</p>
                    </div>
                  ))}
                  {updates.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">No updates yet</p>
                  )}
                </div>
                
                {isStaff && (
                  <div className="space-y-2">
                    <Textarea
                      value={updateContent}
                      onChange={(e) => setUpdateContent(e.target.value)}
                      placeholder="Post an update..."
                      className="min-h-[80px]"
                    />
                    <div className="flex justify-end">
                      <Button 
                        onClick={handlePostUpdate}
                        disabled={!updateContent.trim() || postingUpdate}
                        size="sm"
                        style={{ backgroundColor: JSON.parse(sessionStorage.getItem('selectedWorkspace') || '{}').primary_color || '#0f172a' }}
                        className="hover:opacity-90 text-white"
                      >
                        <Send className="h-4 w-4 mr-1" />
                        {postingUpdate ? 'Posting...' : 'Post Update'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        </DialogContent>
      </Dialog>
    </>
  );
}