import { useState, useEffect } from 'react';
import { Link2, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

export default function AddToRoadmapModal({ 
  isOpen, 
  onClose, 
  feedback,
  workspaceId,
  onSuccess 
}) {
  const [mode, setMode] = useState('new'); // 'new' or 'existing'
  const [existingItems, setExistingItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('planned');
  const [targetQuarter, setTargetQuarter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && feedback) {
      setTitle(feedback.title);
      setDescription(feedback.description);
      loadExistingItems();
    }
  }, [isOpen, feedback]);

  const loadExistingItems = async () => {
    try {
      const items = await base44.entities.RoadmapItem.filter({ workspace_id: workspaceId });
      setExistingItems(items);
    } catch (error) {
      console.error('Failed to load roadmap items:', error);
    }
  };

  const handleSave = async () => {
    if (!feedback) return;
    
    setSaving(true);
    try {
      let roadmapItemId;

      if (mode === 'new') {
        // Create new roadmap item
        const newItem = await base44.entities.RoadmapItem.create({
          workspace_id: workspaceId,
          title,
          description,
          status,
          target_quarter: targetQuarter,
          linked_feedback_ids: [feedback.id],
          display_order: 0,
          visibility: 'public',
        });
        roadmapItemId = newItem.id;
      } else {
        // Link to existing item
        roadmapItemId = selectedItemId;
        const existingItem = existingItems.find(i => i.id === selectedItemId);
        if (existingItem) {
          const currentLinks = existingItem.linked_feedback_ids || [];
          if (!currentLinks.includes(feedback.id)) {
            await base44.entities.RoadmapItem.update(selectedItemId, {
              linked_feedback_ids: [...currentLinks, feedback.id]
            });
          }
        }
      }

      // Update feedback with roadmap link
      await base44.entities.Feedback.update(feedback.id, {
        roadmap_item_id: roadmapItemId,
        status: 'planned'
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to add to roadmap:', error);
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = existingItems.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const quarters = ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to Roadmap</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <RadioGroup value={mode} onValueChange={setMode} className="flex gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="new" id="new" />
              <Label htmlFor="new" className="cursor-pointer">Create new item</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="existing" id="existing" />
              <Label htmlFor="existing" className="cursor-pointer">Link to existing</Label>
            </div>
          </RadioGroup>

          {mode === 'new' ? (
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Target Quarter</Label>
                  <Select value={targetQuarter} onValueChange={setTargetQuarter}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {quarters.map(q => (
                        <SelectItem key={q} value={q}>{q}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search roadmap items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className={cn(
                      'p-3 rounded-lg border cursor-pointer transition-colors',
                      selectedItemId === item.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {item.status} {item.target_quarter && `• ${item.target_quarter}`}
                    </p>
                  </div>
                ))}
                {filteredItems.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No roadmap items found
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button 
              onClick={handleSave}
              disabled={(mode === 'new' && !title) || (mode === 'existing' && !selectedItemId) || saving}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {saving ? 'Saving...' : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  {mode === 'new' ? 'Create & Link' : 'Link to Roadmap'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}