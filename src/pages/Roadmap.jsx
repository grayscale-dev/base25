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
    const storedWorkspace = sessionStorage.getItem('selectedWorkspace');
    const storedRole = sessionStorage.getItem('currentRole');
    
    if (!storedWorkspace) {
      navigate(createPageUrl('WorkspaceSelector'));
      return;
    }
    
    setWorkspace(JSON.parse(storedWorkspace));
    setRole(storedRole || 'viewer');
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const workspaceId = sessionStorage.getItem('selectedWorkspaceId');
      
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

  return (
    <div className="space-y-6">
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
            className="bg-slate-900 hover:bg-slate-800"
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