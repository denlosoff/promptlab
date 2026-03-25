import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Sun, Palette, Camera, Box, Sparkles, Monitor, Plus, Trash2, LayoutGrid, Check, X, Settings, Upload, Download, ChevronDown, ChevronRight, ChevronLeft, Bot, ToggleLeft, GripVertical, Menu, FolderInput } from 'lucide-react';
import { IconPickerModal } from './IconPickerModal';
import { AIAssistantModal } from './AIAssistantModal';
import { MoveCategoryModal } from './MoveCategoryModal';
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  useDroppable,
  CollisionDetection,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const iconMap: Record<string, React.ReactNode> = {
  Sun: <Sun size={18} />,
  Palette: <Palette size={18} />,
  Camera: <Camera size={18} />,
  Box: <Box size={18} />,
  Sparkles: <Sparkles size={18} />,
  Monitor: <Monitor size={18} />,
  LayoutGrid: <LayoutGrid size={18} />
};

const SortableCategoryItem = ({ 
  category, 
  depth = 0,
  isActive, 
  isAdmin, 
  isEditing, 
  editingName, 
  setEditingName, 
  saveName, 
  onSelect, 
  onDoubleClick, 
  onDelete, 
  onIconClick,
  onAddChild,
  onMove,
  categories,
  selectedFilters,
  expandedCategories,
  toggleFilter,
  toggleExpand,
  sensors,
  isCollapsed,
  reorderCategories,
  activeCategory,
  editingCategoryId,
  draggedDepth,
}: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver: isOverSortable,
  } = useSortable({ id: category.id });

  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: `nest-${category.id}`,
  });

  const currentDepth = isDragging && draggedDepth !== null ? draggedDepth : depth;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
    paddingLeft: isCollapsed ? 0 : currentDepth > 0 ? '12px' : '0',
    borderLeft: !isCollapsed && currentDepth > 0 ? '1px solid rgba(0,0,0,0.05)' : 'none',
    marginLeft: isCollapsed ? 0 : currentDepth > 0 ? '4px' : '0'
  };

  const children = categories.filter((c: any) => c.parentId === category.id);
  const isExpanded = expandedCategories.has(category.id);
  const isFilterSelected = selectedFilters.has(category.id);

  const renderIcon = (iconStr: string | undefined, fallback: string = 'Box') => {
    if (iconStr?.startsWith('data:image/svg+xml')) {
      return (
        <div 
          className="w-[18px] h-[18px] shrink-0" 
          style={{
            WebkitMaskImage: `url("${iconStr}")`,
            maskImage: `url("${iconStr}")`,
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
            backgroundColor: 'currentColor'
          }} 
        />
      );
    }
    if (iconStr?.startsWith('data:image')) {
      return <img src={iconStr} alt="" className="w-[18px] h-[18px] object-cover rounded-sm shrink-0" />;
    }
    return iconMap[iconStr || fallback] || iconMap[fallback];
  };

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col">
      <div 
        ref={setDropNodeRef}
        className={`group relative flex items-center mb-0.5 rounded-md transition-colors ${
        isOver
          ? 'bg-blue-100 ring-2 ring-blue-400 ring-inset'
          : isOverSortable
          ? 'ring-2 ring-zinc-300 ring-inset'
          : isActive 
          ? 'bg-zinc-100 text-zinc-900 font-medium' 
          : isFilterSelected
            ? 'bg-zinc-800 text-white'
            : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
      } ${category.isNew ? 'border border-dashed border-purple-400 bg-purple-50/50' : category.isModified ? 'border border-dashed border-blue-400 bg-blue-50/50' : ''}`}>
        
        {isAdmin && !isEditing && !isCollapsed && (
          <div 
            {...attributes}
            {...listeners}
            className="absolute -left-2 opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-600 cursor-grab active:cursor-grabbing p-1 z-10"
          >
            <GripVertical size={14} />
          </div>
        )}

        <div className="flex items-center w-full min-w-0">
          {!isCollapsed && (
            <div className="w-6 flex items-center justify-center shrink-0 ml-1">
              {(children.length > 0 || isAdmin) && (
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleExpand(category.id); }}
                  className={`p-1 rounded transition-colors ${isFilterSelected ? 'text-zinc-400 hover:text-white' : 'text-zinc-400 hover:text-zinc-600'}`}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              )}
            </div>
          )}
          
          {isEditing && !isCollapsed ? (
            <div className="flex flex-1 items-center gap-1 px-2 py-1">
              <input 
                autoFocus
                className="w-full text-sm border border-blue-500 rounded px-2 py-0.5 outline-none text-zinc-900"
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveName();
                  }
                }}
                onBlur={saveName}
                onClick={e => e.stopPropagation()}
              />
            </div>
          ) : (
            <button
              onClick={(e) => {
                if (e.shiftKey || e.ctrlKey || e.metaKey) {
                  toggleFilter(category.id, e);
                } else {
                  onSelect(category.id);
                }
              }}
              onDoubleClick={() => onDoubleClick(category.id, category.name)}
              className={`flex-1 flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors min-w-0 overflow-hidden ${isAdmin && !isCollapsed ? 'pr-14' : ''} ${isCollapsed ? 'justify-center px-0' : ''}`}
              title={isCollapsed ? category.name : ""}
            >
              <span 
                className={`${isActive ? 'text-blue-600' : isFilterSelected ? 'text-zinc-300' : 'text-zinc-400'} ${isAdmin ? 'cursor-pointer hover:opacity-80' : ''} ${category.isNew ? 'text-purple-500' : category.isModified ? 'text-blue-500' : ''} shrink-0`}
                onClick={(e) => {
                  if (isAdmin) {
                    e.stopPropagation();
                    onIconClick(category.id, e);
                  }
                }}
              >
                {renderIcon(category.icon)}
              </span>
              {!isCollapsed && <span className="truncate flex-1 text-left">{category.name}</span>}
              {!isCollapsed && category.isNew && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0"></span>}
              {!isCollapsed && category.isModified && !category.isNew && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>}
            </button>
          )}
        </div>

        {isAdmin && !isEditing && !isCollapsed && (
          <div className="absolute right-1 flex items-center opacity-0 group-hover:opacity-100 bg-white/80 rounded-md backdrop-blur-sm">
            <button 
              onClick={(e) => { e.stopPropagation(); onAddChild(); }}
              className="text-zinc-400 hover:text-blue-500 p-1"
              title="Добавить подкатегорию"
            >
              <Plus size={14} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onMove(category.id); }}
              className="text-zinc-400 hover:text-blue-500 p-1"
              title="Переместить"
            >
              <FolderInput size={14} />
            </button>
            <button 
              onClick={(e) => onDelete(category.id, e)}
              className="text-zinc-400 hover:text-red-500 p-1"
              title="Удалить"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {isExpanded && children.length > 0 && !isCollapsed && (
        <div className="flex flex-col">
          <SortableContext 
            items={children.map((c: any) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {children.map((child: any) => (
              <SortableCategoryItem
                key={child.id}
                category={child}
                depth={depth + 1}
                isActive={activeCategory === child.id}
                isAdmin={isAdmin}
                isEditing={editingCategoryId === child.id}
                editingName={editingName}
                setEditingName={setEditingName}
                saveName={saveName}
                onSelect={(id?: string) => onSelect(id || child.id)}
                onDoubleClick={(id?: string, name?: string) => onDoubleClick(id || child.id, name || child.name)}
                onDelete={(id?: string, e?: any) => onDelete(id || child.id, e)}
                onIconClick={(id?: string, e?: any) => onIconClick(id || child.id, e)}
                onAddChild={(parentId?: string) => onAddChild(parentId || child.id)}
                onMove={onMove}
                categories={categories}
                selectedFilters={selectedFilters}
                expandedCategories={expandedCategories}
                toggleFilter={toggleFilter}
                toggleExpand={toggleExpand}
                sensors={sensors}
                isCollapsed={isCollapsed}
                reorderCategories={reorderCategories}
                activeCategory={activeCategory}
                editingCategoryId={editingCategoryId}
                draggedDepth={draggedDepth}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
};

export const Sidebar = ({ 
  isCollapsed: externalIsCollapsed, 
  onToggleCollapse 
}: { 
  isCollapsed?: boolean, 
  onToggleCollapse?: () => void 
}) => {
  const { 
    categories, addCategory, updateCategory, deleteCategory, reorderCategories,
    isAdmin, setIsAdmin,
    activeCategory, setActiveCategory,
    selectedFilters, setSelectedFilters,
    isDraftMode
  } = useAppContext();
  
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [iconPickerCategoryId, setIconPickerCategoryId] = useState<string | null>(null);
  const [movingCategoryId, setMovingCategoryId] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);

  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;
  const toggleCollapse = onToggleCollapse || (() => setInternalIsCollapsed(!internalIsCollapsed));

  const toggleFilter = (id: string, e?: React.MouseEvent) => {
    if (e && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      setSelectedFilters(new Set([id]));
    } else {
      const newFilters = new Set(selectedFilters);
      if (newFilters.has(id)) {
        newFilters.delete(id);
      } else {
        newFilters.add(id);
      }
      setSelectedFilters(newFilters);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getPath = (catId: string) => {
    const path = [];
    let current = categories.find(c => c.id === catId);
    while (current) {
      path.unshift(current);
      current = categories.find(c => c.id === current?.parentId);
    }
    return path;
  };

  const path = useMemo(() => activeCategory === 'all' ? [] : getPath(activeCategory), [activeCategory, categories]);

  const prevActiveCategoryRef = React.useRef(activeCategory);

  useEffect(() => {
    if (prevActiveCategoryRef.current !== activeCategory) {
      if (activeCategory !== 'all') {
        const p = getPath(activeCategory);
        setExpandedCategories(new Set(p.map(cat => cat.id)));
      } else {
        setExpandedCategories(new Set());
      }
      prevActiveCategoryRef.current = activeCategory;
    }
  }, [activeCategory, categories]);

  const handleCategoryDoubleClick = (id: string, name: string) => {
    if (!isAdmin) return;
    setEditingCategoryId(id);
    setEditingCategoryName(name);
  };

  const saveCategoryName = () => {
    if (editingCategoryId && editingCategoryName.trim()) {
      const cat = categories.find(c => c.id === editingCategoryId);
      updateCategory(editingCategoryId, editingCategoryName.trim(), cat?.icon, cat?.parentId);
    }
    setEditingCategoryId(null);
  };

  const handleAddCategory = (parentId?: string) => {
    const id = 'cat_' + Date.now();
    addCategory({ id, name: 'Новая категория', icon: 'Box', parentId });
    if (parentId) {
      setExpandedCategories(prev => new Set(prev).add(parentId));
    } else {
      setActiveCategory(id);
    }
  };

  const handleDeleteCategory = (id: string, e: React.MouseEvent) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setCategoryToDelete(id);
  };

  const confirmDelete = () => {
    if (categoryToDelete) {
      deleteCategory(categoryToDelete);
      if (activeCategory === categoryToDelete) setActiveCategory('all');
      setCategoryToDelete(null);
    }
  };

  const handleIconSelect = (icon: string) => {
    if (iconPickerCategoryId) {
      const cat = categories.find(c => c.id === iconPickerCategoryId);
      if (cat) {
        updateCategory(iconPickerCategoryId, cat.name, icon, cat.parentId);
      }
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const customCollisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      // Find all nest collisions (these are just the headers, not the whole expanded tree)
      const nestCollisions = pointerCollisions.filter(c => c.id.toString().startsWith('nest-'));
      
      if (nestCollisions.length > 0 && args.pointerCoordinates) {
        // Sort by height ascending to get the innermost one (just in case)
        nestCollisions.sort((a, b) => {
          const hA = a.data?.droppableContainer?.rect?.current?.height || 0;
          const hB = b.data?.droppableContainer?.rect?.current?.height || 0;
          return hA - hB;
        });
        
        const targetNest = nestCollisions[0];
        const rect = targetNest.data?.droppableContainer?.rect?.current;
        
        if (rect) {
          const y = args.pointerCoordinates.y;
          const top = rect.top;
          const bottom = rect.bottom;
          const height = bottom - top;
          
          // If pointer is in the middle 50% vertically, it's a nest
          if (y > top + height * 0.25 && y < bottom - height * 0.25) {
            return [targetNest];
          } else {
            // Otherwise, it's a reorder. Return the corresponding sortable collision
            const sortableId = targetNest.id.toString().replace('nest-', '');
            const sortableCollision = pointerCollisions.find(c => c.id.toString() === sortableId);
            if (sortableCollision) {
              return [sortableCollision];
            }
          }
        }
      }
      
      // Fallback if no nest collision or no rect
      const sortableCollision = pointerCollisions.find(c => !c.id.toString().startsWith('nest-'));
      if (sortableCollision) {
        return [sortableCollision];
      }
      return pointerCollisions;
    }
    return closestCenter(args);
  };

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overDragId, setOverDragId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverDragId(event.over?.id as string | null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    setOverDragId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (overId.startsWith('nest-')) {
      const targetParentId = overId.replace('nest-', '');
      
      // Prevent nesting into itself or its descendants
      const getDescendantIds = (catId: string): string[] => {
        const children = categories.filter(c => c.parentId === catId);
        let ids = children.map(c => c.id);
        children.forEach(c => {
          ids = [...ids, ...getDescendantIds(c.id)];
        });
        return ids;
      };
      
      const descendantIds = getDescendantIds(activeId);
      if (activeId !== targetParentId && !descendantIds.includes(targetParentId)) {
        const cat = categories.find(c => c.id === activeId);
        if (cat) {
          updateCategory(activeId, cat.name, cat.icon, targetParentId);
          
          // Only expand the new path and the moved item's expanded descendants
          const newExpanded = new Set<string>();
          let curr: string | undefined = targetParentId;
          while (curr) {
            newExpanded.add(curr);
            const parent = categories.find(c => c.id === curr)?.parentId;
            curr = parent;
          }
          
          // Keep the moved item and its previously expanded descendants open
          if (expandedCategories.has(activeId)) newExpanded.add(activeId);
          descendantIds.forEach(id => {
            if (expandedCategories.has(id)) newExpanded.add(id);
          });
          
          setExpandedCategories(newExpanded);
        }
      }
    } else if (activeId !== overId) {
      reorderCategories(activeId, overId);
      
      // Only expand the new path and the moved item's expanded descendants
      const overItem = categories.find(c => c.id === overId);
      if (overItem) {
        const newExpanded = new Set<string>();
        let curr: string | undefined = overItem.parentId;
        while (curr) {
          newExpanded.add(curr);
          const parent = categories.find(c => c.id === curr)?.parentId;
          curr = parent;
        }
        
        // Keep the moved item and its previously expanded descendants open
        if (expandedCategories.has(activeId)) newExpanded.add(activeId);
        
        const getDescendantIds = (catId: string): string[] => {
          const children = categories.filter(c => c.parentId === catId);
          let ids = children.map(c => c.id);
          children.forEach(c => {
            ids = [...ids, ...getDescendantIds(c.id)];
          });
          return ids;
        };
        
        getDescendantIds(activeId).forEach(id => {
          if (expandedCategories.has(id)) newExpanded.add(id);
        });
        
        setExpandedCategories(newExpanded);
      }
    }
  };

  const getCategoryDepth = (id: string): number => {
    let depth = 0;
    let curr = categories.find(c => c.id === id);
    while (curr?.parentId) {
      depth++;
      curr = categories.find(c => c.id === curr!.parentId);
    }
    return depth;
  };

  let draggedDepth: number | null = null;
  if (activeDragId && overDragId) {
    if (overDragId.startsWith('nest-')) {
      const parentId = overDragId.replace('nest-', '');
      draggedDepth = getCategoryDepth(parentId) + 1;
    } else {
      draggedDepth = getCategoryDepth(overDragId);
    }
  }

  const topLevelCategories = categories.filter(c => !c.parentId);

  return (
    <>
      <aside 
        className={`w-full bg-white flex flex-col h-full z-10 shrink-0 overflow-hidden relative ${isCollapsed ? 'cursor-pointer' : ''}`}
        onClick={isCollapsed ? toggleCollapse : undefined}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapse();
          }}
          className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 z-20 h-16 w-4 rounded-full border border-zinc-200 bg-white shadow-sm text-zinc-400 hover:text-zinc-600 hover:border-zinc-300 transition-all flex items-center justify-center"
          title={isCollapsed ? "Expand menu" : "Collapse menu"}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        <div className="flex-1 overflow-y-auto">
          <div className={isCollapsed ? "p-1 pt-3" : "p-3"}>
            <nav className="space-y-1">
              <div
                onClick={() => {
                  setActiveCategory('all');
                  setSelectedFilters(new Set());
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors cursor-pointer group ${
                  activeCategory === 'all' 
                    ? 'bg-zinc-100 text-zinc-900 font-medium' 
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
                title={isCollapsed ? "Toggle" : ""}
              >
                <div className="flex items-center gap-3">
                  <span className={activeCategory === 'all' ? 'text-blue-600' : 'text-zinc-400'}>
                    {iconMap['LayoutGrid']}
                  </span>
                  {!isCollapsed && <span>Toggle</span>}
                </div>
                {isAdmin && !isCollapsed && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddCategory();
                    }}
                    className="text-zinc-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    title="Добавить категорию"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>

              <DndContext 
                sensors={sensors}
                collisionDetection={customCollisionDetection}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={topLevelCategories.map(c => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {topLevelCategories.map(category => (
                    <SortableCategoryItem
                      key={category.id}
                      category={category}
                      isActive={activeCategory === category.id}
                      isAdmin={isAdmin}
                      isEditing={editingCategoryId === category.id}
                      editingName={editingCategoryName}
                      setEditingName={setEditingCategoryName}
                      saveName={saveCategoryName}
                      onSelect={(id?: string) => {
                        setActiveCategory(id || category.id);
                        setSelectedFilters(new Set());
                      }}
                      onDoubleClick={(id?: string, name?: string) => handleCategoryDoubleClick(id || category.id, name || category.name)}
                      onDelete={(id?: string, e?: React.MouseEvent) => handleDeleteCategory(id || category.id, e || ({} as any))}
                      onIconClick={(id?: string, e?: React.MouseEvent) => {
                        if (isAdmin) {
                          if (e) e.stopPropagation();
                          setIconPickerCategoryId(typeof id === 'string' ? id : category.id);
                        }
                      }}
                      onAddChild={(parentId?: string) => handleAddCategory(parentId || category.id)}
                      onMove={(id: string) => setMovingCategoryId(id)}
                      categories={categories}
                      selectedFilters={selectedFilters}
                      expandedCategories={expandedCategories}
                      toggleFilter={toggleFilter}
                      toggleExpand={toggleExpand}
                      sensors={sensors}
                      isCollapsed={isCollapsed}
                      reorderCategories={reorderCategories}
                      activeCategory={activeCategory}
                      editingCategoryId={editingCategoryId}
                      draggedDepth={draggedDepth}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </nav>
          </div>
        </div>
      </aside>

      <IconPickerModal 
        isOpen={!!iconPickerCategoryId} 
        onClose={() => setIconPickerCategoryId(null)} 
        onSelect={handleIconSelect} 
      />

      <MoveCategoryModal
        isOpen={!!movingCategoryId}
        onClose={() => setMovingCategoryId(null)}
        movingCategoryId={movingCategoryId}
        categories={categories}
        onMove={(newParentId) => {
          if (movingCategoryId) {
            const cat = categories.find(c => c.id === movingCategoryId);
            if (cat) {
              updateCategory(movingCategoryId, cat.name, cat.icon, newParentId);
              setExpandedCategories(prev => {
                const next = new Set(prev);
                if (newParentId) next.add(newParentId);
                return next;
              });
            }
          }
        }}
      />

      {categoryToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-zinc-900 mb-2">Удалить категорию?</h3>
            <p className="text-zinc-600 text-sm mb-6">
              Вы уверены, что хотите удалить эту категорию и все её подкатегории? Это действие нельзя отменить.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
