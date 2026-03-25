import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Upload,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Token, TokenSuggestion } from '../types';

const TokenCard = ({ token, onClick, onAdd }: { token: Token; onClick: () => void; onAdd: () => void }) => {
  const coverImage = token.coverImage || token.examples?.[0];
  const hasCover = Boolean(coverImage);

  return (
    <div
      onClick={onClick}
      className="group relative bg-white border border-zinc-200 rounded-xl p-3 cursor-pointer transition-all hover:shadow-md overflow-hidden flex flex-col h-44"
    >
      {hasCover && (
        <>
          <img
            src={coverImage}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-0 opacity-80 group-hover:opacity-90 transition-opacity" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors z-0" />
        </>
      )}

      <div className="relative z-10 flex flex-col h-full justify-end">
        <div className="flex justify-between items-end mb-1 gap-2">
          <h3 className={`font-medium text-base md:text-lg leading-tight ${hasCover ? 'text-white drop-shadow-md' : 'text-zinc-900'}`}>{token.name}</h3>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onAdd();
            }}
            className={`${hasCover ? 'text-white/80 hover:text-white hover:bg-white/20' : 'text-zinc-400 hover:text-blue-600 hover:bg-blue-50'} p-1.5 rounded-md transition-colors shrink-0`}
            title="Add to prompt"
          >
            <Plus size={18} />
          </button>
        </div>

        <div
          className={`grid transition-all duration-300 ease-in-out ${
            hasCover ? 'grid-rows-[0fr] opacity-0 group-hover:grid-rows-[1fr] group-hover:opacity-100' : 'grid-rows-[1fr] opacity-100'
          }`}
        >
          <div className="overflow-hidden">
            <p className={`text-sm line-clamp-2 mt-1 mb-2 ${hasCover ? 'text-zinc-200' : 'text-zinc-500'}`}>{token.descriptionShort}</p>
            {token.aliases?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {token.aliases.slice(0, 2).map((alias) => (
                  <span
                    key={alias}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${hasCover ? 'bg-white/20 text-white backdrop-blur-sm' : 'bg-zinc-100 text-zinc-500'}`}
                  >
                    {alias}
                  </span>
                ))}
                {token.aliases.length > 2 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${hasCover ? 'bg-white/20 text-white backdrop-blur-sm' : 'bg-zinc-100 text-zinc-500'}`}
                  >
                    +{token.aliases.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const TokenCarouselSection = ({
  section,
  onOpenSection,
  onSelectToken,
  onAddToken,
}: {
  section: { id: string; title: string; tokens: Token[] };
  onOpenSection: () => void;
  onSelectToken: (token: Token) => void;
  onAddToken: (token: Token) => void;
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const scrollTrack = (direction: 'left' | 'right') => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const amount = Math.max(track.clientWidth * 0.85, 320);
    track.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4 gap-3">
        <button
          className="text-xl font-semibold text-zinc-900 hover:text-blue-600 transition-colors text-left"
          onClick={onOpenSection}
        >
          {section.title}
        </button>
      </div>

      <div className="relative group/carousel">
        <button
          onClick={() => scrollTrack('left')}
          className="absolute left-0 top-1/2 z-20 -translate-y-1/2 -ml-4 bg-white/80 hover:bg-white text-zinc-800 p-2 rounded-full shadow-md opacity-0 group-hover/carousel:opacity-100 transition-opacity"
          title="Scroll left"
        >
          <ChevronLeft size={20} />
        </button>

        <div
          ref={trackRef}
          className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory pb-2"
        >
          {section.tokens.map((token) => (
            <div key={token.id} className="snap-start shrink-0 w-[280px]">
              <TokenCard
                token={token}
                onClick={() => onSelectToken(token)}
                onAdd={() => onAddToken(token)}
              />
            </div>
          ))}
        </div>

        <button
          onClick={() => scrollTrack('right')}
          className="absolute right-0 top-1/2 z-20 -translate-y-1/2 -mr-4 bg-white/80 hover:bg-white text-zinc-800 p-2 rounded-full shadow-md opacity-0 group-hover/carousel:opacity-100 transition-opacity"
          title="Scroll right"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </section>
  );
};

const AdminLoginModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { loginAsAdmin, authError } = useAppContext();
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-xl font-semibold text-zinc-900">Admin access</h2>
        <p className="text-sm text-zinc-500 mt-2">Enter the administrator password to manage the live token database.</p>
        <form
          className="mt-5 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setIsSubmitting(true);
            const ok = await loginAsAdmin(password);
            setIsSubmitting(false);
            if (ok) {
              setPassword('');
              onClose();
            }
          }}
        >
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Admin password"
            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
            autoFocus
          />
          {authError && <p className="text-sm text-red-600">{authError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-md">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-60">
              {isSubmitting ? 'Checking...' : 'Enter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SuggestionsModal = ({
  isOpen,
  suggestions,
  onClose,
  onApprove,
  onReject,
}: {
  isOpen: boolean;
  suggestions: TokenSuggestion[];
  onClose: () => void;
  onApprove: (suggestion: TokenSuggestion) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">User suggestions</h2>
            <p className="text-sm text-zinc-500 mt-1">Pending proposals are stored on the server for admin review.</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700">Close</button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {suggestions.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">No suggestions yet.</div>
          ) : (
            suggestions.map((suggestion) => (
              <div key={suggestion.id} className="border border-zinc-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-medium text-zinc-900">{suggestion.name}</h3>
                    <p className="text-sm text-zinc-500 mt-1">{suggestion.descriptionShort || 'No description provided.'}</p>
                    {suggestion.note ? <p className="text-sm text-zinc-700 mt-3">{suggestion.note}</p> : null}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {suggestion.aliases.map((alias) => (
                        <span key={alias} className="text-xs px-2 py-1 rounded-md bg-zinc-100 text-zinc-600">
                          {alias}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={async () => {
                        setBusyId(suggestion.id);
                        await onReject(suggestion.id);
                        setBusyId(null);
                      }}
                      className="px-3 py-2 text-sm font-medium rounded-md bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    >
                      Reject
                    </button>
                    <button
                      onClick={async () => {
                        setBusyId(suggestion.id);
                        await onApprove(suggestion);
                        setBusyId(null);
                      }}
                      className="px-3 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {busyId === suggestion.id ? 'Saving...' : 'Approve'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const TokenGrid = () => {
  const {
    tokens,
    categories,
    meta,
    isLoading,
    isSaving,
    isAdmin,
    activeCategory,
    setActiveCategory,
    selectedFilters,
    setSelectedFilters,
    searchQuery,
    setSearchQuery,
    setIsAddingToken,
    setSelectedToken,
    addToPrompt,
    importData,
    exportData,
    exportDataWithoutImages,
    logoutAdmin,
    refreshData,
    adminSuggestions,
    reviewSuggestion,
    addToken,
  } = useAppContext();

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isSuggestionsModalOpen, setIsSuggestionsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJson, setImportJson] = useState('');

  const getCategoryPath = (categoryId: string): { id: string; name: string }[] => {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) {
      return [];
    }

    if (!category.parentId) {
      return [{ id: category.id, name: category.name }];
    }

    return [...getCategoryPath(category.parentId), { id: category.id, name: category.name }];
  };

  const getDescendantIds = (categoryId: string): string[] => {
    const children = categories.filter((category) => category.parentId === categoryId);
    return children.flatMap((child) => [child.id, ...getDescendantIds(child.id)]);
  };

  const filteredTokens = useMemo(() => {
    const activeCategoryIds = activeCategory === 'all' ? [] : [activeCategory, ...getDescendantIds(activeCategory)];

    return tokens.filter((token) => {
      if (activeCategory !== 'all' && !token.categoryIds.some((categoryId) => activeCategoryIds.includes(categoryId))) {
        return false;
      }

      if (selectedFilters.size > 0) {
        const filterIds = [...selectedFilters];
        const matchesFilters = filterIds.every((filterId) => {
          const descendants = [filterId, ...getDescendantIds(filterId)];
          return token.categoryIds.some((categoryId) => descendants.includes(categoryId));
        });
        if (!matchesFilters) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = token.name.toLowerCase().includes(query);
        const matchesAlias = token.aliases.some((alias) => alias.toLowerCase().includes(query));
        if (!matchesName && !matchesAlias) {
          return false;
        }
      }

      return true;
    });
  }, [tokens, categories, activeCategory, selectedFilters, searchQuery]);

  const sections = useMemo(() => {
    const currentCategoryId = activeCategory === 'all' ? null : activeCategory;
    const children = categories.filter((category) => (currentCategoryId ? category.parentId === currentCategoryId : !category.parentId));

    if (children.length === 0) {
      return [{ id: 'flat', title: activeCategory === 'all' ? 'All tokens' : categories.find((item) => item.id === activeCategory)?.name || 'Tokens', tokens: filteredTokens }];
    }

    const results = children
      .map((child) => {
        const descendantIds = [child.id, ...getDescendantIds(child.id)];
        const childTokens = filteredTokens.filter((token) => token.categoryIds.some((categoryId) => descendantIds.includes(categoryId)));
        return { id: child.id, title: child.name, tokens: childTokens };
      })
      .filter((section) => section.tokens.length > 0);

    const directTokens =
      currentCategoryId === null
        ? filteredTokens.filter((token) => token.categoryIds.length === 0)
        : (() => {
            const allChildrenDescendantIds = children.flatMap((child) => [child.id, ...getDescendantIds(child.id)]);
            return filteredTokens.filter(
              (token) =>
                token.categoryIds.includes(currentCategoryId) &&
                !token.categoryIds.some((categoryId) => allChildrenDescendantIds.includes(categoryId)),
            );
          })();

    if (directTokens.length > 0) {
      results.push({ id: 'direct', title: currentCategoryId ? ' ' : 'Uncategorized', tokens: directTokens });
    }

    return results;
  }, [filteredTokens, categories, activeCategory]);

  const pendingSuggestions = adminSuggestions.filter((suggestion) => suggestion.status === 'pending');
  const categoryPath = activeCategory === 'all' ? [] : getCategoryPath(activeCategory);

  const handleImportSubmit = () => {
    if (!importJson.trim()) {
      return;
    }

    importData(JSON.parse(importJson));
    setImportJson('');
    setIsImportModalOpen(false);
  };

  const handleApproveSuggestion = async (suggestion: TokenSuggestion) => {
    addToken({
      id: `token_${Date.now()}`,
      name: suggestion.name,
      descriptionShort: suggestion.descriptionShort,
      aliases: suggestion.aliases,
      wordForms: suggestion.wordForms,
      categoryIds: suggestion.categoryIds,
      examples: suggestion.examples,
    });
    await reviewSuggestion(suggestion.id, 'approved');
  };

  return (
    <main className="flex-1 flex flex-col h-full min-w-0 bg-zinc-50/50 relative">
      <header className="h-16 border-b border-zinc-200 bg-white flex items-center px-8 shrink-0 justify-between sticky top-0 z-30 gap-4">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input
            type="text"
            placeholder="Search tokens or aliases..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full pl-11 pr-4 py-2 text-sm bg-zinc-100 border-transparent rounded-lg focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => refreshData()} className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors" title="Reload latest database file">
            <RefreshCw size={18} />
          </button>

          {isAdmin ? (
            <>
              <button onClick={() => setIsSuggestionsModalOpen(true)} className="px-3 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors">
                Suggestions {pendingSuggestions.length > 0 ? `(${pendingSuggestions.length})` : ''}
              </button>
              <button onClick={() => setIsImportModalOpen(true)} className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors" title="Import data into the live database">
                <Upload size={18} />
              </button>
              <button onClick={exportData} className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors" title="Export current database">
                <Download size={18} />
              </button>
              <button onClick={exportDataWithoutImages} className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors" title="Export without images">
                <FileText size={18} />
              </button>
              <button onClick={() => logoutAdmin()} className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors">
                <LogOut size={16} className="inline mr-1" />
                Admin
              </button>
            </>
          ) : (
            <button onClick={() => setIsAdminModalOpen(true)} className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors">
              <LogIn size={16} className="inline mr-1" />
              Admin login
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-8 flex items-center gap-3 flex-wrap">
          {activeCategory === 'all' ? (
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Toggle</h1>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                  <Shield size={14} />
                  Admin
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center flex-wrap gap-3 text-2xl font-bold text-zinc-900">
              <button
                onClick={() => {
                  setActiveCategory('all');
                  setSelectedFilters(new Set());
                }}
                className="hover:text-blue-600 transition-colors"
              >
                Toggle
              </button>
              <ChevronRight size={24} className="text-zinc-300" />
              {categoryPath.map((category, index) => (
                <React.Fragment key={category.id}>
                  {index > 0 ? <ChevronRight size={24} className="text-zinc-300" /> : null}
                  <button
                    onClick={() => {
                      setActiveCategory(category.id);
                      setSelectedFilters(new Set());
                    }}
                    className="hover:text-blue-600 transition-colors"
                  >
                    {category.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}
          <span className="text-sm text-zinc-500 ml-auto">
            {filteredTokens.length} tokens
            {meta ? ` - file: ${meta.dataFile}` : ''}
            {isSaving ? ' - saving...' : ''}
            {isLoading ? ' - loading...' : ''}
          </span>
        </div>

        <div className="mb-8">
          <button
            onClick={() => {
              setSelectedToken(null);
              setIsAddingToken(true);
            }}
            className="group bg-white border border-dashed border-zinc-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all hover:border-blue-500 hover:bg-blue-50 text-zinc-500 hover:text-blue-600 aspect-video max-w-[280px]"
          >
            <Plus size={24} className="mb-2" />
            <span className="font-medium">{isAdmin ? 'Add token' : 'Suggest token'}</span>
            <span className="text-xs mt-1">{isAdmin ? 'Saved directly into the live database' : 'Stored for admin review'}</span>
          </button>
        </div>

        <div className="space-y-10">
          {sections.map((section) => {
            const isCarouselSection = section.id !== 'flat' && section.id !== 'direct';

            if (isCarouselSection) {
              return (
                <TokenCarouselSection
                  key={section.id}
                  section={section}
                  onOpenSection={() => {
                    setActiveCategory(section.id);
                    setSelectedFilters(new Set());
                  }}
                  onSelectToken={(token) => {
                    setSelectedToken(token);
                    setIsAddingToken(false);
                  }}
                  onAddToken={(token) => addToPrompt(token)}
                />
              );
            }

            return (
              <section key={section.id}>
                {section.title.trim() ? (
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-zinc-900">{section.title}</h2>
                  </div>
                ) : null}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {section.tokens.map((token) => (
                    <TokenCard
                      key={token.id}
                      token={token}
                      onClick={() => {
                        setSelectedToken(token);
                        setIsAddingToken(false);
                      }}
                      onAdd={() => addToPrompt(token)}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {filteredTokens.length === 0 && (
            <div className="text-center py-16 text-zinc-500">
              <AlertCircle size={28} className="mx-auto mb-3 opacity-50" />
              Nothing matched your search or filters.
            </div>
          )}
        </div>
      </div>

      <AdminLoginModal isOpen={isAdminModalOpen} onClose={() => setIsAdminModalOpen(false)} />
      <SuggestionsModal
        isOpen={isSuggestionsModalOpen}
        suggestions={pendingSuggestions}
        onClose={() => setIsSuggestionsModalOpen(false)}
        onApprove={handleApproveSuggestion}
        onReject={(id) => reviewSuggestion(id, 'rejected')}
      />

      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Import database</h2>
            <p className="text-sm text-zinc-500 mb-4">Paste a JSON payload with `categories` and `tokens`. Saving happens automatically after import.</p>
            <textarea
              value={importJson}
              onChange={(event) => setImportJson(event.target.value)}
              className="w-full h-40 p-3 border border-zinc-300 rounded-md text-sm font-mono mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder='{"categories": [], "tokens": []}'
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-md">
                Cancel
              </button>
              <button onClick={handleImportSubmit} disabled={!importJson.trim()} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50">
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
