import { useState, useEffect } from 'react';
import { X, CheckCircle, FileText, Plus, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

export default function DocQueuePanel({ workspaceId, docs, onClose, onRefresh }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    try {
      const items = await base44.entities.DocQueue.filter(
        { workspace_id: workspaceId },
        '-created_date'
      );
      setQueue(items);
    } catch (error) {
      console.error('Failed to load queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkExists = (item) => {
    setSelectedItem(item);
    setSelectedDocs(item.doc_page_ids || []);
    setShowLinkModal(true);
  };

  const handleSaveLinks = async () => {
    if (!selectedItem) return;

    try {
      await base44.entities.DocQueue.update(selectedItem.id, {
        status: 'docs_exist',
        doc_page_ids: selectedDocs
      });
      setShowLinkModal(false);
      setSelectedItem(null);
      setSelectedDocs([]);
      loadQueue();
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  const handleCreateDoc = (item) => {
    setSelectedItem(item);
    setNewDocTitle(item.title);
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!newDocTitle || !selectedItem) return;

    setCreating(true);
    try {
      const slug = newDocTitle.toLowerCase().replace(/\s+/g, '-');
      const doc = await base44.entities.DocPage.create({
        workspace_id: workspaceId,
        title: newDocTitle,
        slug,
        content: `# ${newDocTitle}\n\nDocumentation for this feature.`,
        content_type: 'markdown',
        is_published: true,
        type: 'page',
        order: 0
      });

      await base44.entities.DocQueue.update(selectedItem.id, {
        status: 'docs_created',
        doc_page_ids: [doc.id]
      });

      setShowCreateModal(false);
      setSelectedItem(null);
      setNewDocTitle('');
      loadQueue();
      onRefresh();
    } catch (error) {
      console.error('Failed to create doc:', error);
    } finally {
      setCreating(false);
    }
  };

  const toggleDoc = (docId) => {
    if (selectedDocs.includes(docId)) {
      setSelectedDocs(selectedDocs.filter(id => id !== docId));
    } else {
      setSelectedDocs([...selectedDocs, docId]);
    }
  };

  const pending = queue.filter(q => q.status === 'pending');
  const completed = queue.filter(q => q.status !== 'pending');

  return (
    <>
      <div className="w-96 bg-white border-l border-slate-200 flex flex-col h-full">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Documentation Queue</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Pending */}
          {pending.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3">
                Needs Documentation ({pending.length})
              </h4>
              <div className="space-y-3">
                {pending.map(item => (
                  <div key={item.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-slate-900 mb-3">{item.title}</p>
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => handleMarkExists(item)}
                        size="sm"
                        variant="outline"
                        className="w-full"
                      >
                        <LinkIcon className="h-3 w-3 mr-2" />
                        Link Existing Docs
                      </Button>
                      <Button
                        onClick={() => handleCreateDoc(item)}
                        size="sm"
                        className="w-full bg-slate-900 hover:bg-slate-800"
                      >
                        <Plus className="h-3 w-3 mr-2" />
                        Create New Doc
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3">
                Documented ({completed.length})
              </h4>
              <div className="space-y-3">
                {completed.map(item => (
                  <div key={item.id} className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-slate-900">{item.title}</p>
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    </div>
                    {item.doc_page_ids?.length > 0 && (
                      <div className="space-y-1">
                        {item.doc_page_ids.map(docId => {
                          const doc = docs.find(d => d.id === docId);
                          return doc ? (
                            <a
                              key={docId}
                              href={`${window.location.origin}${createPageUrl('Docs')}?doc=${doc.slug}`}
                              className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-900"
                            >
                              <FileText className="h-3 w-3" />
                              {doc.title}
                            </a>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {queue.length === 0 && !loading && (
            <div className="text-center py-8 text-slate-400">
              <p className="text-sm">No items in queue</p>
            </div>
          )}
        </div>
      </div>

      {/* Link Existing Docs Modal */}
      <Dialog open={showLinkModal} onOpenChange={setShowLinkModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Existing Documentation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Select which docs are related to: <strong>{selectedItem?.title}</strong>
            </p>
            <div className="max-h-64 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-3">
              {docs.filter(d => d.type === 'page').map(doc => (
                <label
                  key={doc.id}
                  className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedDocs.includes(doc.id)}
                    onChange={() => toggleDoc(doc.id)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-slate-700">{doc.title}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setShowLinkModal(false)}>Cancel</Button>
              <Button onClick={handleSaveLinks} className="bg-slate-900 hover:bg-slate-800">
                Save Links
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create New Doc Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Documentation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Doc Title</Label>
              <Input
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="Documentation title"
                className="mt-1.5"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={!newDocTitle || creating}
                className="bg-slate-900 hover:bg-slate-800"
              >
                {creating ? 'Creating...' : 'Create Doc'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}