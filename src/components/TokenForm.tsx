import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Send, Upload, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Token } from '../types';
import { fileToBase64 } from '../utils/fileUtils';

interface TokenFormProps {
  tokenToEdit?: Token;
  onClose?: () => void;
  onSubmitOverride?: (token: Token) => void;
}

export const TokenForm: React.FC<TokenFormProps> = ({ tokenToEdit, onClose, onSubmitOverride }) => {
  const {
    categories,
    isAdmin,
    addToken,
    updateToken,
    submitSuggestion,
    setIsAddingToken,
    prefillName,
    setPrefillName,
    promotingNodeId,
    setPromotingNodeId,
    promptNodes,
    setPromptNodes,
  } = useAppContext();

  const [name, setName] = useState(prefillName || '');
  const [description, setDescription] = useState('');
  const [aliases, setAliases] = useState('');
  const [wordForms, setWordForms] = useState('');
  const [note, setNote] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [examples, setExamples] = useState<string[]>([]);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!tokenToEdit) {
      return;
    }

    setName(tokenToEdit.name);
    setDescription(tokenToEdit.descriptionShort || '');
    setAliases(tokenToEdit.aliases.join(', '));
    setWordForms(tokenToEdit.wordForms?.join(', ') || '');
    setCategoryIds(tokenToEdit.categoryIds || []);
    setExamples(tokenToEdit.examples || []);
  }, [tokenToEdit]);

  const visibleCategories = useMemo(
    () => categories.filter((category) => (currentParentId ? category.parentId === currentParentId : !category.parentId)),
    [categories, currentParentId],
  );

  const selectedLeafCategories = categoryIds.filter((id) => {
    return !categoryIds.some((otherId) => {
      if (otherId === id) {
        return false;
      }

      let current = categories.find((category) => category.id === otherId);
      while (current?.parentId) {
        if (current.parentId === id) {
          return true;
        }
        current = categories.find((category) => category.id === current?.parentId);
      }
      return false;
    });
  });

  const getParentIds = (categoryId: string) => {
    const parents: string[] = [];
    let current = categories.find((category) => category.id === categoryId);
    while (current?.parentId) {
      parents.push(current.parentId);
      current = categories.find((category) => category.id === current?.parentId);
    }
    return parents;
  };

  const getPath = (categoryId: string): string => {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) {
      return '';
    }

    if (!category.parentId) {
      return category.name;
    }

    return `${getPath(category.parentId)} > ${category.name}`;
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) {
      return;
    }

    const nextExamples: string[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const encoded = await fileToBase64(files[index]);
      nextExamples.push(encoded);
    }

    setExamples((prev) => [...prev, ...nextExamples]);
  };

  const removeExample = (index: number) => {
    setExamples((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const setAsCover = (index: number) => {
    if (index === 0) {
      return;
    }

    setExamples((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.unshift(item);
      return next;
    });
  };

  const toggleCategory = (categoryId: string) => {
    setCategoryIds((prev) => {
      if (prev.includes(categoryId)) {
        return prev.filter((id) => id !== categoryId);
      }
      return [...new Set([...prev, categoryId, ...getParentIds(categoryId)])];
    });
  };

  const closeForm = () => {
    if (onClose) {
      onClose();
      return;
    }

    setIsAddingToken(false);
    setPrefillName('');
    setPromotingNodeId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }

    const payload: Token = {
      id: tokenToEdit ? tokenToEdit.id : `token_${Date.now()}`,
      name: name.trim(),
      descriptionShort: description.trim(),
      aliases: aliases.split(',').map((item) => item.trim()).filter(Boolean),
      wordForms: wordForms.split(',').map((item) => item.trim()).filter(Boolean),
      categoryIds,
      examples,
    };

    setIsSubmitting(true);
    try {
      if (onSubmitOverride) {
        onSubmitOverride(payload);
        closeForm();
        return;
      }

      if (tokenToEdit && isAdmin) {
        updateToken(payload);
        closeForm();
        return;
      }

      if (isAdmin) {
        addToken(payload);
        if (promotingNodeId) {
          setPromptNodes(
            promptNodes.map((node) =>
              node.id === promotingNodeId ? { ...node, type: 'token', tokenId: payload.id, text: payload.name } : node,
            ),
          );
        }
        closeForm();
        return;
      }

      await submitSuggestion({
        name: payload.name,
        descriptionShort: payload.descriptionShort,
        aliases: payload.aliases,
        wordForms: payload.wordForms || [],
        categoryIds: payload.categoryIds,
        examples: payload.examples,
        note: note.trim(),
      });
      closeForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-5 flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {tokenToEdit ? 'Редактирование токена' : isAdmin ? 'Новый токен' : 'Предложить токен'}
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              {isAdmin
                ? 'Изменения сохраняются сразу в живую базу.'
                : 'Предложение сохранится для проверки администратором.'}
            </p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-700 rounded-md hover:bg-zinc-100">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="space-y-4 pb-6">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Название *</label>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Например: Soft key light"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Описание</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              rows={3}
              placeholder="Короткое описание визуального эффекта."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Синонимы</label>
            <input
              value={aliases}
              onChange={(event) => setAliases(event.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="синоним 1, синоним 2, синоним 3"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Формы слова</label>
            <input
              value={wordForms}
              onChange={(event) => setWordForms(event.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="glow, glowing, glows"
            />
          </div>

          {!isAdmin && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Комментарий для администратора</label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                rows={3}
                placeholder="Необязательно: зачем добавлять этот токен и чем он полезен."
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-2">Изображения</label>
            <div className="grid grid-cols-3 gap-2">
              {examples.map((example, index) => (
                <div key={`${example}-${index}`} className="relative group aspect-square rounded-md overflow-hidden border border-zinc-200">
                  <img src={example} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    {index !== 0 && (
                      <button
                        type="button"
                        onClick={() => setAsCover(index)}
                        className="text-[10px] bg-white/20 hover:bg-white/40 text-white px-2 py-1 rounded"
                      >
                        Сделать обложкой
                      </button>
                    )}
                    <button type="button" onClick={() => removeExample(index)} className="text-white hover:text-red-400 p-1">
                      <X size={16} />
                    </button>
                  </div>
                  {index === 0 && <div className="absolute top-1 left-1 text-[8px] bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase font-bold">Обложка</div>}
                </div>
              ))}

              <label className="aspect-square rounded-md border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center text-zinc-400 hover:bg-zinc-50 hover:text-blue-500 hover:border-blue-300 cursor-pointer transition-colors">
                <Upload size={20} className="mb-1" />
                <span className="text-[10px] font-medium">Загрузить</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-2">Категории</label>
            {selectedLeafCategories.length > 0 && (
              <div className="flex flex-col gap-1 mb-3">
                {selectedLeafCategories.map((categoryId) => (
                  <span
                    key={categoryId}
                    className="inline-flex items-center justify-between gap-2 px-2 py-1 bg-blue-50 text-blue-700 text-[10px] rounded-md border border-blue-100"
                  >
                    {getPath(categoryId)}
                    <button type="button" onClick={() => toggleCategory(categoryId)} className="hover:text-blue-900">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="border border-zinc-200 rounded-md overflow-hidden bg-white">
              {currentParentId && (
                <button
                  type="button"
                  className="bg-zinc-50 border-b border-zinc-200 px-3 py-2 flex items-center gap-2 hover:bg-zinc-100 transition-colors text-left text-sm"
                  onClick={() => setCurrentParentId(categories.find((category) => category.id === currentParentId)?.parentId || null)}
                >
                  ← Назад
                </button>
              )}
              <div className="p-1">
                {visibleCategories.map((category) => {
                  const hasChildren = categories.some((child) => child.parentId === category.id);
                  const isChecked = categoryIds.includes(category.id);

                  return (
                    <div key={category.id} className="flex items-center justify-between py-1.5 px-2 hover:bg-zinc-50 rounded group">
                      <button type="button" className="flex items-center gap-2 flex-1 text-left" onClick={() => toggleCategory(category.id)}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${isChecked ? 'bg-blue-600 border-blue-600' : 'bg-white border-zinc-300'}`}>
                          {isChecked && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <span className={`text-xs ${isChecked ? 'text-blue-700 font-medium' : 'text-zinc-600'}`}>{category.name}</span>
                      </button>

                      {hasChildren && (
                        <button
                          type="button"
                          onClick={() => setCurrentParentId(category.id)}
                          className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 rounded transition-colors"
                        >
                          →
                        </button>
                      )}
                    </div>
                  );
                })}
                {visibleCategories.length === 0 && <div className="text-center py-4 text-xs text-zinc-400">Здесь нет дочерних категорий.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-zinc-100 mt-4 flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-blue-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60"
        >
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Сохранение...
            </span>
          ) : isAdmin ? (
            'Сохранить токен'
          ) : (
            <span className="inline-flex items-center gap-2">
              <Send size={16} />
              Отправить предложение
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={closeForm}
          className="flex-1 bg-zinc-100 text-zinc-700 py-2.5 rounded-md text-sm font-medium hover:bg-zinc-200 transition-colors"
        >
          Отмена
        </button>
      </div>
    </form>
  );
};
