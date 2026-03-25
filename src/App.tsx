import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AppProvider, useAppContext } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { TokenGrid } from './components/TokenGrid';
import { RightSidebar } from './components/RightSidebar';
import { PromptBuilder } from './components/PromptBuilder';
import { Check, GripHorizontal, X } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  defaultDropAnimationSideEffects,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { ErrorBoundary } from './components/ErrorBoundary';

const DraftBanner = () => {
  const { isDraftMode, draftSource, applyDraft, cancelDraft } = useAppContext();

  if (!isDraftMode || draftSource !== 'ai') {
    return null;
  }

  return (
    <div className="bg-amber-500 text-zinc-950 px-4 py-2 flex items-center justify-between shrink-0 z-50">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="flex h-2 w-2 rounded-full bg-zinc-950 animate-pulse" />
        AI preview mode: changes are not saved yet.
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={cancelDraft}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-zinc-950/10 hover:bg-zinc-950/20 rounded transition-colors"
        >
          <X size={14} />
          Cancel
        </button>
        <button
          onClick={applyDraft}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-zinc-950 text-white hover:bg-zinc-800 rounded transition-colors shadow-sm"
        >
          <Check size={14} />
          Apply
        </button>
      </div>
    </div>
  );
};

const LoadingScreen = () => (
  <div className="min-h-screen bg-zinc-50 text-zinc-900 flex items-center justify-center">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-zinc-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
      <p className="text-sm text-zinc-500">Loading token database...</p>
    </div>
  </div>
);

const AppContent = () => {
  const { promptNodes, reorderNodes, addToPrompt, insertNode, isReady, setSelectedToken, setIsAddingToken } = useAppContext();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'token-grid' | 'prompt-node' | null>(null);
  const [activeData, setActiveData] = useState<any>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  React.useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = event.clientX;
        if (newWidth < 120) {
          setIsSidebarCollapsed(true);
        } else {
          setIsSidebarCollapsed(false);
          setSidebarWidth(Math.min(Math.max(newWidth, 200), 500));
        }
      }

      if (isResizingRight) {
        const newWidth = window.innerWidth - event.clientX;
        if (newWidth < 120) {
          setIsRightSidebarCollapsed(true);
        } else {
          setIsRightSidebarCollapsed(false);
          setRightSidebarWidth(Math.min(Math.max(newWidth, 260), 640));
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isResizingLeft || isResizingRight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    if (active.data.current?.type === 'token') {
      setActiveType('token-grid');
      setActiveData(active.data.current.token);
      return;
    }

    setActiveType('prompt-node');
    setActiveData(active.data.current?.node);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over) {
      if (activeType === 'prompt-node' && over.id !== active.id) {
        const overId = over.id as string;
        if (overId.startsWith('node_')) {
          reorderNodes(active.id as string, overId);
        }
      } else if (activeType === 'token-grid') {
        const overId = over.id as string;
        const token = activeData;
        if (!token) {
          return;
        }

        if (overId === 'prompt-builder-container' || overId.startsWith('node_') || overId.startsWith('insert_')) {
          if (overId.startsWith('insert_')) {
            insertNode({ type: 'token', tokenId: token.id, text: token.name }, Number(overId.split('_')[1]));
          } else if (overId.startsWith('node_')) {
            const index = promptNodes.findIndex((node) => node.id === overId);
            insertNode({ type: 'token', tokenId: token.id, text: token.name }, index);
          } else {
            addToPrompt(token);
          }
        }
      }
    }

    setActiveId(null);
    setActiveType(null);
    setActiveData(null);
  };

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  const renderOverlay = () => {
    if (!activeId || !activeData) {
      return null;
    }

    if (activeType === 'token-grid') {
      return (
        <div className="inline-flex items-center bg-white border border-zinc-200 shadow-xl px-2 py-1 rounded-md text-sm text-zinc-800 whitespace-nowrap pointer-events-none ring-2 ring-blue-500/20 h-8 w-fit">
          {activeData.name}
        </div>
      );
    }

    if (activeData.type === 'separator') {
      return (
        <div className="inline-flex items-center justify-center px-0.5 py-1 pointer-events-none">
          <span className="text-zinc-800 font-bold text-base leading-none select-none">{activeData.text}</span>
        </div>
      );
    }

    return (
      <div
        className={`inline-flex items-center rounded-md text-sm pointer-events-none h-8 w-fit ${
          activeData.type === 'custom'
            ? 'bg-transparent border-b border-zinc-300 px-0.5 mx-0.5'
            : 'bg-white border border-zinc-200 shadow-xl px-2 py-1 ring-2 ring-blue-500/20'
        }`}
      >
        <span className="text-zinc-800 select-none whitespace-nowrap">{activeData.text}</span>
      </div>
    );
  };

  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-screen bg-zinc-50 text-zinc-900 font-sans overflow-hidden min-w-[1024px]">
        <DraftBanner />
        <div className="flex flex-1 overflow-hidden">
          <motion.div
            initial={false}
            animate={{ width: isSidebarCollapsed ? 64 : sidebarWidth }}
            transition={isResizingLeft ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
            className="h-full flex-shrink-0 overflow-hidden border-r border-zinc-200 bg-white relative"
          >
            <Sidebar isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
          </motion.div>

          <div
            onMouseDown={(event) => {
              event.preventDefault();
              setIsResizingLeft(true);
            }}
            className={`w-1 h-full cursor-col-resize hover:bg-blue-400 transition-colors z-20 shrink-0 ${
              isResizingLeft ? 'bg-blue-500' : 'bg-transparent'
            }`}
          />

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <PanelGroup orientation="vertical">
              <Panel minSize={30}>
                <ErrorBoundary>
                  <TokenGrid
                    onRequestAddToken={() => {
                      setSelectedToken(null);
                      setIsAddingToken(true);
                      setIsRightSidebarCollapsed(false);
                    }}
                    onRequestSelectToken={() => {
                      setIsAddingToken(false);
                      setIsRightSidebarCollapsed(false);
                    }}
                  />
                </ErrorBoundary>
              </Panel>
              <PanelResizeHandle className="h-1 bg-zinc-200 hover:bg-blue-400 transition-colors cursor-row-resize flex items-center justify-center group">
                <GripHorizontal size={12} className="text-zinc-400 group-hover:text-white" />
              </PanelResizeHandle>
              <Panel defaultSize={25} minSize={10} collapsible>
                <ErrorBoundary>
                  <PromptBuilder />
                </ErrorBoundary>
              </Panel>
            </PanelGroup>
          </div>

          <div
            onMouseDown={(event) => {
              event.preventDefault();
              setIsResizingRight(true);
            }}
            className={`w-1 h-full cursor-col-resize hover:bg-blue-400 transition-colors z-20 shrink-0 ${
              isResizingRight ? 'bg-blue-500' : 'bg-transparent'
            }`}
          />

          <motion.div
            initial={false}
            animate={{ width: isRightSidebarCollapsed ? 64 : rightSidebarWidth }}
            transition={isResizingRight ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
            className="h-full flex-shrink-0 overflow-hidden border-l border-zinc-200 bg-white relative"
          >
            <ErrorBoundary>
              <RightSidebar
                isCollapsed={isRightSidebarCollapsed}
                onToggleCollapse={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
              />
            </ErrorBoundary>
          </motion.div>
        </div>
      </div>

      <DragOverlay dropAnimation={dropAnimation} modifiers={[snapCenterToCursor]}>
        {renderOverlay()}
      </DragOverlay>
    </DndContext>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
