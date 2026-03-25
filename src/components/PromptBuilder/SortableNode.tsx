import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, Edit2, Check, PlusCircle, Link, RefreshCw, Sparkles } from 'lucide-react';
import { PromptNode, Token } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { suggestReplacements } from '../../services/aiService';

interface SortableNodeProps {
  node: PromptNode;
  highlightStrength?: 'strong' | 'medium' | 'weak' | 'none';
  suggestionType?: 'add' | 'remove' | 'replace' | 'move' | null;
  isAltPressed?: boolean;
  isTranslationMode?: boolean;
}

export const SortableNode: React.FC<SortableNodeProps> = ({ node, highlightStrength = 'none', suggestionType = null, isAltPressed = false, isTranslationMode = false }) => {
  const { 
    removeFromPrompt, 
    updateNodeText, 
    setIsAddingToken, 
    setPrefillName, 
    setPromotingNodeId,
    tokens,
    setActiveCategory,
    setSelectedToken,
    selectedNodeIds,
    setSelectedNodeIds,
    addWordFormToToken,
    updateNode,
    promptNodes
  } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [editText, setEditText] = useState(node.text);
  const [isReplaceMenuOpen, setIsReplaceMenuOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const linkContainerRef = useRef<HTMLDivElement>(null);
  const [linkCoords, setLinkCoords] = useState<{top: number, left: number} | null>(null);

  useEffect(() => {
    if (isLinking && linkContainerRef.current) {
      const update = () => {
        const rect = linkContainerRef.current?.getBoundingClientRect();
        if (rect) {
          setLinkCoords({ top: rect.bottom + 4, left: rect.left });
        }
      };
      update();
      window.addEventListener('scroll', update, true);
      window.addEventListener('resize', update);
      return () => {
        window.removeEventListener('scroll', update, true);
        window.removeEventListener('resize', update);
      };
    }
  }, [isLinking, linkSearch]);

  const [isHovered, setIsHovered] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: node.id,
    data: {
      type: 'node',
      node: node
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0 : 1, // Hide original while dragging (DragOverlay shows the preview)
    perspective: '1000px'
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && 
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsReplaceMenuOpen(false);
      }
    };

    if (isReplaceMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      
      // Calculate position
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setMenuPosition({
          top: rect.top - 8,
          left: rect.left + rect.width / 2,
        });
      }
    }
    return () => {
      document.addEventListener('mousedown', handleClickOutside);
    };
  }, [isReplaceMenuOpen]);

  const handleSave = () => {
    if (editText.trim()) {
      updateNodeText(node.id, editText.trim());
    } else {
      setEditText(node.text);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditText(node.text);
      setIsEditing(false);
    }
  };

  const handleNodeClick = (e: React.MouseEvent) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      if (selectedNodeIds.includes(node.id)) {
        setSelectedNodeIds(selectedNodeIds.filter(id => id !== node.id));
      } else {
        setSelectedNodeIds([...selectedNodeIds, node.id]);
      }
      return;
    }

    // Normal click: select just this node
    setSelectedNodeIds([node.id]);

    if (node.type === 'token' && node.tokenId) {
      const token = tokens.find(t => t.id === node.tokenId);
      if (token) {
        // 1. Set category
        if (token.categoryIds && token.categoryIds.length > 0) {
          setActiveCategory(token.categoryIds[0]);
        }
        
        // 2. Select the token to show card
        setSelectedToken(token);
        
        // 4. Scroll to top/database area if needed (optional but good UX)
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handleLinkToken = (tokenId: string) => {
    const token = tokens.find(t => t.id === tokenId);
    if (token) {
      addWordFormToToken(tokenId, node.text);
      updateNode(node.id, { type: 'token', tokenId, text: node.text });
    }
    setIsLinking(false);
    setLinkSearch('');
  };

  const handleReplaceWith = (newText: string, newTokenId?: string) => {
    if (newTokenId) {
      updateNode(node.id, { type: 'token', tokenId: newTokenId, text: newText });
    } else {
      updateNode(node.id, { type: 'custom', tokenId: undefined, text: newText });
    }
    setIsReplaceMenuOpen(false);
  };

  const handleAiSuggest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAiLoading(true);
    const context = promptNodes.map(n => n.text).join(' ');
    const suggestions = await suggestReplacements(node.text, context);
    setAiSuggestions(suggestions);
    setIsAiLoading(false);
  };

  const currentToken = node.type === 'token' && node.tokenId ? tokens.find(t => t.id === node.tokenId) : null;
  const relatedTokens = currentToken && currentToken.categoryIds && currentToken.categoryIds.length > 0
    ? tokens.filter(t => 
        t.id !== currentToken.id && 
        t.categoryIds &&
        t.categoryIds.some(cId => currentToken.categoryIds.includes(cId))
      ).slice(0, 10)
    : [];

  const filteredLinkTokens = tokens.filter(t => 
    t.name.toLowerCase().includes(linkSearch.toLowerCase()) ||
    (t.aliases && t.aliases.some(a => a.toLowerCase().includes(linkSearch.toLowerCase())))
  ).slice(0, 5);

  if (isLinking) {
    return (
      <div ref={linkContainerRef} className="relative inline-flex items-center bg-white border border-blue-300 rounded-md px-2 py-1 h-8 z-50 shadow-lg">
        <input
          autoFocus
          value={linkSearch}
          onChange={e => setLinkSearch(e.target.value)}
          placeholder="Поиск токена..."
          className="text-xs outline-none w-32"
          onKeyDown={e => {
            if (e.key === 'Escape') setIsLinking(false);
          }}
        />
        <button onClick={() => setIsLinking(false)} className="ml-1 text-zinc-400 hover:text-zinc-600">
          <X size={12} />
        </button>
        {linkSearch && filteredLinkTokens.length > 0 && linkCoords && createPortal(
          <div 
            className="fixed bg-white border border-zinc-200 rounded-md shadow-xl z-[9999] overflow-hidden w-48"
            style={{ top: linkCoords.top, left: linkCoords.left }}
          >
            {filteredLinkTokens.map(t => (
              <button
                key={t.id}
                onClick={() => handleLinkToken(t.id)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors border-b border-zinc-50 last:border-0"
              >
                <div className="font-medium text-zinc-900">{t.name}</div>
                <div className="text-[10px] text-zinc-500 truncate">{t.descriptionShort}</div>
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>
    );
  }

  const getHighlightClass = () => {
    if (suggestionType) {
      switch (suggestionType) {
        case 'remove': return 'bg-red-100 border-red-300 text-red-800 ring-2 ring-red-300';
        case 'replace': return 'bg-amber-100 border-amber-300 text-amber-800 ring-2 ring-amber-300';
        case 'move': return 'bg-blue-100 border-blue-300 text-blue-800 ring-2 ring-blue-300';
        case 'add': return 'bg-green-100 border-green-300 text-green-800 ring-2 ring-green-300'; // Should not happen for existing nodes usually
        default: return '';
      }
    }

    switch (highlightStrength) {
      case 'strong': return 'bg-amber-300 border-amber-400 text-amber-900 ring-2 ring-amber-400';
      case 'medium': return 'bg-amber-200 border-amber-300 text-amber-800 ring-1 ring-amber-300';
      case 'weak': return 'bg-amber-100 border-amber-200 text-amber-800';
      default: return '';
    }
  };

  const hasHighlight = (highlightStrength && highlightStrength !== 'none') || suggestionType;
  const highlightClasses = getHighlightClass();

  if (node.type === 'separator') {
    if (node.text === '\n') {
       return (
         <div 
           ref={setNodeRef}
           id={`node-item-${node.id}`}
           style={style}
           {...attributes}
           {...listeners}
           className="w-full h-0 basis-full my-0" 
         />
       );
    }
    return (
      <div
        ref={setNodeRef}
        id={`node-item-${node.id}`}
        style={style}
        {...attributes}
        {...listeners}
        className={`group relative inline-flex items-center justify-center px-0.5 py-0.5 cursor-grab active:cursor-grabbing rounded ${highlightClasses}`}
      >
        <span className="text-zinc-800 font-bold text-base leading-none select-none">{node.text}</span>
      </div>
    );
  }

  const baseClasses = node.type === 'custom' 
    ? `${hasHighlight ? '' : 'bg-transparent'} border-b border-zinc-300 hover:border-zinc-400 rounded-none px-0.5 mx-0.5` 
    : `${hasHighlight ? '' : 'bg-white'} border border-zinc-200 shadow-sm hover:border-zinc-300 px-1.5 py-0.5`;

  const selectedClasses = selectedNodeIds.includes(node.id) ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200' : '';

  const showTranslation = (isAltPressed || isTranslationMode) && isHovered && currentToken && !isEditing;
  const translationText = currentToken?.descriptionShort || currentToken?.name || 'Нет перевода';

  return (
    <div
      ref={setNodeRef}
      id={`node-item-${node.id}`}
      style={style}
      onClick={handleNodeClick}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsReplaceMenuOpen(true);
        setMenuPosition({ top: e.clientY, left: e.clientX });
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative inline-flex items-center rounded-md text-sm transition-all duration-200 cursor-pointer h-7 ${baseClasses} ${highlightClasses} ${selectedClasses}`}
    >
      {isReplaceMenuOpen && createPortal(
        <div 
          ref={menuRef}
          className="fixed bg-white border border-zinc-200 rounded-lg shadow-xl z-[9999] overflow-hidden min-w-[180px] flex flex-col py-1"
          style={{ top: menuPosition.top, left: menuPosition.left }}
          onClick={e => e.stopPropagation()}
        >
          {aiSuggestions.length > 0 ? (
            <>
              <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-50 border-b border-zinc-100">
                AI Suggestions
              </div>
              {aiSuggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleReplaceWith(s)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-zinc-700 flex items-center gap-2"
                >
                  <Sparkles size={12} className="text-blue-500" />
                  {s}
                </button>
              ))}
              <div className="h-px bg-zinc-100 my-1" />
            </>
          ) : (
             <button
              onClick={handleAiSuggest}
              disabled={isAiLoading}
              className="w-full text-left px-3 py-2 text-xs hover:bg-purple-50 text-purple-700 flex items-center gap-2"
            >
              <Sparkles size={14} className={isAiLoading ? "animate-spin" : ""} />
              {isAiLoading ? "Thinking..." : "Suggest Replacements"}
            </button>
          )}
          
          <button
            onClick={() => {
              setIsLinking(true);
              setIsReplaceMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 text-zinc-700 flex items-center gap-2"
          >
            <Link size={14} />
            Link to Token
          </button>
          <button
            onClick={() => {
              setIsEditing(true);
              setIsReplaceMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 text-zinc-700 flex items-center gap-2"
          >
            <Edit2 size={14} />
            Edit Text
          </button>
          <div className="h-px bg-zinc-100 my-1" />
           <button
            onClick={() => {
              removeFromPrompt(node.id);
              setIsReplaceMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-600 flex items-center gap-2"
          >
            <X size={14} />
            Remove
          </button>
        </div>,
        document.body
      )}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing flex items-center w-full h-full relative"
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 0.3s ease',
          transform: showTranslation ? 'rotateX(180deg)' : 'rotateX(0deg)'
        }}
      >
        <div 
          className="flex items-center w-full h-full"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {isEditing ? (
            <div className="flex items-center" onClick={e => e.stopPropagation()}>
              <input
                ref={inputRef}
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSave}
                className="text-sm bg-transparent border-b border-blue-500 outline-none text-zinc-800 min-w-[40px]"
                style={{ width: `${Math.max(40, (editText || '').length * 8 + 8)}px` }}
              />
            </div>
          ) : (
            <span 
              className={`text-zinc-800 select-none whitespace-nowrap ${suggestionType === 'remove' ? 'line-through decoration-red-500 decoration-2' : ''} ${suggestionType === 'replace' ? 'line-through decoration-amber-500 decoration-2' : ''}`}
              onDoubleClick={(e) => {
                if (node.type === 'custom') {
                  e.stopPropagation();
                  setIsEditing(true);
                }
              }}
            >
              {node.text}
            </span>
          )}
        </div>
        
        {/* Back side (Translation) */}
        <div 
          className="absolute inset-0 flex items-center justify-center w-full h-full bg-blue-100 text-blue-800 rounded-md px-2 overflow-hidden"
          style={{ 
            backfaceVisibility: 'hidden', 
            transform: 'rotateX(180deg)',
          }}
        >
          <span className="text-xs font-medium select-none whitespace-nowrap truncate">
            {translationText}
          </span>
        </div>
      </div>
    </div>
  );
};
