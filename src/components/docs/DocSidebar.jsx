import { useState } from 'react';
import { FolderOpen, FileText, Plus, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

export default function DocSidebar({ docs, selectedDoc, onSelect, isStaff, onRefresh }) {
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newDoc, setNewDoc] = useState({
    title: '',
    slug: '',
    type: 'page',
    parent_id: ''
  });

  const toggleDir = (dirId) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(dirId)) {
      newExpanded.delete(dirId);
    } else {
      newExpanded.add(dirId);
    }
    setExpandedDirs(newExpanded);
  };

  const handleCreate = async () => {
    if (!newDoc.title || !newDoc.slug) return;

    setCreating(true);
    try {
      const workspaceId = sessionStorage.getItem('selectedBoardId');
      await base44.entities.DocPage.create({
        board_id: workspaceId,
        title: newDoc.title,
        slug: newDoc.slug,
        type: newDoc.type,
        parent_id: newDoc.parent_id || null,
        content: newDoc.type === 'page' ? '# ' + newDoc.title : '',
        content_type: 'markdown',
        is_published: true,
        order: 0
      });

      setShowCreateModal(false);
      setNewDoc({ title: '', slug: '', type: 'page', parent_id: '' });
      onRefresh();
    } catch (error) {
      console.error('Failed to create doc:', error);
    } finally {
      setCreating(false);
    }
  };

  const directories = docs.filter(d => d.type === 'directory');
  const rootPages = docs.filter(d => d.type === 'page' && !d.parent_id);

  const getChildPages = (parentId) => {
    return docs.filter(d => d.type === 'page' && d.parent_id === parentId);
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {rootPages.map(doc => (
            <button
              key={doc.id}
              onClick={() => onSelect(doc)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                selectedDoc?.id === doc.id
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              <FileText className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{doc.title}</span>
            </button>
          ))}

          {directories.map(dir => {
            const isExpanded = expandedDirs.has(dir.id);
            const childPages = getChildPages(dir.id);

            return (
              <div key={dir.id}>
                <button
                  onClick={() => toggleDir(dir.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  )}
                  <FolderOpen className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{dir.title}</span>
                </button>

                {isExpanded && (
                  <div className="ml-6 space-y-1 mt-1">
                    {childPages.map(page => (
                      <button
                        key={page.id}
                        onClick={() => onSelect(page)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                          selectedDoc?.id === page.id
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-slate-700 hover:bg-slate-50'
                        )}
                      >
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{page.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isStaff && docs.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-slate-500 mb-3">No docs yet</p>
            <Button onClick={() => setShowCreateModal(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create First Doc
            </Button>
          </div>
        )}
      </div>

      {isStaff && docs.length > 0 && (
        <div className="p-4 border-t border-slate-200">
          <Button
            onClick={() => setShowCreateModal(true)}
            size="sm"
            className="w-full"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Doc
          </Button>
        </div>
      )}

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Documentation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select value={newDoc.type} onValueChange={(val) => setNewDoc({ ...newDoc, type: val })}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="page">Page</SelectItem>
                  <SelectItem value="directory">Directory</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Title</Label>
              <Input
                value={newDoc.title}
                onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                placeholder="Getting Started"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Slug</Label>
              <Input
                value={newDoc.slug}
                onChange={(e) => setNewDoc({ ...newDoc, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                placeholder="getting-started"
                className="mt-1.5"
              />
            </div>

            {directories.length > 0 && (
              <div>
                <Label>Parent Directory (Optional)</Label>
                <Select value={newDoc.parent_id} onValueChange={(val) => setNewDoc({ ...newDoc, parent_id: val })}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Root level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Root level</SelectItem>
                    {directories.map(dir => (
                      <SelectItem key={dir.id} value={dir.id}>{dir.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={!newDoc.title || !newDoc.slug || creating}
                className="bg-slate-900 hover:bg-slate-800"
              >
                {creating ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}