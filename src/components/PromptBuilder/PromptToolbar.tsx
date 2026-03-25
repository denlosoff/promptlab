import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Link as LinkIcon, Edit2, Trash2, Sparkles } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { suggestReplacements } from '../../services/aiService';

export const PromptToolbar = () => {
  const { 
    selectedNodeIds, 
    promptNodes, 
    tokens, 
    updateNode, 
    removeFromPrompt,
    addWordFormToToken,
    setSelectedNodeIds,
    setPromotingNodeId,
    setPrefillName,
    setIsAddingToken
  } = useAppContext();
  
  const [isReplaceMenuOpen, setIsReplaceMenuOpen] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0 });
  
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const linkMenuRef = useRef<HTMLDivElement>(null);
  const linkButtonRef = useRef<HTMLButtonElement>(null);

  const updateCoords = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setMenuCoords({
      top: rect.bottom + 4,
      left: rect.left
    });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && 
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsReplaceMenuOpen(false);
      }
      if (linkMenuRef.current && !linkMenuRef.current.contains(event.target as Node) && 
          linkButtonRef.current && !linkButtonRef.current.contains(event.target as Node)) {
        setIsLinking(false);
      }
    };

    if (isReplaceMenuOpen || isLinking) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isReplaceMenuOpen, isLinking]);

  if (selectedNodeIds.length !== 1) return null;

  const nodeId = selectedNodeIds[0];
  const node = promptNodes.find(n => n.id === nodeId);
  if (!node || node.type === 'separator') return null;

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

  const handleLinkToken = (tokenId: string) => {
    const token = tokens.find(t => t.id === tokenId);
    if (token) {
      addWordFormToToken(tokenId, node.text);
      updateNode(node.id, { type: 'token', tokenId, text: node.text });
    }
    setIsLinking(false);
    setLinkSearch('');
  };

  return (
    <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-md mr-2">
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={(e) => {
            if (!isReplaceMenuOpen) updateCoords(e.currentTarget);
            setIsReplaceMenuOpen(!isReplaceMenuOpen);
            setIsLinking(false);
          }}
          className={`p-1.5 rounded-md transition-colors ${isReplaceMenuOpen ? 'bg-white shadow-sm text-blue-600' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200'}`}
          title="Заменить"
        >
          <RefreshCw size={14} />
        </button>

        {isReplaceMenuOpen && createPortal(
          <div 
            ref={menuRef}
            className="fixed w-64 bg-white border border-zinc-200 rounded-lg shadow-xl z-[9999] overflow-hidden flex flex-col"
            style={{ top: menuCoords.top, left: menuCoords.left }}
            onClick={e => e.stopPropagation()}
          >
            <div className="max-h-64 overflow-y-auto scrollbar-thin">
              {currentToken && currentToken.aliases && currentToken.aliases.length > 0 && (
                <div className="p-2 border-b border-zinc-100">
                  <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 px-1">Синонимы</div>
                  <div className="flex flex-wrap gap-1">
                    {currentToken.aliases.map(alias => (
                      <button
                        key={alias}
                        onClick={() => handleReplaceWith(alias, currentToken.id)}
                        className="px-2 py-1 text-xs bg-zinc-100 hover:bg-blue-50 text-zinc-700 hover:text-blue-700 rounded transition-colors"
                      >
                        {alias}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {relatedTokens.length > 0 && (
                <div className="p-2 border-b border-zinc-100">
                  <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 px-1">Из той же категории</div>
                  <div className="flex flex-wrap gap-1">
                    {relatedTokens.map(rt => (
                      <button
                        key={rt.id}
                        onClick={() => handleReplaceWith(rt.name, rt.id)}
                        className="px-2 py-1 text-xs bg-zinc-100 hover:bg-blue-50 text-zinc-700 hover:text-blue-700 rounded transition-colors"
                      >
                        {rt.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {aiSuggestions.length > 0 && (
                <div className="p-2 border-b border-zinc-100 bg-purple-50/50">
                  <div className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider mb-1 px-1 flex items-center gap-1">
                    <Sparkles size={10} /> AI Варианты
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {aiSuggestions.map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => handleReplaceWith(sug)}
                        className="px-2 py-1 text-xs bg-white border border-purple-200 hover:bg-purple-100 text-purple-700 rounded transition-colors shadow-sm"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-2 bg-zinc-50 border-t border-zinc-200">
              <button
                onClick={handleAiSuggest}
                disabled={isAiLoading}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAiLoading ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} className="text-purple-500" />
                )}
                {isAiLoading ? 'Генерация...' : 'Предложить замену ИИ'}
              </button>
            </div>
          </div>,
          document.body
        )}
      </div>

      {node.type === 'custom' && (
        <>
          <div className="relative">
            <button
              ref={linkButtonRef}
              onClick={(e) => {
                if (!isLinking) updateCoords(e.currentTarget);
                setIsLinking(!isLinking);
                setIsReplaceMenuOpen(false);
              }}
              className={`p-1.5 rounded-md transition-colors ${isLinking ? 'bg-white shadow-sm text-blue-600' : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200'}`}
              title="Связать с токеном"
            >
              <LinkIcon size={14} />
            </button>

            {isLinking && createPortal(
              <div 
                ref={linkMenuRef}
                className="fixed w-48 bg-white border border-zinc-200 rounded-md shadow-xl z-[9999] overflow-hidden"
                style={{ top: menuCoords.top, left: menuCoords.left }}
                onClick={e => e.stopPropagation()}
              >
                <div className="p-2 border-b border-zinc-100">
                  <input
                    autoFocus
                    value={linkSearch}
                    onChange={e => setLinkSearch(e.target.value)}
                    placeholder="Поиск токена..."
                    className="w-full text-xs outline-none bg-zinc-50 px-2 py-1.5 rounded border border-zinc-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
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
                  {filteredLinkTokens.length === 0 && linkSearch && (
                    <div className="px-3 py-4 text-center text-xs text-zinc-500">
                      Ничего не найдено
                    </div>
                  )}
                </div>
              </div>,
              document.body
            )}
          </div>
          
          <button
            onClick={() => {
              setPromotingNodeId(node.id);
              setPrefillName(node.text);
              setIsAddingToken(true);
            }}
            className="p-1.5 text-zinc-500 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
            title="Добавить в базу"
          >
            <Sparkles size={14} />
          </button>
        </>
      )}

      <button
        onClick={() => {
          removeFromPrompt(node.id);
          setSelectedNodeIds([]);
        }}
        className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
        title="Удалить"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};
