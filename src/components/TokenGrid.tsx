import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ChevronRight,
  Download,
  FileText,
  LogIn,
  LogOut,
  Plus,
  Search,
  Shield,
  TimerReset,
  Upload,
  XCircle,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { api } from '../lib/api';
import { ImportPreview, JobRun, SyncStatus, Token, TokenSuggestion } from '../types';

const SystemStatus = ({
  isAdmin,
  isSaving,
  isLoggingOut,
  syncStatus,
}: {
  isAdmin: boolean;
  isSaving: boolean;
  isLoggingOut: boolean;
  syncStatus: SyncStatus;
}) => {
  const [isJobsExpanded, setIsJobsExpanded] = useState(false);
  const items = [];

  if (isSaving) {
    items.push({ id: 'saving', label: 'Saving changes', tone: 'blue' });
  }

  if (isLoggingOut) {
    items.push({ id: 'logout', label: 'Leaving admin mode', tone: 'zinc' });
  }

  if (syncStatus.state === 'running') {
    items.push({ id: 'rebuild', label: syncStatus.queued ? 'Refreshing public catalog, more updates queued' : 'Refreshing public catalog', tone: 'amber' });
  }

  if (syncStatus.state === 'error') {
    items.push({ id: 'error', label: syncStatus.error || 'Background update failed', tone: 'red' });
  }

  const recentJobs = isAdmin ? (syncStatus.recentJobs || []).slice(0, 4) : [];

  if (items.length === 0 && recentJobs.length === 0) {
    return null;
  }

  const toneClass: Record<string, string> = {
    blue: 'border-blue-200 bg-white text-blue-700',
    zinc: 'border-zinc-200 bg-white text-zinc-700',
    amber: 'border-amber-200 bg-white text-amber-700',
    red: 'border-red-200 bg-white text-red-700',
  };

  const describeJob = (job: JobRun) => {
    const statusLabel =
      job.status === 'running'
        ? 'In progress'
        : job.status === 'succeeded'
          ? 'Done'
          : job.status === 'failed'
            ? 'Failed'
            : 'Queued';

    const actionLabel =
      job.kind === 'webdb-rebuild'
        ? 'Public catalog refresh'
        : job.kind === 'import-apply'
          ? 'Import applied'
          : 'Import inbox sync';

    const Icon =
      job.status === 'succeeded'
        ? CheckCircle2
        : job.status === 'failed'
          ? XCircle
          : TimerReset;

    const iconClass =
      job.status === 'succeeded'
        ? 'text-emerald-600'
        : job.status === 'failed'
          ? 'text-red-600'
          : 'text-amber-600';

    const timestamp = job.finishedAt || job.startedAt || job.createdAt;
    const timeLabel = timestamp
      ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return {
      id: job.id,
      Icon,
      iconClass,
      title: actionLabel,
      subtitle: job.error || job.message || statusLabel,
      statusLabel,
      timeLabel,
    };
  };

  return (
    <div className="fixed right-5 bottom-5 z-40 flex flex-col gap-2 w-[280px]">
      {items.map((item) => (
        <div key={item.id} className={`rounded-xl border shadow-sm px-4 py-3 text-sm ${toneClass[item.tone]}`}>
          {item.label}
        </div>
      ))}
      {recentJobs.length > 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm px-4 py-3">
          <button
            type="button"
            onClick={() => setIsJobsExpanded((value) => !value)}
            className="w-full flex items-center justify-between gap-3"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 text-left">Recent operations</p>
            <span className="inline-flex items-center gap-2 text-[11px] text-zinc-400 shrink-0">
              {recentJobs.length}
              {isJobsExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </span>
          </button>
          {isJobsExpanded ? (
            <div className="space-y-2 mt-3">
              {recentJobs.map((job) => {
                const item = describeJob(job);
                return (
                  <div key={item.id} className="flex items-start gap-2">
                    <item.Icon size={15} className={`mt-0.5 shrink-0 ${item.iconClass}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-zinc-800 truncate">{item.title}</p>
                        <span className="text-[11px] text-zinc-400 shrink-0">{item.timeLabel}</span>
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-2">{item.subtitle}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

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

export const TokenGrid = ({
  onRequestAddToken,
  onRequestSelectToken,
}: {
  onRequestAddToken?: () => void;
  onRequestSelectToken?: () => void;
}) => {
  const {
    tokens,
    categories,
    meta,
    isLoading,
    isSaving,
    isAdmin,
    isLoggingOut,
    syncStatus,
    activeCategory,
    setActiveCategory,
    selectedFilters,
    setSelectedFilters,
    searchQuery,
    setSearchQuery,
    setIsAddingToken,
    setSelectedToken,
    addToPrompt,
    exportData,
    exportDataWithoutImages,
    logoutAdmin,
    refreshData,
    adminSuggestions,
    reviewSuggestion,
    addToken,
    isDraftMode,
    startDraft,
    applyDraft,
    cancelDraft,
  } = useAppContext();

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isSuggestionsModalOpen, setIsSuggestionsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace-master'>('merge');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importDraftId, setImportDraftId] = useState<string | null>(null);
  const [activeDraftPreview, setActiveDraftPreview] = useState<ImportPreview | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [previewDraftData, setPreviewDraftData] = useState<{ categories: any[]; tokens: any[] } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [isOpeningPreviewCatalog, setIsOpeningPreviewCatalog] = useState(false);
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  const [isApplyingDraftPreview, setIsApplyingDraftPreview] = useState(false);

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

  const openToken = (token: Token) => {
    setSelectedToken(token);
    setIsAddingToken(false);
    onRequestSelectToken?.();
  };

  const parseImportPayload = () => {
    const parsed = JSON.parse(importJson);

    if (parsed && typeof parsed === 'object' && parsed.type === 'promptlab-token-set') {
      return {
        ...parsed,
        meta: {
          ...(parsed.meta || {}),
          syncMode: importMode,
        },
      };
    }

    return parsed;
  };

  const resetImportModal = () => {
    setImportJson('');
    setImportFileName('');
    setImportMode('merge');
    setImportPreview(null);
    setImportDraftId(null);
    setImportError(null);
    setPreviewDraftData(null);
    setIsPreviewingImport(false);
    setIsOpeningPreviewCatalog(false);
    setIsApplyingImport(false);
    setIsImportModalOpen(false);
  };

  const handlePreviewImport = async () => {
    if (!importJson.trim()) {
      return;
    }

    setImportError(null);
    setIsPreviewingImport(true);

    try {
      const payload = parseImportPayload();
      const result = await api.previewImport(payload);
      setImportPreview(result.preview);
      setImportDraftId(result.draftId);
      setPreviewDraftData(null);
    } catch (error) {
      setImportPreview(null);
      setImportDraftId(null);
      setPreviewDraftData(null);
      setImportError(error instanceof Error ? error.message : 'Import preview failed');
    } finally {
      setIsPreviewingImport(false);
    }
  };

  const openPreviewDraft = () => {
    if (!importPreview || !importDraftId) {
      return;
    }

    setImportError(null);
    setIsOpeningPreviewCatalog(true);

    api.getImportDraft(importDraftId).then((result) => {
      startDraft(result.nextData, 'import');
      setActiveDraftPreview(result.preview);
      setActiveDraftId(result.draftId);
      resetImportModal();
    }).catch((error) => {
      setImportError(error instanceof Error ? error.message : 'Could not open preview catalog');
      setIsOpeningPreviewCatalog(false);
    });
  };

  const handleApplyImport = async () => {
    if (!importJson.trim()) {
      return;
    }

    setImportError(null);
    setIsApplyingImport(true);

    try {
      const payload = importDraftId ? { draftId: importDraftId } : parseImportPayload();
      await api.applyImport(payload);
      await refreshData();
      setActiveDraftPreview(null);
      setActiveDraftId(null);
      resetImportModal();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import apply failed');
    } finally {
      setIsApplyingImport(false);
    }
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

  const renderDiffList = (
    title: string,
    items: string[],
    emptyLabel: string,
    accentClass: string,
  ) => (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <h3 className={`text-sm font-semibold mb-2 ${accentClass}`}>{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-500">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1 max-h-40 overflow-y-auto text-xs text-zinc-700">
          {items.map((item) => (
            <li key={item} className="break-words">{item}</li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <main className="flex-1 flex flex-col h-full min-w-0 bg-zinc-50/50 relative">
      <header className="h-16 border-b border-zinc-200 bg-white flex items-center px-8 shrink-0 justify-between sticky top-0 z-30 gap-4">
        <div className="flex items-center gap-2 w-full max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type="text"
              placeholder="Поиск токенов и синонимов..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full pl-11 pr-4 py-2 text-sm bg-zinc-100 border-transparent rounded-lg focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
            />
          </div>
          <button
            onClick={() => {
              if (onRequestAddToken) {
                onRequestAddToken();
                return;
              }
              setSelectedToken(null);
              setIsAddingToken(true);
            }}
            className="group inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-zinc-500 transition-all duration-200 hover:w-[172px] hover:justify-start hover:bg-blue-50 hover:text-blue-700"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center">
              <Plus size={15} className="shrink-0" />
            </span>
            <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-200 group-hover:max-w-[128px] group-hover:opacity-100">
              {isAdmin ? 'Добавить токен' : 'Предложить токен'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isAdmin ? (
            <>
              <button onClick={() => setIsSuggestionsModalOpen(true)} className="px-3 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors">
                Предложения {pendingSuggestions.length > 0 ? `(${pendingSuggestions.length})` : ''}
              </button>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors"
                title="Импортировать данные"
              >
                <Upload size={18} />
              </button>
              <button onClick={exportData} className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors" title="Экспортировать базу">
                <Download size={18} />
              </button>
              <button onClick={exportDataWithoutImages} className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors" title="Экспортировать без изображений">
                <FileText size={18} />
              </button>
              <button
                onClick={() => logoutAdmin()}
                disabled={isLoggingOut}
                className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut size={16} className="inline mr-1" />
                {isLoggingOut ? 'Выход...' : 'Админ'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsAdminModalOpen(true)}
              className="p-1 text-zinc-500 hover:text-blue-700 transition-colors"
              title="Вход администратора"
            >
              <LogIn size={17} />
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {isDraftMode && activeDraftPreview ? (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold text-amber-900">Draft Import Preview</h2>
                <p className="text-sm text-amber-800 mt-1">
                  You are browsing a draft catalog. Changes are not visible to visitors until you apply them.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!activeDraftId) {
                      return;
                    }
                    setIsApplyingDraftPreview(true);
                    try {
                      await api.applyImport({ draftId: activeDraftId });
                      applyDraft();
                      setActiveDraftPreview(null);
                      setActiveDraftId(null);
                    } finally {
                      setIsApplyingDraftPreview(false);
                    }
                  }}
                  disabled={isApplyingDraftPreview}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isApplyingDraftPreview ? 'Applying...' : 'Apply changes'}
                </button>
                <button
                  onClick={() => {
                    cancelDraft();
                    setActiveDraftPreview(null);
                    setActiveDraftId(null);
                  }}
                  disabled={isApplyingDraftPreview}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-50"
                >
                  Cancel preview
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-amber-900">
              <span>New tokens: {activeDraftPreview.newTokenCount}</span>
              <span>Updated tokens: {activeDraftPreview.updatedTokenCount}</span>
              <span>Deleted tokens: {activeDraftPreview.deletedTokenCount}</span>
              <span>New categories: {activeDraftPreview.newCategoryCount}</span>
              <span>Updated categories: {activeDraftPreview.updatedCategoryCount}</span>
              <span>Deleted categories: {activeDraftPreview.deletedCategoryCount}</span>
            </div>
          </div>
        ) : null}

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
            {isLoading ? ' - загрузка...' : ''}
          </span>
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
                  onSelectToken={openToken}
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
                      onClick={() => openToken(token)}
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
              Ничего не найдено по текущему поиску или фильтрам.
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
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Import database</h2>
            <p className="text-sm text-zinc-500 mb-4">Preview changes before applying them. Use merge for partial updates and replace for full synchronization.</p>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setImportMode('merge')}
                className={`px-3 py-2 text-sm rounded-md border transition-colors ${importMode === 'merge' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'}`}
              >
                Merge import
              </button>
              <button
                onClick={() => setImportMode('replace-master')}
                className={`px-3 py-2 text-sm rounded-md border transition-colors ${importMode === 'replace-master' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50'}`}
              >
                Replace database
              </button>
            </div>
            <div className="mb-4">
              <label className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 cursor-pointer transition-colors">
                <Upload size={16} />
                Choose JSON file
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }

                    try {
                      const text = await file.text();
                      setImportJson(text);
                      setImportFileName(file.name);
                      setImportPreview(null);
                      setImportError(null);
                    } catch {
                      setImportError('Could not read the selected file.');
                    } finally {
                      event.target.value = '';
                    }
                  }}
                />
              </label>
              {importFileName ? <p className="text-xs text-zinc-500 mt-2">Selected file: {importFileName}</p> : null}
            </div>
            <textarea
              value={importJson}
              onChange={(event) => {
                setImportJson(event.target.value);
                if (!event.target.value.trim()) {
                  setImportFileName('');
                }
                setImportPreview(null);
                setImportError(null);
              }}
              className="w-full h-56 p-3 border border-zinc-300 rounded-md text-sm font-mono mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder='{"categories": [], "tokens": []}'
            />
            {importError ? <p className="text-sm text-red-600 mb-4">{importError}</p> : null}
            {importPreview ? (
              <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  <p><strong>Mode:</strong> {importPreview.mode}</p>
                  <p><strong>Incoming tokens:</strong> {importPreview.tokenCount}</p>
                  <p><strong>Incoming categories:</strong> {importPreview.categoryCount}</p>
                  <p><strong>New tokens:</strong> {importPreview.newTokenCount}</p>
                  <p><strong>Updated tokens:</strong> {importPreview.updatedTokenCount}</p>
                  <p><strong>Deleted tokens:</strong> {importPreview.deletedTokenCount}</p>
                  <p><strong>New categories:</strong> {importPreview.newCategoryCount}</p>
                  <p><strong>Updated categories:</strong> {importPreview.updatedCategoryCount}</p>
                  <p><strong>Deleted categories:</strong> {importPreview.deletedCategoryCount}</p>
                  <p><strong>Result:</strong> {importPreview.nextCategoryCount} categories, {importPreview.nextTokenCount} tokens</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {renderDiffList(
                    'New Tokens',
                    importPreview.newTokens.map((item) => `${item.name} (${item.id})`),
                    'No new tokens',
                    'text-emerald-700',
                  )}
                  {renderDiffList(
                    'Updated Tokens',
                    importPreview.updatedTokens.map((item) => `${item.name} (${item.id}) - ${item.changedFields.join(', ')}`),
                    'No updated tokens',
                    'text-amber-700',
                  )}
                  {renderDiffList(
                    'Deleted Tokens',
                    importPreview.deletedTokens.map((item) => `${item.name} (${item.id})`),
                    'No deleted tokens',
                    'text-red-700',
                  )}
                  {renderDiffList(
                    'New Categories',
                    importPreview.newCategories.map((item) => `${item.name} (${item.id})${item.parentId ? ` -> parent ${item.parentId}` : ''}`),
                    'No new categories',
                    'text-emerald-700',
                  )}
                  {renderDiffList(
                    'Updated Categories',
                    importPreview.updatedCategories.map((item) => `${item.name} (${item.id}) - ${item.changedFields.join(', ')}`),
                    'No updated categories',
                    'text-amber-700',
                  )}
                  {renderDiffList(
                    'Deleted Categories',
                    importPreview.deletedCategories.map((item) => `${item.name} (${item.id})`),
                    'No deleted categories',
                    'text-red-700',
                  )}
                </div>
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <button onClick={resetImportModal} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-md">
                Cancel
              </button>
              <button
                onClick={handlePreviewImport}
                disabled={!importJson.trim() || isPreviewingImport || isApplyingImport}
                className="px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md disabled:opacity-50"
              >
                {isPreviewingImport ? 'Previewing...' : 'Preview'}
              </button>
              <button
                onClick={openPreviewDraft}
                disabled={!importPreview || !importDraftId || isPreviewingImport || isApplyingImport || isOpeningPreviewCatalog}
                className="px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md disabled:opacity-50"
              >
                {isOpeningPreviewCatalog ? 'Opening...' : 'Open preview catalog'}
              </button>
              <button
                onClick={handleApplyImport}
                disabled={(!importJson.trim() && !importDraftId) || isPreviewingImport || isApplyingImport || isOpeningPreviewCatalog}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md disabled:opacity-50 ${importMode === 'replace-master' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {isApplyingImport ? 'Applying...' : importMode === 'replace-master' ? 'Replace database' : 'Apply merge'}
              </button>
            </div>
          </div>
        </div>
      )}

      <SystemStatus isAdmin={isAdmin} isSaving={isSaving} isLoggingOut={isLoggingOut} syncStatus={syncStatus} />
    </main>
  );
};
