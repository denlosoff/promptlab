import React, { useState } from 'react';
import { X, Folder, ChevronRight } from 'lucide-react';
import { Category } from '../types';

interface MoveCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMove: (newParentId?: string) => void;
  categories: Category[];
  movingCategoryId: string | null;
}

export const MoveCategoryModal: React.FC<MoveCategoryModalProps> = ({
  isOpen,
  onClose,
  onMove,
  categories,
  movingCategoryId
}) => {
  const [selectedParentId, setSelectedParentId] = useState<string | undefined>(undefined);

  if (!isOpen || !movingCategoryId) return null;

  const movingCategory = categories.find(c => c.id === movingCategoryId);
  if (!movingCategory) return null;

  // Get all descendant IDs to prevent moving a category into its own descendant
  const getDescendantIds = (catId: string): string[] => {
    const children = categories.filter(c => c.parentId === catId);
    let ids = children.map(c => c.id);
    children.forEach(c => {
      ids = [...ids, ...getDescendantIds(c.id)];
    });
    return ids;
  };

  const descendantIds = getDescendantIds(movingCategoryId);
  const invalidParentIds = new Set([movingCategoryId, ...descendantIds]);

  // Build a flat list of valid categories with depth for rendering
  const buildFlatTree = (parentId?: string, depth = 0): { cat: Category; depth: number }[] => {
    const children = categories.filter(c => parentId ? c.parentId === parentId : !c.parentId);
    let result: { cat: Category; depth: number }[] = [];
    for (const child of children) {
      if (!invalidParentIds.has(child.id)) {
        result.push({ cat: child, depth });
        result = result.concat(buildFlatTree(child.id, depth + 1));
      }
    }
    return result;
  };

  const validCategories = buildFlatTree(undefined, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">
            Переместить "{movingCategory.name}"
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <p className="text-sm text-zinc-500 mb-4">Выберите новую родительскую категорию:</p>
          
          <div className="space-y-1">
            <button
              onClick={() => setSelectedParentId(undefined)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedParentId === undefined
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <Folder size={16} className={selectedParentId === undefined ? 'text-blue-500' : 'text-zinc-400'} />
              [Корневая категория]
            </button>

            {validCategories.map(({ cat, depth }) => (
              <button
                key={cat.id}
                onClick={() => setSelectedParentId(cat.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedParentId === cat.id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-zinc-700 hover:bg-zinc-50'
                }`}
                style={{ paddingLeft: `${depth * 16 + 12}px` }}
              >
                {depth > 0 && <ChevronRight size={14} className="text-zinc-300" />}
                <Folder size={16} className={selectedParentId === cat.id ? 'text-blue-500' : 'text-zinc-400'} />
                <span className="truncate">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-zinc-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={() => {
              onMove(selectedParentId);
              onClose();
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Переместить
          </button>
        </div>
      </div>
    </div>
  );
};
