import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, Calendar, MessageSquare, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Badge from '@/components/common/Badge';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const columns = [
  { id: 'planned', title: 'Planned', color: 'bg-slate-100', textColor: 'text-slate-700' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-50', textColor: 'text-blue-700' },
  { id: 'shipped', title: 'Shipped', color: 'bg-emerald-50', textColor: 'text-emerald-700' },
];

export default function RoadmapBoard({ items, isStaff, onItemClick, onCreate, onUpdate }) {
  const [dragging, setDragging] = useState(false);

  const getItemsByStatus = (status) => {
    return items
      .filter(item => item.status === status)
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  };

  const handleDragStart = () => {
    setDragging(true);
  };

  const handleDragEnd = async (result) => {
    setDragging(false);
    
    if (!result.destination || !isStaff) return;

    const { source, destination, draggableId } = result;
    
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const itemId = draggableId;
    const newStatus = destination.droppableId;
    const newOrder = destination.index;

    try {
      // Use backend function to enforce auth + role + NAME_REQUIRED
      const workspaceId = sessionStorage.getItem('selectedBoardId');
      await base44.functions.invoke('updateRoadmapItem', {
        item_id: itemId,
        board_id: workspaceId,
        updates: {
          status: newStatus,
          display_order: newOrder,
        }
      });
      onUpdate?.();
    } catch (error) {
      console.error('Failed to update roadmap item:', error);
      if (error.response?.data?.code === 'NAME_REQUIRED') {
        alert('Please set your display name before moving roadmap items.');
      }
    }
  };

  return (
    <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map((column) => {
          const columnItems = getItemsByStatus(column.id);
          
          return (
            <div key={column.id} className="flex flex-col">
              <div className={cn(
                'flex items-center justify-between px-4 py-3 rounded-t-xl',
                column.color
              )}>
                <div className="flex items-center gap-2">
                  <span className={cn('font-semibold', column.textColor)}>
                    {column.title}
                  </span>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    column.id === 'planned' && 'bg-slate-200 text-slate-600',
                    column.id === 'in_progress' && 'bg-blue-100 text-blue-600',
                    column.id === 'shipped' && 'bg-emerald-100 text-emerald-600'
                  )}>
                    {columnItems.length}
                  </span>
                </div>
                {isStaff && column.id === 'planned' && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2"
                    onClick={() => onCreate?.(column.id)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              <Droppable droppableId={column.id} isDropDisabled={!isStaff}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex-1 min-h-[200px] p-3 rounded-b-xl border border-t-0 transition-colors',
                      snapshot.isDraggingOver ? 'bg-slate-50 border-slate-300' : 'bg-slate-50/50 border-slate-200'
                    )}
                  >
                    <div className="space-y-3">
                      {columnItems.map((item, index) => (
                        <Draggable 
                          key={item.id} 
                          draggableId={item.id} 
                          index={index}
                          isDragDisabled={!isStaff}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={cn(
                                'bg-white rounded-xl p-4 border border-slate-200 cursor-pointer',
                                'hover:shadow-md hover:border-slate-300 transition-all',
                                snapshot.isDragging && 'shadow-lg ring-2 ring-blue-200'
                              )}
                              onClick={() => onItemClick?.(item)}
                            >
                              <h4 className="font-medium text-slate-900 mb-2 line-clamp-2">
                                {item.title}
                              </h4>
                              
                              {item.description && (
                                <p className="text-sm text-slate-500 mb-3 line-clamp-2">
                                  {item.description}
                                </p>
                              )}
                              
                              <div className="flex items-center gap-2 flex-wrap">
                                {item.target_quarter && (
                                  <Badge variant="outline" size="sm" className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {item.target_quarter}
                                  </Badge>
                                )}
                                {item.target_date && !item.target_quarter && (
                                  <Badge variant="outline" size="sm" className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(item.target_date), 'MMM yyyy')}
                                  </Badge>
                                )}
                                {item.linked_feedback_ids?.length > 0 && (
                                  <Badge variant="default" size="sm" className="flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    {item.linked_feedback_ids.length}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}