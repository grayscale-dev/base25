import { useState, useEffect } from 'react';
import { Link2, Plus, X, MessageSquare, Map, Sparkles, BookOpen, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { boardUrl, buildQuery } from '@/components/utils/boardUrl';

const linkTypeConfig = {
  feedback: { icon: MessageSquare, label: 'Feedback', color: 'text-blue-600', page: 'Feedback', param: 'id' },
  roadmap: { icon: Map, label: 'Roadmap', color: 'text-purple-600', page: 'Roadmap', param: 'item' },
  changelog: { icon: Sparkles, label: 'Changelog', color: 'text-green-600', page: 'Changelog', param: 'entry' },
  docs: { icon: BookOpen, label: 'Docs', color: 'text-orange-600', page: 'Docs', param: 'doc' },
  support: { icon: MessageSquare, label: 'Support', color: 'text-red-600', page: 'Support', param: 'thread' }
};

export default function LinksPanel({ 
  workspaceId,
  workspaceSlug,
  itemType, // 'feedback', 'roadmap', 'changelog', 'docs'
  itemId,
  links, // { feedback_ids: [], roadmap_item_ids: [], changelog_entry_ids: [], doc_page_ids: [] }
  onUpdate,
  isStaff 
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [linkType, setLinkType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [availableItems, setAvailableItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [linkedData, setLinkedData] = useState({});
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadLinkedData();
  }, [links]);

  const loadLinkedData = async () => {
    const data = {};
    
    const feedbackIds = links?.feedback_ids?.filter(Boolean) || [];
    if (feedbackIds.length) {
      const items = await Promise.all(
        feedbackIds.map(id => base44.entities.Feedback.filter({ id }).then(r => r[0]))
      );
      data.feedback = items.filter(Boolean);
    }
    
    const roadmapIds = links?.roadmap_item_ids?.filter(Boolean) || [];
    if (roadmapIds.length) {
      const items = await Promise.all(
        roadmapIds.map(id => base44.entities.RoadmapItem.filter({ id }).then(r => r[0]))
      );
      data.roadmap = items.filter(Boolean);
    }
    
    const changelogIds = links?.changelog_entry_ids?.filter(Boolean) || [];
    if (changelogIds.length) {
      const items = await Promise.all(
        changelogIds.map(id => base44.entities.ChangelogEntry.filter({ id }).then(r => r[0]))
      );
      data.changelog = items.filter(Boolean);
    }
    
    const docPageIds = links?.doc_page_ids?.filter(Boolean) || [];
    if (docPageIds.length) {
      const items = await Promise.all(
        docPageIds.map(id => base44.entities.DocPage.filter({ id }).then(r => r[0]))
      );
      data.docs = items.filter(Boolean);
    }
    
    const supportThreadIds = links?.support_thread_ids?.filter(Boolean) || [];
    if (supportThreadIds.length) {
      const items = await Promise.all(
        supportThreadIds.map(id => base44.entities.SupportThread.filter({ id }).then(r => r[0]))
      );
      data.support = items.filter(Boolean);
    }
    
    setLinkedData(data);
  };

  const handleOpenAddModal = (type) => {
    setLinkType(type);
    setSearchQuery('');
    setSelectedItems([]);
    loadAvailableItems(type);
    setShowAddModal(true);
  };

  const loadAvailableItems = async (type) => {
    let items = [];
    switch(type) {
      case 'feedback':
        items = await base44.entities.Feedback.filter({ board_id: workspaceId }, '-created_date');
        break;
      case 'roadmap':
        items = await base44.entities.RoadmapItem.filter({ board_id: workspaceId }, 'display_order');
        break;
      case 'changelog':
        items = await base44.entities.ChangelogEntry.filter({ board_id: workspaceId }, '-release_date');
        break;
      case 'docs':
        items = await base44.entities.DocPage.filter({ board_id: workspaceId, type: 'page' }, 'order');
        break;
      case 'support':
        items = await base44.entities.SupportThread.filter({ board_id: workspaceId }, '-created_date');
        items = items.map(t => ({ ...t, title: t.subject }));
        break;
    }
    setAvailableItems(items);
  };

  const handleAddLinks = async () => {
    if (selectedItems.length === 0) return;

    const fieldMap = {
      feedback: 'feedback_ids',
      roadmap: 'roadmap_item_ids',
      changelog: 'changelog_entry_ids',
      docs: 'doc_page_ids',
      support: 'support_thread_ids'
    };

    const field = fieldMap[linkType];
    const currentIds = links?.[field] || [];
    const newIds = [...new Set([...currentIds, ...selectedItems])].filter(Boolean);

    await updateLinks({ [field]: newIds });
    setShowAddModal(false);
    await loadLinkedData();
  };

  const handleRemoveLink = async (type, id) => {
    const fieldMap = {
      feedback: 'feedback_ids',
      roadmap: 'roadmap_item_ids',
      changelog: 'changelog_entry_ids',
      docs: 'doc_page_ids',
      support: 'support_thread_ids'
    };

    const field = fieldMap[type];
    const currentIds = links?.[field] || [];
    const newIds = currentIds.filter(i => i !== id);

    await updateLinks({ [field]: newIds });
    await loadLinkedData();
  };

  const updateLinks = async (updates) => {
    const entityMap = {
      feedback: 'Feedback',
      roadmap: 'RoadmapItem',
      changelog: 'ChangelogEntry',
      docs: 'DocPage',
      support: 'SupportThread'
    };

    await base44.entities[entityMap[itemType]].update(itemId, updates);
    onUpdate();
  };

  const filteredItems = availableItems.filter(item => {
    const title = item.title?.toLowerCase() || '';
    return title.includes(searchQuery.toLowerCase());
  });

  const hasLinks = Object.values(linkedData).some(arr => arr?.length > 0);

  return (
    <div className="mt-6 bg-slate-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
        >
          <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
          <Link2 className="h-4 w-4" />
          Related Items
          {hasLinks && (
            <span className="text-xs text-slate-500 font-normal">
              ({Object.values(linkedData).reduce((sum, arr) => sum + (arr?.length || 0), 0)})
            </span>
          )}
        </button>
        {isStaff && isExpanded && (
          <Select onValueChange={handleOpenAddModal}>
            <SelectTrigger className="w-32 h-8">
              <Plus className="h-3 w-3 mr-1" />
              Add Link
            </SelectTrigger>
            <SelectContent>
              {Object.entries(linkTypeConfig)
                .filter(([key]) => key !== itemType)
                .map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Icon className={`h-3 w-3 ${config.color}`} />
                        {config.label}
                      </div>
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
        )}
      </div>

      {isExpanded && !hasLinks && (
        <p className="text-xs text-slate-400">No linked items yet</p>
      )}

      {/* Display linked items */}
      {isExpanded && Object.entries(linkedData).map(([type, items]) => {
        if (!items?.length) return null;
        const config = linkTypeConfig[type];
        const Icon = config.icon;

        return (
          <div key={type} className="space-y-1.5">
            <p className="text-xs font-medium text-slate-500 uppercase">{config.label}</p>
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-slate-200">
                <a
                  href={boardUrl(workspaceSlug, config.page.toLowerCase(), { query: buildQuery({ [config.param]: type === 'docs' ? item.slug : item.id }) })}
                  className="flex items-center gap-2 flex-1 hover:text-slate-900 transition-colors"
                >
                  <Icon className={`h-3 w-3 ${config.color}`} />
                  <span className="text-sm text-slate-700">{item.title || item.subject}</span>
                </a>
                {isStaff && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveLink(type, item.id)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {/* Add Links Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add {linkTypeConfig[linkType]?.label} Links</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Search</Label>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items..."
                className="mt-1.5"
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-3">
              {filteredItems.map(item => (
                <label
                  key={item.id}
                  className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedItems([...selectedItems, item.id]);
                      } else {
                        setSelectedItems(selectedItems.filter(id => id !== item.id));
                      }
                    }}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-slate-700">{item.title}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button
                onClick={handleAddLinks}
                disabled={selectedItems.length === 0}
                className="bg-slate-900 hover:bg-slate-800"
              >
                Add {selectedItems.length} Link{selectedItems.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
