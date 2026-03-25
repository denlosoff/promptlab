import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Loader2, Plus, Edit2, AlertCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { analyzePromptForTokens } from '../services/aiService';
import { SuggestedToken, Token } from '../types';
import { TokenForm } from './TokenForm';

interface ImportTokensModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportTokensModal: React.FC<ImportTokensModalProps> = ({ isOpen, onClose }) => {
  const { categories, tokens, addToken, addCategory } = useAppContext();
  const [promptInput, setPromptInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedToken[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [editingToken, setEditingToken] = useState<SuggestedToken | null>(null);

  const handleAnalyze = async () => {
    if (!promptInput.trim()) return;
    setIsAnalyzing(true);
    setSkippedCount(0);
    try {
      const results = await analyzePromptForTokens(promptInput, categories);
      
      // Filter out tokens that already exist in the database
      const existingTerms = new Set<string>();
      tokens.forEach(t => {
        if (t.name) existingTerms.add(t.name.toLowerCase().trim());
        if (t.aliases) t.aliases.forEach(a => existingTerms.add(a.toLowerCase().trim()));
        if (t.wordForms) t.wordForms.forEach(w => existingTerms.add(w.toLowerCase().trim()));
      });

      const newSuggestions = results.filter(s => {
        if (!s.name) return false;
        const suggestedName = s.name.toLowerCase().trim();
        
        // Check if the suggested name matches any existing term
        if (existingTerms.has(suggestedName)) return false;
        
        // Check if any of the suggested aliases match existing terms
        const hasExistingAlias = s.aliases?.some(a => existingTerms.has(a.toLowerCase().trim()));
        if (hasExistingAlias) return false;

        // Add the new suggestion to existingTerms so we don't allow duplicates within the same batch
        existingTerms.add(suggestedName);
        if (s.aliases) s.aliases.forEach(a => existingTerms.add(a.toLowerCase().trim()));
        if (s.wordForms) s.wordForms.forEach(w => existingTerms.add(w.toLowerCase().trim()));

        return true;
      });

      setSkippedCount(results.length - newSuggestions.length);
      setSuggestions(newSuggestions);
      setStep('review');
    } catch (error) {
      console.error('Failed to analyze prompt:', error);
      alert('Ошибка при анализе промта. Попробуйте еще раз.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAccept = (token: SuggestedToken) => {
    let finalCategoryIds: string[] = [];
    
    // Process each suggested category
    token.categoryIds.forEach((catId, index) => {
      if (catId) {
        finalCategoryIds.push(catId);
      } else if (token.categoryNames[index]) {
        // If it's a new category suggestion, create it first
        // Note: We might want to parse the full path here and create parent categories if needed,
        // but for simplicity we'll just create a new category with the full path as its name for now.
        const newCategory = {
          id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: token.categoryNames[index],
          isNew: true
        };
        addCategory(newCategory);
        finalCategoryIds.push(newCategory.id);
      }
    });

    // Add the token
    addToken({
      id: `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: token.name,
      descriptionShort: token.descriptionShort,
      categoryIds: finalCategoryIds,
      aliases: token.aliases,
      wordForms: token.wordForms,
      examples: token.examples,
      isNew: true
    });

    // Remove from suggestions
    setSuggestions(prev => prev.filter(s => s.id !== token.id));
  };

  const handleReject = (id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  const handleAcceptAll = () => {
    suggestions.forEach(token => handleAccept(token));
    onClose();
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'border-green-500 bg-green-50/50';
    if (confidence >= 0.5) return 'border-yellow-500 bg-yellow-50/50';
    return 'border-red-500 bg-red-50/50';
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.8) return 'Высокая уверенность';
    if (confidence >= 0.5) return 'Средняя уверенность';
    return 'Низкая уверенность';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between p-6 border-b border-zinc-100 shrink-0">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900">Импорт токенов из промта</h2>
              <p className="text-sm text-zinc-500 mt-1">
                {step === 'input' ? 'Вставьте промт, и ИИ предложит токены для базы' : 'Проверьте и отредактируйте предложенные токены'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 bg-zinc-50/50">
            {step === 'input' ? (
              <div className="space-y-4 h-full flex flex-col">
                <textarea
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="Вставьте ваш промт сюда (например: A cinematic shot of a cyberpunk city at night, neon lights, 8k resolution, highly detailed...)"
                  className="w-full flex-1 min-h-[300px] p-4 bg-white border border-zinc-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-zinc-800 placeholder:text-zinc-400"
                />
              </div>
            ) : (
              <div className="space-y-4">
                {skippedCount > 0 && (
                  <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-xl text-sm flex items-start gap-3 border border-blue-100">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-blue-500" />
                    <p>
                      <strong>Пропущено токенов: {skippedCount}</strong>. Они (или их синонимы) уже существуют в вашей базе.
                    </p>
                  </div>
                )}
                
                {suggestions.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-zinc-300" />
                    <p>Нет новых предложенных токенов. Попробуйте другой промт.</p>
                    <button 
                      onClick={() => setStep('input')}
                      className="mt-4 text-blue-600 hover:underline"
                    >
                      Вернуться назад
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {suggestions.map((token) => (
                      <div 
                        key={token.id} 
                        className={`bg-white rounded-xl p-4 border-2 transition-all ${getConfidenceColor(token.confidence)}`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-zinc-900 text-lg">{token.name}</h3>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {token.categoryNames && token.categoryNames.length > 0 ? (
                                token.categoryNames.map((catName, idx) => (
                                  <span key={idx} className="text-[10px] font-medium text-zinc-600 bg-white/80 px-2 py-0.5 rounded-full border border-zinc-200 inline-block">
                                    {catName}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] font-medium text-zinc-500 bg-white/80 px-2 py-0.5 rounded-full border border-zinc-200 inline-block">
                                  Без категории
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleReject(token.id)}
                              className="p-1.5 text-red-500 hover:bg-red-100 rounded-md transition-colors"
                              title="Отклонить"
                            >
                              <X size={16} />
                            </button>
                            <button
                              onClick={() => handleAccept(token)}
                              className="p-1.5 text-green-600 hover:bg-green-100 rounded-md transition-colors"
                              title="Принять"
                            >
                              <Check size={16} />
                            </button>
                          </div>
                        </div>
                        
                        <p className="text-sm text-zinc-600 mb-3 line-clamp-2" title={token.descriptionShort}>
                          {token.descriptionShort}
                        </p>
                        
                        <div className="space-y-2 text-xs">
                          {token.aliases.length > 0 && (
                            <div className="flex gap-2">
                              <span className="text-zinc-400 shrink-0">Синонимы:</span>
                              <span className="text-zinc-700 truncate">{token.aliases.join(', ')}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-100/50">
                            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                              {getConfidenceText(token.confidence)}
                            </span>
                            <button 
                              className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                              onClick={() => setEditingToken(token)}
                            >
                              <Edit2 size={12} />
                              <span>Редактировать</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-6 border-t border-zinc-100 bg-white shrink-0 flex justify-between items-center">
            {step === 'input' ? (
              <>
                <div className="text-sm text-zinc-500">
                  ИИ проанализирует текст и предложит токены
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={!promptInput.trim() || isAnalyzing}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Анализ...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      Анализировать
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setStep('input')}
                  className="px-4 py-2 text-zinc-600 font-medium hover:bg-zinc-100 rounded-xl transition-colors"
                >
                  Назад
                </button>
                {suggestions.length > 0 && (
                  <button
                    onClick={handleAcceptAll}
                    className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors shadow-sm"
                  >
                    <Check size={18} />
                    Принять все ({suggestions.length})
                  </button>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>

      {editingToken && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <TokenForm 
              tokenToEdit={{
                id: editingToken.id,
                name: editingToken.name,
                descriptionShort: editingToken.descriptionShort,
                aliases: editingToken.aliases,
                wordForms: editingToken.wordForms,
                examples: editingToken.examples,
                categoryIds: editingToken.categoryIds || [],
                isNew: true
              }}
              onClose={() => setEditingToken(null)}
              onSubmitOverride={(updatedToken) => {
                // Update the suggestion with the edited values
                setSuggestions(prev => prev.map(s => 
                  s.id === editingToken.id 
                    ? {
                        ...s,
                        name: updatedToken.name,
                        descriptionShort: updatedToken.descriptionShort || '',
                        aliases: updatedToken.aliases,
                        wordForms: updatedToken.wordForms || [],
                        examples: updatedToken.examples || [],
                        categoryIds: updatedToken.categoryIds,
                        categoryNames: updatedToken.categoryIds.map(id => {
                          const cat = categories.find(c => c.id === id);
                          if (!cat) return '';
                          
                          // Try to build full path for display
                          const getPath = (catId: string): string => {
                            const c = categories.find(x => x.id === catId);
                            if (!c) return '';
                            if (c.parentId) return `${getPath(c.parentId)} > ${c.name}`;
                            return c.name;
                          };
                          
                          return getPath(id);
                        }).filter(Boolean)
                      }
                    : s
                ));
                setEditingToken(null);
              }}
            />
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
