import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../../context/AppContext';
import { Plus, History, Sparkles, PlusCircle, Type, Settings, Check, Wand2, Loader2 } from 'lucide-react';
import { Token, RecentInput } from '../../types';
import { suggestReplacements } from '../../services/aiService';

type Suggestion = 
  | { type: 'token', token: Token }
  | { type: 'recent', input: RecentInput }
  | { type: 'text', text: string }
  | { type: 'create', text: string }
  | { type: 'synonym', text: string };

interface SmartTokenInputProps {
  insertIndex?: number;
  onDone?: () => void;
  autoFocus?: boolean;
}

export const SmartTokenInput: React.FC<SmartTokenInputProps> = ({ insertIndex, onDone, autoFocus }) => {
  const { tokens, categories, addNode, insertNode, addToPrompt, promptNodes, recentInputs, setIsAddingToken, setPrefillName, setPromotingNodeId, searchSettings, setSearchSettings, setActiveInsertionIndex, removeFromPrompt, aiModel } = useAppContext();
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dropUp, setDropUp] = useState(true);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [isFetchingSynonyms, setIsFetchingSynonyms] = useState(false);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    const updateCoords = () => {
      if (isOpen && inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;
        
        setDropUp(spaceAbove > 300 || spaceAbove > spaceBelow);
        setCoords({
          top: rect.top,
          left: rect.left,
          width: rect.width
        });
      }
    };

    updateCoords();
    
    // Find the scrollable parent to listen for scroll events
    const scrollParent = inputRef.current?.closest('.overflow-y-auto');
    if (scrollParent) {
      scrollParent.addEventListener('scroll', updateCoords);
    }
    window.addEventListener('resize', updateCoords);

    return () => {
      if (scrollParent) {
        scrollParent.removeEventListener('scroll', updateCoords);
      }
      window.removeEventListener('resize', updateCoords);
    };
  }, [isOpen, suggestions.length]);

  useEffect(() => {
    if (!searchSettings.suggestSynonyms || !text.trim() || text.length < 3) {
      setSynonyms([]);
      return;
    }
    
    const timer = setTimeout(async () => {
      setIsFetchingSynonyms(true);
      try {
        const context = promptNodes.map(n => n.text).join(' ');
        const results = await suggestReplacements(text.trim(), context, aiModel);
        setSynonyms(results);
      } catch (e) {
        console.error(e);
      } finally {
        setIsFetchingSynonyms(false);
      }
    }, 600);
    
    return () => clearTimeout(timer);
  }, [text, searchSettings.suggestSynonyms, promptNodes, aiModel]);

  useEffect(() => {
    if (!text.trim()) {
      // Show recent inputs when empty but focused
      if (recentInputs.length > 0) {
        setSuggestions(recentInputs.slice(0, 5).map(i => ({ type: 'recent', input: i })));
        setSelectedIndex(-1); // Do not auto-select recent inputs
      } else {
        setSuggestions([]);
        setSelectedIndex(-1);
      }
      return;
    }

    const query = text.toLowerCase();
    
    const newSuggestions: Suggestion[] = [];

    // 1. Add "Just text" option
    newSuggestions.push({ type: 'text', text: text.trim() });

    // 2. Match tokens
    const matchedTokens = tokens.filter(t => {
      if (searchSettings.name && t.name.toLowerCase().includes(query)) return true;
      if (searchSettings.aliases && t.aliases.some(a => a.toLowerCase().includes(query))) return true;
      if (searchSettings.description && t.descriptionShort.toLowerCase().includes(query)) return true;
      if (searchSettings.category) {
        // Search in Categories (including ancestors)
        const getCategoryAndAncestors = (catId: string): string[] => {
          const cat = categories.find(c => c.id === catId);
          if (!cat) return [];
          if (!cat.parentId) return [cat.name.toLowerCase()];
          return [cat.name.toLowerCase(), ...getCategoryAndAncestors(cat.parentId)];
        };

        const allRelatedCatNames = t.categoryIds.flatMap(cid => getCategoryAndAncestors(cid));
        if (allRelatedCatNames.some(name => name.includes(query))) return true;
      }
      return false;
    }).slice(0, 5);

    matchedTokens.forEach(t => newSuggestions.push({ type: 'token', token: t }));

    // 3. Match recent inputs
    const matchedRecent = recentInputs.filter(ri => 
      ri.text.toLowerCase().includes(query) && 
      !matchedTokens.some(t => t.name.toLowerCase() === ri.text.toLowerCase())
    ).slice(0, 3);

    matchedRecent.forEach(ri => newSuggestions.push({ type: 'recent', input: ri }));

    // 4. Add "Create token" option (only if not an exact match of a token)
    if (!tokens.find(t => t.name.toLowerCase() === query) && text.length > 1) {
      newSuggestions.push({ type: 'create', text: text.trim() });
    }

    // 5. Add synonyms
    synonyms.forEach(syn => {
      if (!newSuggestions.some(s => (s.type === 'text' || s.type === 'create' || s.type === 'synonym') && s.text.toLowerCase() === syn.toLowerCase())) {
        newSuggestions.push({ type: 'synonym', text: syn });
      }
    });

    setSuggestions(newSuggestions);
    setSelectedIndex(newSuggestions.length > 0 ? 0 : -1);
    setIsOpen(true);
  }, [text, tokens, recentInputs, synonyms]);

  const parseAndAddNodes = (input: string, index?: number): number => {
    const matchables: { text: string, tokenId: string, originalName: string }[] = [];
    tokens.forEach(t => {
      matchables.push({ text: t.name, tokenId: t.id, originalName: t.name });
      if (t.aliases) {
        t.aliases.forEach(a => {
          if (a.trim()) matchables.push({ text: a.trim(), tokenId: t.id, originalName: t.name });
        });
      }
      if (t.wordForms) {
        t.wordForms.forEach(wf => {
          if (wf.trim()) matchables.push({ text: wf.trim(), tokenId: t.id, originalName: t.name });
        });
      }
    });
    
    matchables.sort((a, b) => b.text.length - a.text.length);
    
    let remainingText = input;
    let currentIdx = index;
    let addedCount = 0;

    while (remainingText.length > 0) {
      remainingText = remainingText.trimStart();
      if (remainingText.length === 0) break;

      let matched = null;
      for (const m of matchables) {
        const mText = m.text.toLowerCase();
        if (remainingText.toLowerCase().startsWith(mText)) {
          // Check for word boundary
          const nextChar = remainingText[m.text.length];
          if (!nextChar || /[^a-zA-Z0-9а-яА-Я\-]/.test(nextChar)) {
            matched = m;
            break;
          }
        }
      }

      if (matched) {
        const matchedSubstring = remainingText.slice(0, matched.text.length);
        if (currentIdx !== undefined) {
          insertNode({ type: 'token', tokenId: matched.tokenId, text: matchedSubstring }, currentIdx++);
        } else {
          addNode({ type: 'token', tokenId: matched.tokenId, text: matchedSubstring });
        }
        addedCount++;
        remainingText = remainingText.slice(matched.text.length);
      } else {
        // Check for separators
        const separatorMatch = remainingText.match(/^([.,!?;:\-+/*()\[\]{}="]+)/);
        if (separatorMatch) {
          if (currentIdx !== undefined) {
            insertNode({ type: 'separator', text: separatorMatch[0] }, currentIdx++);
          } else {
            addNode({ type: 'separator', text: separatorMatch[0] });
          }
          addedCount++;
          remainingText = remainingText.slice(separatorMatch[0].length);
        } else {
          // Take one word
          const wordMatch = remainingText.match(/^([^\s.,!?;:\-+/*()\[\]{}="]+(?:-[^\s.,!?;:\-+/*()\[\]{}="]+)*)/);
          if (wordMatch) {
            if (currentIdx !== undefined) {
              insertNode({ type: 'custom', text: wordMatch[0] }, currentIdx++);
            } else {
              addNode({ type: 'custom', text: wordMatch[0] });
            }
            addedCount++;
            remainingText = remainingText.slice(wordMatch[0].length);
          } else {
            // Safety break
            remainingText = remainingText.slice(1);
          }
        }
      }
    }
    return addedCount;
  };

  const handleSelect = (suggestion: Suggestion) => {
    if (suggestion.type === 'token') {
      if (insertIndex !== undefined) {
        insertNode({ type: 'token', tokenId: suggestion.token.id, text: suggestion.token.name }, insertIndex);
      } else {
        addToPrompt(suggestion.token);
      }
    } else if (suggestion.type === 'recent') {
      if (suggestion.input.type === 'token' && suggestion.input.tokenId) {
        const token = tokens.find(t => t.id === suggestion.input.tokenId);
        if (token) {
          if (insertIndex !== undefined) {
            insertNode({ type: 'token', tokenId: token.id, text: token.name }, insertIndex);
          } else {
            addToPrompt(token);
          }
        } else {
          if (insertIndex !== undefined) {
            insertNode({ type: 'custom', text: suggestion.input.text }, insertIndex);
          } else {
            addNode({ type: 'custom', text: suggestion.input.text });
          }
        }
      } else {
        if (insertIndex !== undefined) {
          insertNode({ type: 'custom', text: suggestion.input.text }, insertIndex);
        } else {
          addNode({ type: 'custom', text: suggestion.input.text });
        }
      }
    } else if (suggestion.type === 'text' || suggestion.type === 'synonym') {
      if (insertIndex !== undefined) {
        insertNode({ type: 'custom', text: suggestion.text }, insertIndex);
      } else {
        addNode({ type: 'custom', text: suggestion.text });
      }
    } else if (suggestion.type === 'create') {
      let nodeId;
      if (insertIndex !== undefined) {
        nodeId = insertNode({ type: 'custom', text: suggestion.text }, insertIndex);
      } else {
        nodeId = addNode({ type: 'custom', text: suggestion.text });
      }
      if (setPromotingNodeId) setPromotingNodeId(nodeId);
      setPrefillName(suggestion.text);
      setIsAddingToken(true);
    }
    setText('');
    setIsOpen(false);
    if (onDone) onDone();
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      
      if (e.shiftKey) {
        // Shift+Enter always adds a newline
        if (insertIndex !== undefined) {
           insertNode({ type: 'separator', text: '\n' }, insertIndex);
        } else {
           addNode({ type: 'separator', text: '\n' });
        }
        if (text.trim()) {
           parseAndAddNodes(text, insertIndex);
           setText('');
        }
        if (onDone) onDone();
      } else {
        // Regular Enter
        const endsWithSpace = text.endsWith(' ');
        let nodesAdded = 0;
        let processed = false;

        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex]);
          nodesAdded = 1; // handleSelect adds 1 node
          processed = true;
        } else if (text.trim()) {
          nodesAdded = parseAndAddNodes(text, insertIndex);
          processed = true;
        }

        if (processed) {
          if (!endsWithSpace) {
            // If NO space at the end, add a newline automatically
            if (insertIndex !== undefined) {
               insertNode({ type: 'separator', text: '\n' }, insertIndex + nodesAdded);
            } else {
               addNode({ type: 'separator', text: '\n' });
            }
          }
          
          setText('');
          setIsOpen(false);
          if (onDone) onDone();
          setTimeout(() => inputRef.current?.focus(), 10);
        } else {
          // Empty text + Enter = Newline
           if (insertIndex !== undefined) {
             insertNode({ type: 'separator', text: '\n' }, insertIndex);
           } else {
             addNode({ type: 'separator', text: '\n' });
           }
           if (onDone) onDone();
        }
      }
    } else if (e.key === ' ' && text.trim()) {
      // Space as separator
      e.preventDefault();
      parseAndAddNodes(text, insertIndex);
      setText('');
      // Don't close, just keep typing
    } else if (e.key === 'ArrowLeft' && text === '') {
      e.preventDefault();
      if (insertIndex === undefined) {
        // We are at the end, move to the last insertion point
        setActiveInsertionIndex(promptNodes.length);
      } else if (insertIndex > 0) {
        setActiveInsertionIndex(insertIndex - 1);
      }
    } else if (e.key === 'ArrowRight' && text === '') {
      e.preventDefault();
      if (insertIndex !== undefined) {
        if (insertIndex < promptNodes.length) {
          setActiveInsertionIndex(insertIndex + 1);
        } else {
          setActiveInsertionIndex(null); // Move to end
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      if (onDone) onDone();
    } else if (e.key === 'Backspace' && text === '') {
      e.preventDefault();
      if (insertIndex !== undefined) {
        if (insertIndex > 0) {
          const nodeToDelete = promptNodes[insertIndex - 1];
          if (nodeToDelete) {
            removeFromPrompt(nodeToDelete.id);
            setActiveInsertionIndex(insertIndex - 1);
          }
        }
      } else if (promptNodes.length > 0) {
        const lastNode = promptNodes[promptNodes.length - 1];
        removeFromPrompt(lastNode.id);
      }
    } else if (e.key === 'Delete' && text === '') {
      e.preventDefault();
      if (insertIndex !== undefined && insertIndex < promptNodes.length) {
        const nodeToDelete = promptNodes[insertIndex];
        if (nodeToDelete) {
          removeFromPrompt(nodeToDelete.id);
        }
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText) {
      e.preventDefault();
      parseAndAddNodes(text + pastedText, insertIndex);
      setText('');
      setIsOpen(false);
      if (onDone) onDone();
    }
  };

  return (
    <div className="relative flex items-center">
      <input
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        placeholder={insertIndex !== undefined ? "..." : (promptNodes.length === 0 ? "Пишите промт..." : "+")}
        style={{ width: text ? `${Math.max(40, text.length * 8 + 20)}px` : (insertIndex !== undefined ? '40px' : (promptNodes.length === 0 ? '140px' : '30px')) }}
        className="bg-transparent border-b border-zinc-300 px-1 py-1 text-sm outline-none focus:border-blue-500 transition-all placeholder:text-zinc-400"
      />
      
      {isOpen && suggestions.length > 0 && coords.top > 0 && createPortal(
        <div 
          className="fixed w-80 bg-white border border-zinc-200 shadow-xl rounded-lg overflow-hidden z-[9999] flex flex-col max-h-80"
          style={{
            left: coords.left,
            top: dropUp ? 'auto' : coords.top + 36, // 36 is input height
            bottom: dropUp ? window.innerHeight - coords.top + 8 : 'auto'
          }}
          onMouseDown={e => e.preventDefault()} // Prevent input blur
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 bg-zinc-50/50">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              Подсказки
              {isFetchingSynonyms && <Loader2 size={10} className="animate-spin text-blue-500" />}
            </span>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1 rounded transition-colors ${showSettings ? 'bg-blue-100 text-blue-600' : 'text-zinc-400 hover:bg-zinc-200'}`}
              title="Настройки поиска"
            >
              <Settings size={14} />
            </button>
          </div>

          {showSettings && (
            <div className="p-3 border-b border-zinc-100 bg-blue-50/30 space-y-3">
              <div>
                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2">Где искать:</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'name', label: 'Имя' },
                    { id: 'aliases', label: 'Синонимы' },
                    { id: 'description', label: 'Описание' },
                    { id: 'category', label: 'Категория' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setSearchSettings({ ...searchSettings, [opt.id]: !searchSettings[opt.id as keyof typeof searchSettings] })}
                      className="flex items-center justify-between px-2 py-1.5 rounded bg-white border border-zinc-200 text-[11px] text-zinc-600 hover:border-blue-300 transition-colors"
                    >
                      <span>{opt.label}</span>
                      {searchSettings[opt.id as keyof typeof searchSettings] && <Check size={10} className="text-blue-600" />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pt-2 border-t border-blue-100/50">
                <button
                  onClick={() => setSearchSettings({ ...searchSettings, suggestSynonyms: !searchSettings.suggestSynonyms })}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded bg-white border border-zinc-200 text-[11px] text-zinc-600 hover:border-blue-300 transition-colors"
                >
                  <span className="flex items-center gap-1.5"><Wand2 size={12} className="text-blue-500"/> Предлагать синонимы (ИИ)</span>
                  {searchSettings.suggestSynonyms && <Check size={10} className="text-blue-600" />}
                </button>
              </div>
            </div>
          )}

          <div className="overflow-y-auto">
            {suggestions.map((s, idx) => (
              <div
                key={idx}
                onClick={() => handleSelect(s)}
                className={`px-3 py-2 cursor-pointer flex items-center gap-3 ${idx === selectedIndex ? 'bg-blue-50' : 'hover:bg-zinc-50'}`}
              >
                {s.type === 'text' && (
                  <>
                    <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center text-zinc-500 shrink-0">
                      <Type size={16} />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-medium text-zinc-900 truncate">Вставить как текст: "{s.text}"</span>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Без сохранения</span>
                    </div>
                  </>
                )}
                {s.type === 'token' && (
                  <>
                    <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                      <Sparkles size={16} />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-medium text-zinc-900 truncate">{s.token.name}</span>
                      <span className="text-[10px] text-zinc-500 truncate">{s.token.descriptionShort}</span>
                    </div>
                  </>
                )}
                {s.type === 'recent' && (
                  <>
                    <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center text-zinc-400 shrink-0">
                      <History size={16} />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-medium text-zinc-900 truncate">{s.input.text}</span>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Недавнее</span>
                    </div>
                  </>
                )}
                {s.type === 'create' && (
                  <>
                    <div className="w-8 h-8 rounded bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                      <PlusCircle size={16} />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-medium text-purple-700 truncate">Добавить в базу: "{s.text}"</span>
                      <span className="text-[10px] text-purple-500 uppercase tracking-wider">Новый токен</span>
                    </div>
                  </>
                )}
                {s.type === 'synonym' && (
                  <>
                    <div className="w-8 h-8 rounded bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                      <Wand2 size={16} />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-medium text-emerald-900 truncate">{s.text}</span>
                      <span className="text-[10px] text-emerald-600 uppercase tracking-wider">Синоним (ИИ)</span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
