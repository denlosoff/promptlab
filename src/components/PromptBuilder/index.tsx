import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Copy, Trash2, Check, Box, ChevronUp, ChevronDown, Wand2, Plus, Loader2, Link, Sparkles, Search, X, Languages, Type } from 'lucide-react';
import { optimizePrompt, translatePrompt, reviewPrompt } from '../../services/aiService';
import { AiSuggestion } from '../../types';
import { useDroppable } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { SortableNode } from './SortableNode';
import { SmartTokenInput } from './SmartTokenInput';
import { ErrorBoundary } from '../ErrorBoundary';
import { PromptToolbar } from './PromptToolbar';
import { GenerateImageModal } from './GenerateImageModal';

const InsertionPoint = ({ index }: { index: number }) => {
  const { activeInsertionIndex, setActiveInsertionIndex } = useAppContext();
  const isActive = activeInsertionIndex === index;
  
  const { setNodeRef, isOver } = useDroppable({
    id: `insert_${index}`,
    data: {
      type: 'insertion-point',
      index
    }
  });
  
  if (isActive) {
    return (
      <div ref={setNodeRef} className="flex items-center">
        <SmartTokenInput insertIndex={index} onDone={() => setActiveInsertionIndex(null)} autoFocus={true} />
        <button 
          onClick={() => setActiveInsertionIndex(null)}
          className="ml-1 text-zinc-400 hover:text-zinc-600"
        >
          <Plus size={14} className="rotate-45" />
        </button>
      </div>
    );
  }

  return (
    <div 
      ref={setNodeRef}
      className="relative group/insert flex items-center h-7 -mx-2 px-2 min-w-[12px]"
    >
      <div className={`w-0.5 h-4 bg-blue-500 transition-all rounded-full ${isOver ? 'opacity-100 scale-y-150 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'opacity-0 group-hover/insert:opacity-100'}`} />
      <button 
        onClick={() => setActiveInsertionIndex(index)}
        className="absolute left-1/2 -translate-x-1/2 opacity-0 group-hover/insert:opacity-100 transition-opacity bg-blue-500 text-white rounded-full p-0.5 shadow-sm hover:scale-110 active:scale-95 z-10"
      >
        <Plus size={10} />
      </button>
    </div>
  );
};

export const PromptBuilder = () => {
  const { promptNodes, clearPrompt, reorderNodes, setPromptFromText, parseTextToNodes, selectedNodeIds, setSelectedNodeIds, groupNodes, activeInsertionIndex, setActiveInsertionIndex, removeFromPrompt, addNode, insertNode, updateNodeText, aiModel } = useAppContext();
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [highlightQuery, setHighlightQuery] = useState('');
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [highlightMap, setHighlightMap] = useState<Record<string, 'strong' | 'medium' | 'weak' | 'none'>>({});
  const [isHighlightLoading, setIsHighlightLoading] = useState(false);
  const [isTranslationMode, setIsTranslationMode] = useState(false);
  const [isAiInputExpanded, setIsAiInputExpanded] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [isAltPressed, setIsAltPressed] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [translatedPrompt, setTranslatedPrompt] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null);
  const [translatedSelection, setTranslatedSelection] = useState('');
  const [isTranslatingSelection, setIsTranslatingSelection] = useState(false);
  const [isTextMode, setIsTextMode] = useState(false);
  const [textModeValue, setTextModeValue] = useState('');
  
  // Selection state
  const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const selectionStart = useRef<{ x: number, y: number } | null>(null);
  const selectionContainerRef = useRef<HTMLDivElement>(null);

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: 'prompt-builder-container',
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        setSelectedNodeIds(promptNodes.map(n => n.id));
        return;
      }

      if (e.key === 'Backspace' && selectedNodeIds.length > 0) {
        // Check if we are not in an input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        
        e.preventDefault();
        selectedNodeIds.forEach(id => removeFromPrompt(id));
        setSelectedNodeIds([]);
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      
      const text = e.clipboardData?.getData('text');
      if (text) {
        e.preventDefault();
        setPromptFromText(text);
      }
    };

    const handleKeyDownAlt = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || e.key === 'Meta') setIsAltPressed(true);
    };
    
    const handleKeyUpAlt = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || e.key === 'Meta') setIsAltPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDownAlt);
    window.addEventListener('keyup', handleKeyUpAlt);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDownAlt);
      window.removeEventListener('keyup', handleKeyUpAlt);
    };
  }, [selectedNodeIds, removeFromPrompt, setSelectedNodeIds, promptNodes, setPromptFromText]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start selection if clicking on the background (not on a node or button)
    const target = e.target as HTMLElement;
    const isNode = target.closest('[id^="node-item-"]');
    const isButton = target.closest('button');
    const isInput = target.closest('input') || target.closest('.smart-token-input');
    
    if (isNode || isButton || isInput) return;

    const rect = selectionContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + (selectionContainerRef.current?.scrollTop || 0);

    selectionStart.current = { x, y };
    setSelectionRect({ x, y, w: 0, h: 0 });
    
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      setSelectedNodeIds([]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!selectionStart.current || !selectionContainerRef.current) return;

    const rect = selectionContainerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top + selectionContainerRef.current.scrollTop;

    const x = Math.min(selectionStart.current.x, currentX);
    const y = Math.min(selectionStart.current.y, currentY);
    const w = Math.abs(selectionStart.current.x - currentX);
    const h = Math.abs(selectionStart.current.y - currentY);

    setSelectionRect({ x, y, w, h });

    // Calculate selection
    const newSelectedIds: string[] = [];
    const containerScrollTop = selectionContainerRef.current.scrollTop;
    const containerRect = selectionContainerRef.current.getBoundingClientRect();

    promptNodes.forEach(node => {
      const el = document.getElementById(`node-item-${node.id}`);
      if (el) {
        const nodeRect = el.getBoundingClientRect();
        // Convert nodeRect to container-relative coordinates
        const nodeX = nodeRect.left - containerRect.left;
        const nodeY = nodeRect.top - containerRect.top + containerScrollTop;
        
        const intersects = (
          nodeX < x + w &&
          nodeX + nodeRect.width > x &&
          nodeY < y + h &&
          nodeY + nodeRect.height > y
        );

        if (intersects) {
          newSelectedIds.push(node.id);
        }
      }
    });

    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      // Toggle/Add mode
      const combined = new Set([...selectedNodeIds, ...newSelectedIds]);
      setSelectedNodeIds(Array.from(combined));
    } else {
      setSelectedNodeIds(newSelectedIds);
    }
  };

  const handleMouseUp = () => {
    selectionStart.current = null;
    setSelectionRect(null);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (selectionStart.current) {
        handleMouseUp();
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  const getFormattedPrompt = (nodes: any[]) => {
    let result = '';
    nodes.forEach((node, i) => {
      const text = node.text;
      const isSeparator = node.type === 'separator';
      
      if (i === 0) {
        result += text;
      } else {
        const prevNode = nodes[i-1];
        const prevIsSeparator = prevNode.type === 'separator';
        
        if (text === '\n') {
           result += '\n';
        } else if (prevNode.text === '\n') {
           result += text;
        } else if (isSeparator) {
          if (['(', '[', '{'].includes(text)) {
            result += ' ' + text;
          } else if ([')', ']', '}', ',', '.', '!', '?', ':', ';'].includes(text)) {
            result += text;
          } else {
            result += ' ' + text;
          }
        } else {
          if (prevIsSeparator && ['(', '[', '{'].includes(prevNode.text)) {
            result += text;
          } else {
            result += ' ' + text;
          }
        }
      }
    });
    // Don't replace newlines with spaces
    return result.replace(/[ \t]+/g, ' ').trim();
  };

  const fullPrompt = getFormattedPrompt(promptNodes);

  useEffect(() => {
    if (!isTranslationMode || !fullPrompt) {
      setTranslatedPrompt('');
      return;
    }
    
    const translate = async () => {
      setIsTranslating(true);
      const result = await translatePrompt(fullPrompt, aiModel);
      setTranslatedPrompt(result);
      setIsTranslating(false);
    };
    
    const timeoutId = setTimeout(translate, 1000);
    return () => clearTimeout(timeoutId);
  }, [fullPrompt, isTranslationMode, aiModel]);

  useEffect(() => {
    if (!isTranslationMode || selectedNodeIds.length === 0) {
      setTranslatedSelection('');
      return;
    }

    const selectedText = promptNodes
      .filter(n => selectedNodeIds.includes(n.id))
      .map(n => n.text)
      .join(' ');

    if (!selectedText.trim()) return;

    const translate = async () => {
      setIsTranslatingSelection(true);
      const result = await translatePrompt(selectedText, aiModel);
      setTranslatedSelection(result);
      setIsTranslatingSelection(false);
    };

    const timeoutId = setTimeout(translate, 600);
    return () => clearTimeout(timeoutId);
  }, [selectedNodeIds, isTranslationMode, promptNodes, aiModel]);

  const copyPrompt = () => {
    if (promptNodes.length === 0) return;
    navigator.clipboard.writeText(fullPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAskAi = async () => {
    if (!aiQuery.trim() || promptNodes.length === 0) return;
    setIsReviewMode(true);
    setIsReviewLoading(true);
    setAiSuggestions([]);
    
    try {
      const nodesToAnalyze = promptNodes.map(n => ({ id: n.id, text: n.text }));
      const suggestions = await reviewPrompt(nodesToAnalyze, aiQuery, aiModel);
      setAiSuggestions(suggestions);
    } catch (e) {
      console.error(e);
    } finally {
      setIsReviewLoading(false);
      setAiQuery('');
      setIsAiInputExpanded(false);
    }
  };

  const applySuggestion = (suggestion: AiSuggestion) => {
    if (suggestion.type === 'remove' && suggestion.targetNodeIds && suggestion.targetNodeIds.length > 0) {
      suggestion.targetNodeIds.forEach(id => removeFromPrompt(id));
    } else if (suggestion.type === 'replace' && suggestion.targetNodeIds && suggestion.targetNodeIds.length > 0 && suggestion.newText) {
      const firstNodeIndex = promptNodes.findIndex(n => n.id === suggestion.targetNodeIds![0]);
      suggestion.targetNodeIds.forEach(id => removeFromPrompt(id));
      
      if (firstNodeIndex !== -1) {
        const newNodes = parseTextToNodes(suggestion.newText);
        newNodes.forEach((n, i) => {
          const { id, ...rest } = n;
          insertNode(rest, firstNodeIndex + i);
        });
      }
    } else if (suggestion.type === 'add' && suggestion.newText) {
      const newNodes = parseTextToNodes(suggestion.newText);
      newNodes.forEach(n => {
        const { id, ...rest } = n;
        addNode(rest);
      });
    } else if (suggestion.type === 'move' && suggestion.targetNodeIds && suggestion.targetNodeIds.length > 0) {
      const nodesToMove = promptNodes.filter(n => suggestion.targetNodeIds!.includes(n.id));
      suggestion.targetNodeIds.forEach(id => removeFromPrompt(id));
      nodesToMove.forEach(n => {
        const { id, ...rest } = n;
        addNode(rest);
      });
    } else {
      // Fallback for old format or missing IDs
      if (suggestion.type === 'remove' && suggestion.targetText) {
        const node = promptNodes.find(n => n.text.toLowerCase() === suggestion.targetText?.toLowerCase());
        if (node) removeFromPrompt(node.id);
      } else if (suggestion.type === 'add' && suggestion.newText) {
        addNode({ type: 'custom', text: suggestion.newText });
      }
    }
    
    setAiSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    if (aiSuggestions.length <= 1) setIsReviewMode(false);
  };

  const rejectSuggestion = (id: string) => {
    setAiSuggestions(prev => prev.filter(s => s.id !== id));
    if (aiSuggestions.length <= 1) setIsReviewMode(false);
  };

  const applyAllSuggestions = () => {
    aiSuggestions.forEach(applySuggestion);
    setIsReviewMode(false);
  };

  const handleOptimize = async () => {
    if (promptNodes.length === 0 || isOptimizing) return;
    setIsOptimizing(true);
    try {
      const optimized = await optimizePrompt(fullPrompt, aiModel);
      if (optimized && optimized !== fullPrompt) {
        setPromptFromText(optimized);
      }
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleHighlight = async () => {
    if (!highlightQuery.trim() || promptNodes.length === 0) return;
    setIsHighlightLoading(true);
    try {
      const { highlightPromptNodes } = await import('../../services/aiService');
      const nodesToAnalyze = promptNodes.map(n => ({ id: n.id, text: n.text }));
      const result = await highlightPromptNodes(nodesToAnalyze, highlightQuery, aiModel);
      setHighlightMap(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsHighlightLoading(false);
    }
  };

  const clearHighlight = () => {
    setHighlightMap({});
    setHighlightQuery('');
    setIsHighlighting(false);
  };

  return (
    <div 
      ref={setDroppableRef}
      id="prompt-builder-container"
      className={`relative bg-white border-t transition-all duration-300 ease-in-out z-40 flex flex-col h-full ${isOver ? 'border-t-blue-500 ring-2 ring-blue-500/20' : 'border-zinc-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]'}`}
    >
      <div className="flex items-center justify-between px-4 h-14 shrink-0 bg-white border-b border-zinc-100">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <ChevronUp size={18} className="text-zinc-400" />
            Сборка промта
            <span className="bg-zinc-100 text-zinc-500 text-xs px-2 py-0.5 rounded-full ml-2">
              {promptNodes.length}
            </span>
          </div>
          
          <div className="h-4 w-px bg-zinc-200" />
          
          <button 
            onClick={() => setIsTranslationMode(!isTranslationMode)}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${isTranslationMode ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
            title="Перевод (EN/RU)"
          >
            <Languages size={16} />
          </button>
          
          <button 
            onClick={() => {
              if (isTextMode) {
                setPromptFromText(textModeValue);
                setIsTextMode(false);
              } else {
                setTextModeValue(fullPrompt);
                setIsTextMode(true);
              }
            }}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${isTextMode ? 'bg-blue-100 text-blue-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
            title="Текстовый режим"
          >
            <Type size={16} />
          </button>
        </div>
        
        <div className="flex items-center gap-2 flex-1 max-w-md ml-4">
          <div className={`flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-full px-3 py-1.5 transition-all focus-within:ring-2 focus-within:ring-purple-100 focus-within:border-purple-300 ${isAiInputExpanded ? 'w-full' : 'w-32 cursor-pointer hover:bg-zinc-100'}`} onClick={() => setIsAiInputExpanded(true)}>
            <Sparkles size={14} className="text-purple-500 shrink-0" />
            <input 
              placeholder="Ask AI to improve..." 
              className="bg-transparent text-xs outline-none w-full text-zinc-700 placeholder-zinc-400"
              value={aiQuery}
              onChange={e => setAiQuery(e.target.value)}
              onBlur={() => !aiQuery && setIsAiInputExpanded(false)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleAskAi();
                }
              }}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <ErrorBoundary fallback={<div className="text-[10px] text-red-500">Ошибка тулбара</div>}>
            <PromptToolbar />
          </ErrorBoundary>
          
          {selectedNodeIds.length > 1 && (
            <button 
              onClick={() => groupNodes(selectedNodeIds)}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-sm"
              title="Сгруппировать в один токен"
            >
              <Link size={14} />
              Группировать ({selectedNodeIds.length})
            </button>
          )}
          
          {selectedNodeIds.length > 0 && (
            <button 
              onClick={() => setSelectedNodeIds([])}
              className="p-1.5 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors"
              title="Снять выделение"
            >
              <Plus size={16} className="rotate-45" />
            </button>
          )}

          <div className="h-4 w-px bg-zinc-200 mx-1" />

          <button 
            onClick={clearPrompt}
            disabled={promptNodes.length === 0}
            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Очистить"
          >
            <Trash2 size={16} />
          </button>
          <button 
            onClick={() => setIsGeneratingImage(true)}
            disabled={promptNodes.length === 0}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Сгенерировать изображение"
          >
            <Sparkles size={14} />
            Сгенерировать
          </button>
          
          <button 
            onClick={copyPrompt}
            disabled={promptNodes.length === 0}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
              promptNodes.length === 0 
                ? 'text-zinc-400 bg-zinc-100 cursor-not-allowed' 
                : copied 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-zinc-900 text-white hover:bg-zinc-800'
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Скопировано' : 'Копировать'}
          </button>
        </div>
      </div>
      
      <div 
        ref={selectionContainerRef}
        id="selection-canvas"
        onMouseDown={!isTextMode ? handleMouseDown : undefined}
        onMouseMove={!isTextMode ? handleMouseMove : undefined}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 relative select-none"
        style={{
          background: 'linear-gradient(to right, rgba(244, 244, 245, 0.8) 0%, rgba(255, 255, 255, 1) 100%)'
        }}
      >
        {isTextMode ? (
          <textarea
            value={textModeValue}
            onChange={(e) => setTextModeValue(e.target.value)}
            className="w-full h-full min-h-[200px] p-4 bg-white border border-zinc-200 rounded-xl resize-none outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-zinc-800 font-mono text-sm shadow-inner"
            placeholder="Введите промт текстом..."
          />
        ) : (
          <>
            {selectionRect && (
              <div 
                className="absolute border-2 border-blue-500 border-dashed bg-blue-500/10 pointer-events-none z-50"
                style={{
                  left: selectionRect.x,
                  top: selectionRect.y,
                  width: selectionRect.w,
                  height: selectionRect.h
                }}
              />
            )}
            <SortableContext 
              items={[
                'insert_0',
                ...promptNodes.flatMap((node, index) => [node.id, `insert_${index + 1}`])
              ]}
              strategy={rectSortingStrategy}
            >
              <div className="flex flex-wrap gap-x-0.5 gap-y-1 content-start">
                {promptNodes.length === 0 && (
                  <div className="w-full py-4 flex items-center gap-3 text-zinc-400">
                    <Box size={20} className="opacity-20" />
                    <p className="text-sm">Промт пуст. Начните писать здесь:</p>
                  </div>
                )}
                
                {promptNodes.length > 0 && <InsertionPoint index={0} />}
                
                {promptNodes.map((node, index) => (
                  <div key={node.id} style={{ display: 'contents' }}>
                    <SortableNode 
                      node={node} 
                      highlightStrength={highlightMap[node.id] || 'none'} 
                      suggestionType={
                        activeSuggestionId 
                          ? aiSuggestions.find(s => s.id === activeSuggestionId)?.targetNodeIds?.includes(node.id) 
                            ? aiSuggestions.find(s => s.id === activeSuggestionId)?.type 
                            : null
                          : null
                      }
                      isAltPressed={isAltPressed} 
                      isTranslationMode={isTranslationMode}
                    />
                    <InsertionPoint index={index + 1} />
                  </div>
                ))}
                
                {activeInsertionIndex === null && <SmartTokenInput key="main-input" />}
              </div>
            </SortableContext>
          </>
        )}
      </div>

      {isTranslationMode && promptNodes.length > 0 && (
        <div className="border-t border-zinc-100 bg-zinc-50 p-3 text-sm text-zinc-600 italic shrink-0 shadow-inner">
          <div className="flex items-center gap-2 mb-1">
            <Languages size={14} className="text-blue-500" />
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
              {selectedNodeIds.length > 0 ? 'Перевод выделенного' : 'Синхронный перевод'}
            </span>
          </div>
          <div className="pl-5">
            {selectedNodeIds.length > 0 ? (
              isTranslatingSelection ? (
                <span className="text-zinc-400 flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" /> Переводим выделение...
                </span>
              ) : (
                <span className="text-blue-700 font-medium">{translatedSelection || '...'}</span>
              )
            ) : (
              isTranslating ? (
                <span className="text-zinc-400 flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" /> Переводим...
                </span>
              ) : (
                <span className="text-zinc-700">{translatedPrompt || 'Нет перевода'}</span>
              )
            )}
          </div>
        </div>
      )}

      {isReviewMode && (
        <div className="border-t border-zinc-100 bg-white p-3 shrink-0 shadow-inner flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-purple-500" />
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Предложения ИИ</span>
            </div>
            {!isReviewLoading && aiSuggestions.length > 0 && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsReviewMode(false)}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
                >
                  Отменить всё
                </button>
                <button 
                  onClick={applyAllSuggestions}
                  className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 transition-colors"
                >
                  Принять всё
                </button>
              </div>
            )}
            {!isReviewLoading && aiSuggestions.length === 0 && (
              <button 
                onClick={() => setIsReviewMode(false)}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
              >
                Закрыть
              </button>
            )}
          </div>
          
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
            {isReviewLoading ? (
              <div className="flex items-center justify-center w-full py-4 text-zinc-400 gap-2 text-sm">
                <Loader2 size={16} className="animate-spin" /> Анализируем промпт...
              </div>
            ) : aiSuggestions.length === 0 ? (
              <div className="text-sm text-zinc-500 py-2">Нет предложений или изменений.</div>
            ) : (
              aiSuggestions.map(suggestion => (
                <div 
                  key={suggestion.id} 
                  className={`min-w-[240px] max-w-[300px] border rounded-md p-2 snap-start flex flex-col gap-2 transition-colors cursor-pointer ${
                    activeSuggestionId === suggestion.id ? 'bg-zinc-100 border-zinc-300 ring-1 ring-zinc-300' : 'bg-zinc-50 border-zinc-200'
                  }`}
                  onMouseEnter={() => setActiveSuggestionId(suggestion.id)}
                  onMouseLeave={() => setActiveSuggestionId(null)}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      suggestion.type === 'remove' ? 'text-red-500 bg-red-50' :
                      suggestion.type === 'add' ? 'text-green-600 bg-green-50' :
                      suggestion.type === 'replace' ? 'text-amber-600 bg-amber-50' :
                      'text-blue-600 bg-blue-50'
                    }`}>
                      {suggestion.type === 'remove' ? 'Удалить' :
                       suggestion.type === 'add' ? 'Добавить' :
                       suggestion.type === 'replace' ? 'Заменить' : 'Переместить'}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => applySuggestion(suggestion)} className="p-1 text-zinc-400 hover:text-green-600 hover:bg-green-50 rounded" title="Принять"><Check size={12} /></button>
                      <button onClick={() => rejectSuggestion(suggestion.id)} className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded" title="Отклонить"><X size={12} /></button>
                    </div>
                  </div>
                  
                  <div className="text-sm font-medium break-words">
                    {suggestion.type === 'remove' && (
                      <span className="line-through text-zinc-400">{suggestion.targetText}</span>
                    )}
                    {suggestion.type === 'add' && (
                      <span className="text-green-700">{suggestion.newText}</span>
                    )}
                    {suggestion.type === 'replace' && (
                      <div className="flex flex-col gap-1">
                        <span className="line-through text-zinc-400 text-xs">{suggestion.targetText}</span>
                        <span className="text-amber-700">{suggestion.newText}</span>
                      </div>
                    )}
                    {suggestion.type === 'move' && (
                      <span className="text-blue-700">{suggestion.targetText}</span>
                    )}
                  </div>
                  
                  <p className="text-[10px] text-zinc-500 leading-tight mt-auto pt-1 border-t border-zinc-200">
                    {suggestion.reason}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isGeneratingImage && (
        <GenerateImageModal 
          prompt={fullPrompt} 
          onClose={() => setIsGeneratingImage(false)} 
        />
      )}
    </div>
  );
};
