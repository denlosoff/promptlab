import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { X, Sparkles, Loader2, Search, Plus, ArrowRight, Check, ChevronRight, ChevronDown, Folder } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { Category, Token } from '../types';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CategorySelect = ({ categories, value, onChange }: { categories: Category[], value: string, onChange: (val: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const selectedCategory = categories.find(c => c.id === value);

  const filteredCategories = search 
    ? categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : categories;

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const renderTree = (parentId: string | null = null, depth = 0) => {
    const children = categories.filter(c => parentId ? c.parentId === parentId : !c.parentId);
    if (children.length === 0) return null;

    return children.map(c => {
      const hasChildren = categories.some(child => child.parentId === c.id);
      const isExpanded = expandedIds.has(c.id);
      const isSelected = value === c.id;

      return (
        <div key={c.id}>
          <div 
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-50 ${isSelected ? 'bg-purple-50 text-purple-700' : 'text-zinc-700'}`}
            style={{ paddingLeft: `${depth * 16 + 12}px` }}
            onClick={() => {
              onChange(c.id);
              setIsOpen(false);
              setSearch('');
            }}
          >
            {hasChildren ? (
              <button 
                onClick={(e) => toggleExpand(e, c.id)}
                className="p-0.5 hover:bg-zinc-200 rounded text-zinc-400"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <div className="w-4" />
            )}
            <Folder size={14} className={isSelected ? 'text-purple-500' : 'text-zinc-400'} />
            <span className="text-sm truncate">{c.name}</span>
          </div>
          {isExpanded && hasChildren && renderTree(c.id, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="border border-zinc-300 rounded-md bg-white overflow-hidden">
      <div 
        className="w-full px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-purple-500 cursor-pointer flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedCategory ? 'text-zinc-900 font-medium' : 'text-zinc-500'}>
          {selectedCategory ? selectedCategory.name : '-- Выберите категорию --'}
        </span>
        <ChevronDown size={16} className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="border-t border-zinc-200 flex flex-col max-h-64">
          <div className="p-2 border-b border-zinc-100 shrink-0 bg-zinc-50">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input 
                type="text"
                placeholder="Поиск категории..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-zinc-200 rounded focus:outline-none focus:border-purple-400 bg-white"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 py-1">
            {search ? (
              filteredCategories.length > 0 ? (
                filteredCategories.map(c => (
                  <div 
                    key={c.id}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-50 ${value === c.id ? 'bg-purple-50 text-purple-700' : 'text-zinc-700'}`}
                    onClick={() => {
                      onChange(c.id);
                      setIsOpen(false);
                      setSearch('');
                    }}
                  >
                    <Folder size={14} className={value === c.id ? 'text-purple-500' : 'text-zinc-400'} />
                    <span className="text-sm truncate">{c.name}</span>
                  </div>
                ))
              ) : (
                <div className="px-3 py-4 text-sm text-zinc-500 text-center">Ничего не найдено</div>
              )
            ) : (
              renderTree()
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ isOpen, onClose }) => {
  const { categories, tokens, startDraft, aiModel } = useAppContext();
  
  const [task, setTask] = useState<'category' | 'subcategory' | 'token'>('token');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Prepare context
      const contextData = {
        categories: categories.map(c => ({ id: c.id, name: c.name, parentId: c.parentId })),
        tokens: tokens.map(t => ({ id: t.id, name: t.name, categoryIds: t.categoryIds, aliases: t.aliases }))
      };

      let systemInstruction = `You are an expert AI assistant helping to build a comprehensive database of prompt tokens for image generation.
Your task is to suggest new additions to the database based on the user's request.
IMPORTANT RULES:
1. DO NOT duplicate existing categories or tokens.
2. If a token already exists but fits the requested category, suggest adding it to the new category instead of creating a new token.
3. Provide high-quality, professional descriptions and aliases.
4. Return your response strictly matching the provided JSON schema.
5. Categories can be nested. Use parentId to specify the parent category.
6. CRITICAL: Token names MUST be in English. Token descriptions and aliases MUST be in Russian. Category names MUST be in Russian.`;

      let prompt = `Current Database State: ${JSON.stringify(contextData)}\n\n`;

      if (task === 'category') {
        prompt += `Task: Suggest 3-5 new useful top-level categories for an image generation prompt tool. ${customPrompt}`;
      } else if (task === 'subcategory') {
        const cat = categories.find(c => c.id === selectedCategoryId);
        prompt += `Task: Suggest 3-5 new subcategories for the category "${cat?.name}" (ID: ${cat?.id}). ${customPrompt}`;
      } else if (task === 'token') {
        const cat = categories.find(c => c.id === selectedCategoryId);
        prompt += `Task: Suggest 5-10 new tokens for the category "${cat?.name}" (ID: ${cat?.id}). ${customPrompt}`;
      }

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          thoughts: { type: Type.STRING, description: "Your reasoning for the suggested changes." },
          newCategories: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                tempId: { type: Type.STRING, description: "A temporary ID like 'temp_cat_1'" },
                parentId: { type: Type.STRING, description: "Existing category ID or a tempId" },
                name: { type: Type.STRING },
                icon: { type: Type.STRING, description: "One of: Sun, Palette, Camera, Box, Sparkles, Monitor, LayoutGrid" }
              }
            }
          },
          newTokens: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                descriptionShort: { type: Type.STRING },
                aliases: { type: Type.ARRAY, items: { type: Type.STRING } },
                categoryIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of existing category IDs or tempIds" }
              }
            }
          },
          modifiedTokens: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                tokenId: { type: Type.STRING },
                addCategoryIds: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          }
        }
      };

      const response = await ai.models.generateContent({
        model: aiModel,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.7
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      // Process the result into draft data
      const draftCategories = [...categories];
      const draftTokens = [...tokens];

      const idMap: Record<string, string> = {};

      const getParentIds = (catId: string, cats: any[]): string[] => {
        const parents: string[] = [];
        let current = cats.find(c => c.id === catId);
        while (current && current.parentId) {
          parents.push(current.parentId);
          current = cats.find(c => c.id === current.parentId);
        }
        return parents;
      };

      if (result.newCategories) {
        result.newCategories.forEach((c: any) => {
          const newId = 'cat_' + Date.now() + Math.random().toString(36).substr(2, 5);
          idMap[c.tempId] = newId;
          const parentId = idMap[c.parentId] || c.parentId || (task === 'subcategory' ? selectedCategoryId : null);
          draftCategories.push({ id: newId, name: c.name, icon: c.icon || 'Box', parentId, isNew: true });
        });
      }

      if (result.newTokens) {
        result.newTokens.forEach((t: any) => {
          const newId = 't_' + Date.now() + Math.random().toString(36).substr(2, 5);
          
          let catIds = ((t.categoryIds as string[]) || []).map((id: string) => idMap[id] || id);
          if (task === 'token' && selectedCategoryId && !catIds.includes(selectedCategoryId)) {
            catIds.push(selectedCategoryId);
          }

          const allCatIds = new Set<string>(catIds);
          catIds.forEach((id: string) => {
            getParentIds(id, draftCategories).forEach(pId => allCatIds.add(pId));
          });

          draftTokens.push({
            id: newId,
            name: t.name,
            descriptionShort: t.descriptionShort,
            aliases: (t.aliases as string[]) || [],
            categoryIds: Array.from(allCatIds),
            examples: [],
            isNew: true
          });
        });
      }

      if (result.modifiedTokens) {
        result.modifiedTokens.forEach((mt: any) => {
          const tokenIndex = draftTokens.findIndex(t => t.id === mt.tokenId);
          if (tokenIndex !== -1) {
            const token = { ...draftTokens[tokenIndex] };
            if (mt.addCategoryIds) {
              const newCatIds = (mt.addCategoryIds as string[]).map((id: string) => idMap[id] || id);
              const allNewCatIds = new Set<string>(newCatIds);
              newCatIds.forEach((id: string) => {
                getParentIds(id, draftCategories).forEach(pId => allNewCatIds.add(pId));
              });
              token.categoryIds = Array.from(new Set([...token.categoryIds, ...Array.from(allNewCatIds)]));
            }
            token.isModified = true;
            draftTokens[tokenIndex] = token;
          }
        });
      }

      startDraft({
        categories: draftCategories,
        tokens: draftTokens
      });
      
      onClose();
      
    } catch (e) {
      console.error(e);
      alert('Ошибка при генерации предложений.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
            <Sparkles size={20} className="text-purple-500" />
            AI Ассистент
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm text-zinc-600 mb-6">
            Ассистент может проанализировать вашу базу и предложить новые категории, фильтры или токены. 
            Он не будет дублировать существующие элементы и предложит перенести токен, если он уже есть в другой категории.
          </p>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-900 mb-2">Что нужно сделать?</label>
              <div className="grid grid-cols-3 gap-3">
                <button 
                  onClick={() => setTask('category')}
                  className={`p-3 rounded-lg border text-left transition-colors ${task === 'category' ? 'border-purple-500 bg-purple-50 text-purple-900' : 'border-zinc-200 hover:border-zinc-300 text-zinc-700'}`}
                >
                  <div className="font-medium text-sm mb-1">Найти категории</div>
                  <div className="text-xs opacity-70">Новые верхнеуровневые категории</div>
                </button>
                <button 
                  onClick={() => setTask('subcategory')}
                  className={`p-3 rounded-lg border text-left transition-colors ${task === 'subcategory' ? 'border-purple-500 bg-purple-50 text-purple-900' : 'border-zinc-200 hover:border-zinc-300 text-zinc-700'}`}
                >
                  <div className="font-medium text-sm mb-1">Найти подкатегории</div>
                  <div className="text-xs opacity-70">Новые вложенные категории</div>
                </button>
                <button 
                  onClick={() => setTask('token')}
                  className={`p-3 rounded-lg border text-left transition-colors ${task === 'token' ? 'border-purple-500 bg-purple-50 text-purple-900' : 'border-zinc-200 hover:border-zinc-300 text-zinc-700'}`}
                >
                  <div className="font-medium text-sm mb-1">Найти токены</div>
                  <div className="text-xs opacity-70">Найти новые эффекты и стили</div>
                </button>
              </div>
            </div>

            {(task === 'subcategory' || task === 'token') && (
              <div>
                <label className="block text-sm font-medium text-zinc-900 mb-2">Выберите родительскую категорию</label>
                <CategorySelect 
                  categories={categories}
                  value={selectedCategoryId}
                  onChange={setSelectedCategoryId}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-900 mb-2">Дополнительные пожелания (опционально)</label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Например: 'Сделай упор на кинематографичное освещение' или 'Нужны стили киберпанка'"
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:ring-2 focus:ring-purple-500 outline-none"
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50 flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200 rounded-md transition-colors"
          >
            Отмена
          </button>
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || ((task === 'subcategory' || task === 'token') && !selectedCategoryId)}
            className="px-4 py-2 text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Анализ базы...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Сгенерировать предложения
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
