import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Edit2, Info, Plus, Trash2, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { TokenForm } from './TokenForm';
import { api } from '../lib/api';

export const RightSidebar = ({
  isCollapsed,
  onToggleCollapse,
}: {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) => {
  const {
    selectedToken,
    isAddingToken,
    isAdmin,
    deleteToken,
    setSelectedToken,
    setIsAddingToken,
    categories,
    addToPrompt,
  } = useAppContext();

  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isEditingToken, setIsEditingToken] = useState(false);

  React.useEffect(() => {
    setCurrentImageIdx(0);
    setIsEditingToken(false);
  }, [selectedToken?.id]);

  React.useEffect(() => {
    const loadTokenDetails = async () => {
      if (!selectedToken?.id) {
        return;
      }

      if ((selectedToken.examples && selectedToken.examples.length > 0) || selectedToken.exampleCount === 0) {
        return;
      }

      try {
        const result = await api.getToken(selectedToken.id);
        setSelectedToken(result.token);
      } catch (error) {
        console.error(error);
      }
    };

    loadTokenDetails();
  }, [selectedToken?.id]);

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

  const visibleCategoryIds =
    selectedToken?.categoryIds.filter((categoryId) => {
      return !selectedToken.categoryIds.some((otherId) => {
        if (otherId === categoryId) {
          return false;
        }

        let current = categories.find((item) => item.id === otherId);
        while (current?.parentId) {
          if (current.parentId === categoryId) {
            return true;
          }
          current = categories.find((item) => item.id === current?.parentId);
        }

        return false;
      });
    }) || [];

  return (
    <>
      <aside
        className={`w-full bg-white flex flex-col h-full shrink-0 shadow-[-4px_0_24px_rgba(0,0,0,0.02)] z-10 overflow-hidden ${
          isCollapsed ? 'cursor-pointer' : ''
        }`}
        onClick={isCollapsed ? onToggleCollapse : undefined}
      >
        <div className={`border-b border-zinc-100 flex items-center h-12 shrink-0 ${isCollapsed ? 'justify-center' : 'p-3 justify-between'}`}>
          <button
            onClick={onToggleCollapse}
            className={`p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors ${isCollapsed ? '' : 'mr-auto'}`}
            title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {!isCollapsed && (
          <div className="flex-1 overflow-y-auto bg-white">
            {isAddingToken ? (
              <TokenForm />
            ) : isEditingToken && selectedToken ? (
              <TokenForm tokenToEdit={selectedToken} onClose={() => setIsEditingToken(false)} />
            ) : selectedToken ? (
              <div className="p-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-start mb-4 gap-3">
                  <h2 className="text-lg font-semibold text-zinc-900 leading-tight">{selectedToken.name}</h2>
                  <div className="flex gap-2 shrink-0">
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => setIsEditingToken(true)}
                          className="shrink-0 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 p-1.5 rounded-md transition-colors"
                          title="Edit token"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => {
                            deleteToken(selectedToken.id);
                            setSelectedToken(null);
                          }}
                          className="shrink-0 bg-red-50 text-red-600 hover:bg-red-100 p-1.5 rounded-md transition-colors"
                          title="Delete token"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => addToPrompt(selectedToken)}
                      className="shrink-0 bg-blue-50 text-blue-600 hover:bg-blue-100 p-1.5 rounded-md transition-colors"
                      title="Add to prompt"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-zinc-600 mb-6 leading-relaxed">{selectedToken.descriptionShort}</p>

                {selectedToken.examples?.length > 0 && (
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Preview images ({selectedToken.examples.length})</h3>
                    </div>
                    <div
                      className="rounded-lg overflow-hidden border border-zinc-200 bg-zinc-100 aspect-video relative group cursor-pointer"
                      onClick={() => setIsGalleryOpen(true)}
                    >
                      <img
                        src={selectedToken.examples[currentImageIdx]}
                        alt={selectedToken.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      {selectedToken.examples.length > 1 && (
                        <>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setCurrentImageIdx((prev) => (prev - 1 + selectedToken.examples.length) % selectedToken.examples.length);
                            }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setCurrentImageIdx((prev) => (prev + 1) % selectedToken.examples.length);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                          >
                            <ChevronRight size={16} />
                          </button>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                            {selectedToken.examples.map((_, index) => (
                              <div key={index} className={`w-1.5 h-1.5 rounded-full ${index === currentImageIdx ? 'bg-white' : 'bg-white/50'}`} />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {selectedToken.aliases?.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Aliases</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedToken.aliases.map((alias) => (
                        <span key={alias} className="text-xs px-2 py-1 bg-zinc-100 text-zinc-600 rounded-md">
                          {alias}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {visibleCategoryIds.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Categories</h3>
                    <div className="flex flex-col gap-1.5">
                      {visibleCategoryIds.map((categoryId) => (
                        <span key={categoryId} className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-md w-fit">
                          {getPath(categoryId)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 p-6">
                <Info size={24} className="opacity-20 mb-3" />
                <p className="text-sm">Select a token in the list to see details and examples.</p>
              </div>
            )}
          </div>
        )}

        {isCollapsed && selectedToken && (
          <div className="flex-1 flex flex-col items-center py-4 gap-4">
            <button
              onClick={() => addToPrompt(selectedToken)}
              className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
              title={`Add ${selectedToken.name} to prompt`}
            >
              <Plus size={20} />
            </button>
            <div className="w-8 h-8 rounded-md bg-zinc-100 flex items-center justify-center text-zinc-400 overflow-hidden">
              {selectedToken.examples?.length > 0 ? (
                <img src={selectedToken.examples[0]} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Info size={16} />
              )}
            </div>
          </div>
        )}
      </aside>

      {isGalleryOpen && selectedToken?.examples?.length ? (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" onClick={() => setIsGalleryOpen(false)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white p-2" onClick={() => setIsGalleryOpen(false)}>
            <X size={24} />
          </button>

          <img
            src={selectedToken.examples[currentImageIdx]}
            alt={selectedToken.name}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(event) => event.stopPropagation()}
          />

          {selectedToken.examples.length > 1 && (
            <>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setCurrentImageIdx((prev) => (prev - 1 + selectedToken.examples.length) % selectedToken.examples.length);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-4"
              >
                <ChevronLeft size={48} />
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setCurrentImageIdx((prev) => (prev + 1) % selectedToken.examples.length);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-4"
              >
                <ChevronRight size={48} />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {selectedToken.examples.map((_, index) => (
                  <button
                    key={index}
                    onClick={(event) => {
                      event.stopPropagation();
                      setCurrentImageIdx(index);
                    }}
                    className={`w-2 h-2 rounded-full transition-colors ${index === currentImageIdx ? 'bg-white' : 'bg-white/30 hover:bg-white/50'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </>
  );
};
