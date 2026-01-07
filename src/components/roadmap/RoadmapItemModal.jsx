import { useState, useEffect } from 'react';
import { X, Calendar, MessageSquare, Plus, Edit2, Trash2, Send } from 'lucide-react';
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

export default function RoadmapItemModal({ 
  item, 
  updates = [],
  isOpen, 
  onClose, 
  isStaff,
  workspaceId,
  onSave,
  linkedFeedback = []
}) {
  const isNew = !item?.id;
  const [editing, setEditing] = useState(isNew);
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [status, setStatus] = useState(item?.status || 'planned');
  const [targetQuarter, setTargetQuarter] = useState(item?.target_quarter || '');
  const [updateContent, setUpdateContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [postingUpdate, setPostingUpdate] = useState(false);

  useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setDescription(item.description || '');
      setStatus(item.status || 'planned');
      setTargetQuarter(item.target_quarter || '');
    }
    setEditing(isNew);
  }, [item, isNew]);

  const handleSave = async () => {
    if (!title) return;
    
    setSaving(true);
    try {
      if (isNew) {
        await base44.entities.RoadmapItem.create({
          workspace_id: workspaceId,
          title,
          description,
          status,
          target_quarter: targetQuarter,
          display_order: 0,
          visibility: 'public',
        });
      } else {
        const oldStatus = item.status;
        await base44.entities.RoadmapItem.update(item.id, {
          title,
          description,
          status,
          target_quarter: targetQuarter,
        });
        
        // If status changed to "shipped", create changelog entry
        if (oldStatus !== 'shipped' && status === 'shipped') {
          await base44.entities.ChangelogEntry.create({
            workspace_id: workspaceId,
            roadmap_item_id: item.id,
            title,
            description,
            release_date: new Date().toISOString().split('T')[0],
            tags: item.tags || [],
            visibility: 'public'
          });
        }
      }
      onSave?.();
      onClose();
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  const handlePostUpdate = async () => {
    if (!updateContent.trim() || !item?.id) return;
    
    setPostingUpdate(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.RoadmapUpdate.create({
        roadmap_item_id: item.id,
        workspace_id: workspaceId,
        content: updateContent,
        author_id: user.id,
        update_type: 'progress',
      });
      setUpdateContent('');
      onSave?.();
    } catch (error) {
      console.error('Failed to post update:', error);
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
              
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="ghost" onClick={() => isNew ? onClose() : setEditing(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={!title || saving}
                  className="bg-slate-900 hover:bg-slate-800"
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

              {/* Linked Feedback */}
              {linkedFeedback.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Linked Feedback</h4>
                  <div className="space-y-2">
                    {linkedFeedback.map(fb => (
                      <div key={fb.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                        <MessageSquare className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-600">{fb.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
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
                        className="bg-slate-900 hover:bg-slate-800"
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
  );
}