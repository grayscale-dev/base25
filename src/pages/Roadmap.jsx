import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Map, List, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import RoadmapBoard from '@/components/roadmap/RoadmapBoard';
import RoadmapItemModal from '@/components/roadmap/RoadmapItemModal';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';

export default function Roadmap() {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [role, setRole] = useState('viewer');
  const [items, setItems] = useState([]);
  const [updates, setUpdates] = useState({});
  const [linkedFeedback, setLinkedFeedback] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newItemStatus, setNewItemStatus] = useState('planned');

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
      loadData();
    }
  }, []);
  
  const loadWorkspaceBySlug = async (slug) => {
    try {
      const workspaces = await base44.entities.Workspace.filter({ slug });
      if (workspaces[0]) {
        setWorkspace(workspaces[0]);
        const storedRole = sessionStorage.getItem('currentRole') || 'viewer';
        setRole(storedRole);
        loadData(workspaces[0].id);
      }
    } catch (error) {
      console.error('Failed to load workspace:', error);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get('item');
    if (itemId && items.length > 0) {
      const item = items.find(r => r.id === itemId);
      if (item) {
        handleItemClick(item);
      }
    }
  }, [items]);

  const loadData = async (workspaceIdOverride = null) => {
    try {
      const workspaceId = workspaceIdOverride || sessionStorage.getItem('selectedWorkspaceId');
      if (!workspaceId) {
        setLoading(false);
        return;
      }
      
      // Load roadmap items
      const roadmapItems = await base44.entities.RoadmapItem.filter(
        { workspace_id: workspaceId },
        'display_order'
      );
      setItems(roadmapItems);

      // Load updates for each item
      const allUpdates = await base44.entities.RoadmapUpdate.filter(
        { workspace_id: workspaceId },
        '-created_date'
      );
      const updatesByItem = {};
      allUpdates.forEach(u => {
        if (!updatesByItem[u.roadmap_item_id]) {
          updatesByItem[u.roadmap_item_id] = [];
        }
        updatesByItem[u.roadmap_item_id].push(u);
      });
      setUpdates(updatesByItem);

      // Load linked feedback
      const feedbackItems = await base44.entities.Feedback.filter(
        { workspace_id: workspaceId }
      );
      const feedbackByRoadmap = {};
      feedbackItems.forEach(fb => {
        if (fb.roadmap_item_id) {
          if (!feedbackByRoadmap[fb.roadmap_item_id]) {
            feedbackByRoadmap[fb.roadmap_item_id] = [];
          }
          feedbackByRoadmap[fb.roadmap_item_id].push(fb);
        }
      });
      setLinkedFeedback(feedbackByRoadmap);
    } catch (error) {
      console.error('Failed to load roadmap:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = (status) => {
    setNewItemStatus(status);
    setShowNewModal(true);
    setSelectedItem(null);
  };

  const handleItemClick = (item) => {
    setSelectedItem(item);
    setShowNewModal(true);
  };

  const handleModalClose = () => {
    setShowNewModal(false);
    setSelectedItem(null);
  };

  const handleSave = () => {
    loadData();
  };

  const isPublicAccess = sessionStorage.getItem('isPublicAccess') === 'true';
  const isStaff = ['support', 'admin'].includes(role) && !isPublicAccess;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" text="Loading roadmap..." />
      </div>
    );
  }

  const isPublicAccess = sessionStorage.getItem('isPublicAccess') === 'true';
  
  return (
    <div className="space-y-6">
      {isPublicAccess && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <p className="text-blue-900">
            👀 Viewing roadmap in read-only mode. <button onClick={() => base44.auth.redirectToLogin(window.location.href)} className="underline font-medium">Login</button> to contribute.
          </p>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Roadmap</h1>
          <p className="text-slate-500 mt-1">
            Track upcoming features and improvements
          </p>
        </div>
        {isStaff && (
          <Button 
            onClick={() => handleCreateItem('planned')}
            style={{ backgroundColor: workspace?.primary_color || '#0f172a' }}
            className="hover:opacity-90 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        )}
      </div>

      {/* Roadmap Board */}
      {items.length === 0 ? (
        <EmptyState
          icon={Map}
          title="Roadmap is empty"
          description={isStaff 
            ? "Start building your roadmap by adding planned features" 
            : "Check back soon for upcoming features and improvements"}
          action={isStaff ? () => handleCreateItem('planned') : undefined}
          actionLabel={isStaff ? "Add First Item" : undefined}
        />
      ) : (
        <RoadmapBoard
          items={items}
          isStaff={isStaff}
          onItemClick={handleItemClick}
          onCreate={handleCreateItem}
          onUpdate={handleSave}
        />
      )}

      {/* Item Modal */}
      <RoadmapItemModal
        item={selectedItem}
        updates={selectedItem ? updates[selectedItem.id] || [] : []}
        linkedFeedback={selectedItem ? linkedFeedback[selectedItem.id] || [] : []}
        isOpen={showNewModal}
        onClose={handleModalClose}
        isStaff={isStaff}
        workspaceId={workspace?.id}
        onSave={handleSave}
      />
    </div>
  );
}