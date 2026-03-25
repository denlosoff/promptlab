import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AiSuggestion,
  AppFeatures,
  Category,
  DataMeta,
  DraftSource,
  PromptNode,
  RecentInput,
  SyncStatus,
  Token,
  TokenSuggestion,
} from '../types';
import { api, setAdminToken } from '../lib/api';

interface AppContextType {
  categories: Category[];
  tokens: Token[];
  meta: DataMeta | null;
  features: AppFeatures;
  isReady: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isAdminDataReady: boolean;
  isLoggingOut: boolean;
  syncStatus: SyncStatus;
  isSaving: boolean;
  activeCategory: string | 'all';
  selectedFilters: Set<string>;
  searchQuery: string;
  promptNodes: PromptNode[];
  selectedToken: Token | null;
  isAddingToken: boolean;
  prefillName: string;
  promotingNodeId: string | null;
  selectedNodeIds: string[];
  activeInsertionIndex: number | null;
  recentInputs: RecentInput[];
  searchSettings: {
    name: boolean;
    aliases: boolean;
    description: boolean;
    category: boolean;
    suggestSynonyms: boolean;
  };
  aiModel: string;
  isDraftMode: boolean;
  draftSource: DraftSource | null;
  adminSuggestions: TokenSuggestion[];
  authError: string | null;
  setIsAdmin: (val: boolean) => void;
  loginAsAdmin: (password: string) => Promise<boolean>;
  logoutAdmin: () => Promise<void>;
  refreshSuggestions: () => Promise<void>;
  reviewSuggestion: (id: string, status: TokenSuggestion['status']) => Promise<void>;
  submitSuggestion: (payload: Omit<TokenSuggestion, 'id' | 'status' | 'createdAt'>) => Promise<void>;
  startDraft: (draft: { categories: Category[]; tokens: Token[] }, source?: DraftSource) => void;
  applyDraft: () => void;
  cancelDraft: () => void;
  refreshData: () => Promise<void>;
  setActiveCategory: (val: string | 'all') => void;
  setSelectedFilters: (val: Set<string>) => void;
  setSearchQuery: (val: string) => void;
  setPromptNodes: (val: PromptNode[]) => void;
  setSelectedToken: (val: Token | null) => void;
  setIsAddingToken: (val: boolean) => void;
  setPrefillName: (val: string) => void;
  setPromotingNodeId: (val: string | null) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setActiveInsertionIndex: (index: number | null) => void;
  setSearchSettings: (val: { name: boolean; aliases: boolean; description: boolean; category: boolean; suggestSynonyms: boolean }) => void;
  setAiModel: (val: string) => void;
  addToPrompt: (token: Token) => void;
  removeFromPrompt: (nodeId: string) => void;
  clearPrompt: () => void;
  addCustomNode: (text: string) => void;
  addNode: (node: Omit<PromptNode, 'id'>) => string;
  insertNode: (node: Omit<PromptNode, 'id'>, index: number) => string;
  updateNodeText: (nodeId: string, text: string) => void;
  updateNode: (nodeId: string, updates: Partial<PromptNode>) => void;
  reorderNodes: (activeId: string, overId: string) => void;
  setPromptFromText: (text: string) => void;
  parseTextToNodes: (text: string) => PromptNode[];
  groupNodes: (nodeIds: string[]) => void;
  addCategory: (category: Category) => void;
  updateCategory: (id: string, name: string, icon?: string, parentId?: string) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (activeId: string, overId: string) => void;
  addToken: (token: Token) => void;
  updateToken: (token: Token) => void;
  deleteToken: (id: string) => void;
  reorderTokens: (activeId: string, overId: string) => void;
  addWordFormToToken: (tokenId: string, wordForm: string) => void;
  importData: (data: any) => void;
  exportData: () => void;
  exportDataWithoutImages: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function getSavedState<T>(key: string, defaultValue: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error(`Error loading ${key}`, error);
  }

  return defaultValue;
}

function saveState(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key}`, error);
  }
}

function downloadJson(filename: string, payload: unknown, type = 'application/json') {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function normalizeIncomingData(data: any) {
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  const tokens = Array.isArray(data?.tokens) ? data.tokens : [];

  return {
    categories: categories.map((category: any) => ({
      id: String(category.id),
      name: String(category.name || ''),
      icon: category.icon ? String(category.icon) : undefined,
      parentId: category.parentId ? String(category.parentId) : undefined,
    })),
    tokens: tokens.map((token: any) => ({
      id: String(token.id),
      name: String(token.name || ''),
      descriptionShort: String(token.descriptionShort || ''),
      aliases: Array.isArray(token.aliases) ? token.aliases.map(String) : [],
      wordForms: Array.isArray(token.wordForms) ? token.wordForms.map(String) : [],
      categoryIds: Array.isArray(token.categoryIds) ? token.categoryIds.map(String) : [],
      examples: Array.isArray(token.examples) ? token.examples.map(String) : [],
      exampleCount: typeof token.exampleCount === 'number' ? token.exampleCount : undefined,
      coverImage: token.coverImage ? String(token.coverImage) : undefined,
    })),
  };
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [meta, setMeta] = useState<DataMeta | null>(null);
  const [features, setFeatures] = useState<AppFeatures>({ aiEnabled: false });
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'idle',
    startedAt: null,
    finishedAt: null,
    error: null,
    queued: false,
    currentJobId: null,
    recentJobs: [],
  });
  const [isAdmin, setIsAdminState] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<string | 'all'>('all');
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [promptNodes, setPromptNodes] = useState<PromptNode[]>(() => getSavedState('promptlab_promptNodes', []));
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [isAddingToken, setIsAddingToken] = useState(false);
  const [prefillName, setPrefillName] = useState('');
  const [promotingNodeId, setPromotingNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [activeInsertionIndex, setActiveInsertionIndex] = useState<number | null>(null);
  const [recentInputs, setRecentInputs] = useState<RecentInput[]>(() => getSavedState('promptlab_recentInputs', []));
  const [searchSettings, setSearchSettings] = useState(() =>
    getSavedState('promptlab_searchSettings', {
      name: true,
      aliases: true,
      description: false,
      category: false,
      suggestSynonyms: false,
    }),
  );
  const [aiModel, setAiModel] = useState(() => getSavedState('promptlab_aiModel', 'gemini-3-flash-preview'));
  const [isDraftMode, setIsDraftMode] = useState(false);
  const [draftSource, setDraftSource] = useState<DraftSource | null>(null);
  const [draftData, setDraftData] = useState<{ categories: Category[]; tokens: Token[] } | null>(null);
  const [adminSuggestions, setAdminSuggestions] = useState<TokenSuggestion[]>([]);
  const [hasFullData, setHasFullData] = useState(false);
  const hasHydratedRef = useRef(false);
  const latestCategoriesRef = useRef<Category[]>([]);
  const latestTokensRef = useRef<Token[]>([]);
  const saveTimeoutRef = useRef<number | null>(null);

  const currentCategories = isDraftMode && draftData ? draftData.categories : categories;
  const currentTokens = isDraftMode && draftData ? draftData.tokens : tokens;
  const isAdminDataReady = isAdmin;

  useEffect(() => saveState('promptlab_promptNodes', promptNodes), [promptNodes]);
  useEffect(() => saveState('promptlab_recentInputs', recentInputs), [recentInputs]);
  useEffect(() => saveState('promptlab_searchSettings', searchSettings), [searchSettings]);
  useEffect(() => saveState('promptlab_aiModel', aiModel), [aiModel]);
  useEffect(() => {
    latestCategoriesRef.current = categories;
  }, [categories]);
  useEffect(() => {
    latestTokensRef.current = tokens;
  }, [tokens]);

  useEffect(() => {
    if (activeCategory === 'all') {
      return;
    }

    const stillExists = currentCategories.some((category) => category.id === activeCategory);
    if (!stillExists) {
      setActiveCategory('all');
      setSelectedFilters(new Set());
    }
  }, [activeCategory, currentCategories]);

  useEffect(() => {
    if (!selectedToken) {
      return;
    }

    const nextSelectedToken = currentTokens.find((token) => token.id === selectedToken.id);
    if (!nextSelectedToken) {
      setSelectedToken(null);
      return;
    }

    const mergedSelectedToken: Token = {
      ...nextSelectedToken,
      coverImage: nextSelectedToken.coverImage || selectedToken.coverImage,
      exampleCount:
        nextSelectedToken.exampleCount ??
        selectedToken.exampleCount ??
        (selectedToken.examples?.length || 0),
      examples:
        nextSelectedToken.examples && nextSelectedToken.examples.length > 0
          ? nextSelectedToken.examples
          : selectedToken.examples || [],
    };

    if (JSON.stringify(mergedSelectedToken) !== JSON.stringify(selectedToken)) {
      setSelectedToken(mergedSelectedToken);
    }
  }, [selectedToken, currentTokens]);

  const loadData = async (full = false) => {
    setIsLoading(true);
    try {
      const [config, data] = await Promise.all([api.getConfig(), full ? api.getFullData() : api.getData()]);
      setFeatures({ aiEnabled: config.aiEnabled });
      if (config.rebuildStatus) {
        setSyncStatus(config.rebuildStatus);
      }
      setMeta(data.meta);
      setCategories(normalizeIncomingData(data).categories);
      setTokens(normalizeIncomingData(data).tokens);
      setHasFullData(full);
    } finally {
      setIsLoading(false);
      setIsReady(true);
      hasHydratedRef.current = true;
    }
  };

  const refreshData = async () => loadData(isAdmin);

  const persistLiveData = async (nextCategories: Category[], nextTokens: Token[]) => {
    if (isDraftMode || !isAdmin || !hasFullData) {
      return;
    }

    latestCategoriesRef.current = nextCategories;
    latestTokensRef.current = nextTokens;
    setIsSaving(true);

    try {
      const result = await api.saveData({
        categories: nextCategories,
        tokens: nextTokens,
      });

      if (result.rebuildStatus) {
        setSyncStatus(result.rebuildStatus);
      }

      setMeta({
        dataFile: result.dataFile,
        updatedAt: new Date().toISOString(),
        mode: 'full',
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const flushAdminChanges = async () => {
    if (isDraftMode || !isAdmin || !hasFullData) {
      return;
    }

    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    setIsSaving(true);
    try {
      const result = await api.saveData({
        categories: latestCategoriesRef.current,
        tokens: latestTokensRef.current,
      });
      if (result.rebuildStatus) {
        setSyncStatus(result.rebuildStatus);
      }
      setMeta({
        dataFile: result.dataFile,
        updatedAt: new Date().toISOString(),
        mode: 'full',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const refreshSuggestions = async () => {
    if (!isAdmin) {
      setAdminSuggestions([]);
      return;
    }

    const result = await api.getSuggestions();
    setAdminSuggestions(result.suggestions);
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await loadData(false);
        const session = await api.checkSession().catch(() => ({ isAdmin: false }));
        setIsAdminState(session.isAdmin);
        if (session.isAdmin) {
          setHasFullData(true);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsReady(true);
        setIsLoading(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      refreshSuggestions().catch((error) => console.error(error));
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const intervalId = window.setInterval(() => {
      api.getSyncStatus().then(setSyncStatus).catch((error) => console.error(error));
    }, 1500);

    api.getSyncStatus().then(setSyncStatus).catch((error) => console.error(error));

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isAdmin]);

  useEffect(() => {
    return;
  }, [categories, tokens, isDraftMode, isAdmin, hasFullData]);

  const setIsAdmin = (value: boolean) => {
    if (!value) {
      setAdminToken(null);
      setIsAdminState(false);
      setAdminSuggestions([]);
    } else {
      setIsAdminState(true);
    }
  };

  const loginAsAdmin = async (password: string) => {
    try {
      const result = await api.login(password);
      setAdminToken(result.token);
      setIsAdminState(true);
      setHasFullData(true);
      setAuthError(null);
      refreshSuggestions().catch((error) => console.error(error));
      return true;
    } catch {
      setAuthError('Неверный пароль администратора.');
      return false;
    }
  };

  const logoutAdmin = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    setAdminToken(null);
    setIsAdminState(false);
      setHasFullData(false);
    setAdminSuggestions([]);
      setSyncStatus({ state: 'idle', startedAt: null, finishedAt: null, error: null, queued: false, currentJobId: null, recentJobs: [] });

    api.logout().catch((error) => {
      console.error(error);
    });

    setIsLoggingOut(false);
    loadData(false).catch((error) => console.error(error));
  };

  const submitSuggestion = async (payload: Omit<TokenSuggestion, 'id' | 'status' | 'createdAt'>) => {
    await api.submitSuggestion(payload);
  };

  const reviewSuggestion = async (id: string, status: TokenSuggestion['status']) => {
    await api.updateSuggestionStatus(id, status);
    await refreshSuggestions();
  };

  const startDraft = (draft: { categories: Category[]; tokens: Token[] }, source: DraftSource = 'ai') => {
    setDraftData(draft);
    setIsDraftMode(true);
    setDraftSource(source);
  };

  const applyDraft = () => {
    if (draftData) {
      const clean = <T extends object>(items: T[]) =>
        items.map((item) => {
          const { isNew, isModified, ...rest } = item as T & { isNew?: boolean; isModified?: boolean };
          return rest as T;
        });
      setCategories(clean(draftData.categories));
      setTokens(clean(draftData.tokens));
    }

    setIsDraftMode(false);
    setDraftData(null);
    setDraftSource(null);
  };

  const cancelDraft = () => {
    setIsDraftMode(false);
    setDraftData(null);
    setDraftSource(null);
  };

  const updateRecentInputs = (text: string, type: 'token' | 'text', tokenId?: string) => {
    setRecentInputs((prev) => {
      const existing = prev.find((item) => item.text.toLowerCase() === text.toLowerCase() && item.type === type);
      if (existing) {
        return [
          { ...existing, count: existing.count + 1, lastUsed: Date.now() },
          ...prev.filter((item) => item !== existing),
        ].slice(0, 20);
      }

      return [{ text, type, tokenId, count: 1, lastUsed: Date.now() }, ...prev].slice(0, 20);
    });
  };

  const addToPrompt = (token: Token) => {
    const newNode: PromptNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'token',
      tokenId: token.id,
      text: token.name,
    };

    if (activeInsertionIndex !== null) {
      setPromptNodes((prev) => {
        const next = [...prev];
        next.splice(activeInsertionIndex, 0, newNode);
        return next;
      });
      setActiveInsertionIndex(activeInsertionIndex + 1);
    } else {
      setPromptNodes((prev) => [...prev, newNode]);
    }

    updateRecentInputs(token.name, 'token', token.id);
  };

  const removeFromPrompt = (nodeId: string) => {
    setPromptNodes((prev) => prev.filter((node) => node.id !== nodeId));
    setSelectedNodeIds((prev) => prev.filter((id) => id !== nodeId));
  };

  const clearPrompt = () => {
    setPromptNodes([]);
    setSelectedNodeIds([]);
  };

  const addNode = (node: Omit<PromptNode, 'id'>) => {
    const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const nextNode: PromptNode = { ...node, id };

    if (activeInsertionIndex !== null) {
      setPromptNodes((prev) => {
        const next = [...prev];
        next.splice(activeInsertionIndex, 0, nextNode);
        return next;
      });
      setActiveInsertionIndex(activeInsertionIndex + 1);
    } else {
      setPromptNodes((prev) => [...prev, nextNode]);
    }

    if (node.type === 'custom' || node.type === 'token') {
      updateRecentInputs(node.text, node.type as 'token' | 'text', node.tokenId);
    }

    return id;
  };

  const insertNode = (node: Omit<PromptNode, 'id'>, index: number) => {
    const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const nextNode: PromptNode = { ...node, id };
    setPromptNodes((prev) => {
      const next = [...prev];
      next.splice(index, 0, nextNode);
      return next;
    });
    setActiveInsertionIndex(index + 1);
    if (node.type === 'custom' || node.type === 'token') {
      updateRecentInputs(node.text, node.type as 'token' | 'text', node.tokenId);
    }
    return id;
  };

  const updateNodeText = (nodeId: string, text: string) => {
    setPromptNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, text } : node)));
  };

  const updateNode = (nodeId: string, updates: Partial<PromptNode>) => {
    setPromptNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, ...updates } : node)));
  };

  const reorderNodes = (activeId: string, overId: string) => {
    setPromptNodes((prev) => {
      const oldIndex = prev.findIndex((node) => node.id === activeId);
      const newIndex = prev.findIndex((node) => node.id === overId);
      if (oldIndex === -1 || newIndex === -1) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      return next;
    });
  };

  const parseTextToNodes = (text: string) => {
    const matchables: { text: string; tokenId: string }[] = [];

    currentTokens.forEach((token) => {
      matchables.push({ text: token.name, tokenId: token.id });
      token.aliases.forEach((alias) => alias.trim() && matchables.push({ text: alias.trim(), tokenId: token.id }));
      token.wordForms?.forEach((wordForm) => wordForm.trim() && matchables.push({ text: wordForm.trim(), tokenId: token.id }));
    });

    matchables.sort((a, b) => b.text.length - a.text.length);

    let remainingText = text;
    const nextNodes: PromptNode[] = [];
    const createId = () => `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    while (remainingText.length > 0) {
      remainingText = remainingText.trimStart();
      if (!remainingText) {
        break;
      }

      let matched: { text: string; tokenId: string } | null = null;
      for (const candidate of matchables) {
        if (remainingText.toLowerCase().startsWith(candidate.text.toLowerCase())) {
          matched = candidate;
          break;
        }
      }

      if (matched) {
        nextNodes.push({
          id: createId(),
          type: 'token',
          tokenId: matched.tokenId,
          text: remainingText.slice(0, matched.text.length),
        });
        remainingText = remainingText.slice(matched.text.length);
        continue;
      }

      const separatorMatch = remainingText.match(/^([.,!?;:\-+/*()\[\]{}="]+)/);
      if (separatorMatch) {
        nextNodes.push({ id: createId(), type: 'separator', text: separatorMatch[0] });
        remainingText = remainingText.slice(separatorMatch[0].length);
        continue;
      }

      const wordMatch = remainingText.match(/^([^\s.,!?;:\-+/*()\[\]{}="]+)/);
      if (wordMatch) {
        nextNodes.push({ id: createId(), type: 'custom', text: wordMatch[0] });
        remainingText = remainingText.slice(wordMatch[0].length);
        continue;
      }

      remainingText = remainingText.slice(1);
    }

    return nextNodes;
  };

  const setPromptFromText = (text: string) => {
    setPromptNodes(parseTextToNodes(text));
  };

  const groupNodes = (nodeIds: string[]) => {
    if (nodeIds.length < 2) {
      return;
    }

    setPromptNodes((prev) => {
      const indices = nodeIds
        .map((id) => prev.findIndex((node) => node.id === id))
        .filter((index) => index !== -1)
        .sort((a, b) => a - b);

      if (indices.length < 2) {
        return prev;
      }

      const mergedText = indices.map((index) => prev[index].text).join(' ');
      const nextNode: PromptNode = {
        id: `node_${Date.now()}`,
        type: 'custom',
        text: mergedText,
      };

      const next = [...prev];
      [...indices].reverse().forEach((index) => next.splice(index, 1));
      next.splice(indices[0], 0, nextNode);
      return next;
    });
    setSelectedNodeIds([]);
  };

  const addCategory = (category: Category) => {
    if (isDraftMode) {
      setDraftData((prev) => (prev ? { ...prev, categories: [...prev.categories, { ...category, isNew: true }] } : null));
      return;
    }

    setCategories((prev) => {
      const next = [...prev, category];
      latestCategoriesRef.current = next;
      return next;
    });
    if (isAdmin) {
      api.saveCategory(category).then((result) => {
        if (result.rebuildStatus) {
          setSyncStatus(result.rebuildStatus);
        }
        setMeta({
          dataFile: result.dataFile,
          updatedAt: new Date().toISOString(),
          mode: 'summary',
        });
      }).catch((error) => console.error(error));
    }
  };

  const updateCategory = (id: string, name: string, icon?: string, parentId?: string) => {
    const updater = (items: Category[]) =>
      items.map((category) =>
        category.id === id
          ? { ...category, name, ...(icon ? { icon } : {}), parentId, isModified: !category.isNew }
          : category,
      );

    if (isDraftMode) {
      setDraftData((prev) => (prev ? { ...prev, categories: updater(prev.categories) } : null));
      return;
    }

    setCategories((prev) => {
      const next = updater(prev);
      latestCategoriesRef.current = next;
      return next;
    });
    if (isAdmin) {
      api.saveCategory({ id, name, icon, parentId }).then((result) => {
        if (result.rebuildStatus) {
          setSyncStatus(result.rebuildStatus);
        }
        setMeta({
          dataFile: result.dataFile,
          updatedAt: new Date().toISOString(),
          mode: 'summary',
        });
      }).catch((error) => console.error(error));
    }
  };

  const deleteCategory = (id: string) => {
    const getAllChildIds = (categoryId: string, list: Category[]): string[] => {
      const children = list.filter((category) => category.parentId === categoryId);
      return children.flatMap((child) => [child.id, ...getAllChildIds(child.id, list)]);
    };

    const removeCategory = (list: Category[]) => {
      const idsToDelete = [id, ...getAllChildIds(id, list)];
      return {
        nextCategories: list.filter((category) => !idsToDelete.includes(category.id)),
        idsToDelete,
      };
    };

    if (isDraftMode) {
      setDraftData((prev) => {
        if (!prev) {
          return null;
        }

        const { nextCategories, idsToDelete } = removeCategory(prev.categories);
        return {
          categories: nextCategories,
          tokens: prev.tokens.map((token) => ({
            ...token,
            categoryIds: token.categoryIds.filter((categoryId) => !idsToDelete.includes(categoryId)),
          })),
        };
      });
      return;
    }

    setCategories((prev) => {
      const { nextCategories, idsToDelete } = removeCategory(prev);
      const nextTokens = latestTokensRef.current.map((token) => ({
        ...token,
        categoryIds: token.categoryIds.filter((categoryId) => !idsToDelete.includes(categoryId)),
      }));
      latestCategoriesRef.current = nextCategories;
      latestTokensRef.current = nextTokens;
      setTokens((currentTokens) => {
        const syncedTokens = currentTokens.map((token) => ({
          ...token,
          categoryIds: token.categoryIds.filter((categoryId) => !idsToDelete.includes(categoryId)),
        }));
        return syncedTokens;
      });
      return nextCategories;
    });
    if (isAdmin) {
      api.deleteCategory(id).then((result) => {
        if (result.rebuildStatus) {
          setSyncStatus(result.rebuildStatus);
        }
        setMeta({
          dataFile: result.dataFile,
          updatedAt: new Date().toISOString(),
          mode: 'summary',
        });
      }).catch((error) => console.error(error));
    }
  };

  const reorderCategories = (activeId: string, overId: string) => {
    const reorder = (items: Category[]) => {
      const oldIndex = items.findIndex((category) => category.id === activeId);
      const newIndex = items.findIndex((category) => category.id === overId);

      if (oldIndex === -1 || newIndex === -1) {
        return items;
      }

      const next = [...items];
      const moved = { ...next.splice(oldIndex, 1)[0] };
      moved.parentId = next[newIndex]?.parentId;
      next.splice(newIndex, 0, moved);
      return next;
    };

    if (isDraftMode) {
      setDraftData((prev) => (prev ? { ...prev, categories: reorder(prev.categories) } : null));
      return;
    }

    setCategories((prev) => {
      const next = reorder(prev);
      latestCategoriesRef.current = next;
      return next;
    });
    if (isAdmin) {
      const currentOrderedIds = reorder(latestCategoriesRef.current).map((category) => category.id);
      api.reorderCategories(currentOrderedIds).then((result) => {
        if (result.rebuildStatus) {
          setSyncStatus(result.rebuildStatus);
        }
        setMeta({
          dataFile: result.dataFile,
          updatedAt: new Date().toISOString(),
          mode: 'summary',
        });
      }).catch((error) => console.error(error));
    }
  };

  const addToken = (token: Token) => {
    if (isDraftMode) {
      setDraftData((prev) => (prev ? { ...prev, tokens: [...prev.tokens, { ...token, isNew: true }] } : null));
      return;
    }

    setTokens((prev) => {
      const next = [...prev, token];
      latestTokensRef.current = next;
      return next;
    });
    if (isAdmin) {
      api.saveToken(token).then((result) => {
        if (result.rebuildStatus) {
          setSyncStatus(result.rebuildStatus);
        }
        setMeta({
          dataFile: result.dataFile,
          updatedAt: new Date().toISOString(),
          mode: 'summary',
        });
      }).catch((error) => console.error(error));
    }
  };

  const updateToken = (token: Token) => {
    const updater = (items: Token[]) =>
      items.map((current) =>
        current.id === token.id
          ? { ...token, isModified: !current.isNew, isNew: current.isNew }
          : current,
      );

    if (isDraftMode) {
      setDraftData((prev) => (prev ? { ...prev, tokens: updater(prev.tokens) } : null));
      return;
    }

    setTokens((prev) => {
      const next = updater(prev);
      latestTokensRef.current = next;
      return next;
    });
    setSelectedToken(token);
    if (isAdmin) {
      api.saveToken(token).then((result) => {
        if (result.rebuildStatus) {
          setSyncStatus(result.rebuildStatus);
        }
        setMeta({
          dataFile: result.dataFile,
          updatedAt: new Date().toISOString(),
          mode: 'summary',
        });
      }).catch((error) => console.error(error));
    }
  };

  const deleteToken = (id: string) => {
    if (isDraftMode) {
      setDraftData((prev) => (prev ? { ...prev, tokens: prev.tokens.filter((token) => token.id !== id) } : null));
    } else {
      setTokens((prev) => {
        const next = prev.filter((token) => token.id !== id);
        latestTokensRef.current = next;
        return next;
      });
    }
    setPromptNodes((prev) => prev.filter((node) => node.type !== 'token' || node.tokenId !== id));
    if (!isDraftMode && isAdmin) {
      api.deleteToken(id).then((result) => {
        if (result.rebuildStatus) {
          setSyncStatus(result.rebuildStatus);
        }
        setMeta({
          dataFile: result.dataFile,
          updatedAt: new Date().toISOString(),
          mode: 'summary',
        });
      }).catch((error) => console.error(error));
    }
  };

  const reorderTokens = (activeId: string, overId: string) => {
    const reorder = (items: Token[]) => {
      const oldIndex = items.findIndex((token) => token.id === activeId);
      const newIndex = items.findIndex((token) => token.id === overId);
      if (oldIndex === -1 || newIndex === -1) {
        return items;
      }
      const next = [...items];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      return next;
    };

    if (isDraftMode) {
      setDraftData((prev) => (prev ? { ...prev, tokens: reorder(prev.tokens) } : null));
      return;
    }

    setTokens((prev) => {
      const next = reorder(prev);
      latestTokensRef.current = next;
      return next;
    });
  };

  const addWordFormToToken = (tokenId: string, wordForm: string) => {
    const updater = (items: Token[]) =>
      items.map((token) => {
        if (token.id !== tokenId) {
          return token;
        }
        const nextWordForms = token.wordForms || [];
        if (nextWordForms.includes(wordForm)) {
          return token;
        }
        return { ...token, wordForms: [...nextWordForms, wordForm] };
      });

    if (isDraftMode) {
      setDraftData((prev) => (prev ? { ...prev, tokens: updater(prev.tokens) } : null));
      return;
    }

    setTokens((prev) => {
      const next = updater(prev);
      latestTokensRef.current = next;
      return next;
    });
  };

  const importData = (data: any) => {
    const normalized = normalizeIncomingData(data);
    setCategories(normalized.categories);
    setTokens(normalized.tokens);
    latestCategoriesRef.current = normalized.categories;
    latestTokensRef.current = normalized.tokens;
  };

  const exportData = () => {
    downloadJson('promptlab-data.json', { categories: currentCategories, tokens: currentTokens });
  };

  const exportDataWithoutImages = () => {
    const strippedTokens = currentTokens.map((token) => ({ ...token, examples: [] }));
    const strippedCategories = currentCategories.map((category) =>
      category.icon?.startsWith('data:image') ? { ...category, icon: 'Box' } : category,
    );
    downloadJson('promptlab-data-no-images.txt', { categories: strippedCategories, tokens: strippedTokens }, 'text/plain');
  };

  const value = useMemo<AppContextType>(
    () => ({
      categories: currentCategories,
      tokens: currentTokens,
      meta,
      features,
      isReady,
        isLoading,
        isAdmin,
        isAdminDataReady,
        isLoggingOut,
        syncStatus,
        isSaving,
      activeCategory,
      selectedFilters,
      searchQuery,
      promptNodes,
      selectedToken,
      isAddingToken,
      prefillName,
      promotingNodeId,
      selectedNodeIds,
      activeInsertionIndex,
      recentInputs,
      searchSettings,
      aiModel,
      isDraftMode,
      draftSource,
      adminSuggestions,
      authError,
      setIsAdmin,
      loginAsAdmin,
      logoutAdmin,
      refreshSuggestions,
      reviewSuggestion,
      submitSuggestion,
      startDraft,
      applyDraft,
      cancelDraft,
      refreshData,
      setActiveCategory,
      setSelectedFilters,
      setSearchQuery,
      setPromptNodes,
      setSelectedToken,
      setIsAddingToken,
      setPrefillName,
      setPromotingNodeId,
      setSelectedNodeIds,
      setActiveInsertionIndex,
      setSearchSettings,
      setAiModel,
      addToPrompt,
      removeFromPrompt,
      clearPrompt,
      addCustomNode: (text: string) => addNode({ type: 'custom', text }),
      addNode,
      insertNode,
      updateNodeText,
      updateNode,
      reorderNodes,
      setPromptFromText,
      parseTextToNodes,
      groupNodes,
      addCategory,
      updateCategory,
      deleteCategory,
      reorderCategories,
      addToken,
      updateToken,
      deleteToken,
      reorderTokens,
      addWordFormToToken,
      importData,
      exportData,
      exportDataWithoutImages,
    }),
    [
      currentCategories,
      currentTokens,
      meta,
      features,
      isReady,
      isLoading,
      isAdmin,
      isAdminDataReady,
      isLoggingOut,
      syncStatus,
      isSaving,
      activeCategory,
      selectedFilters,
      searchQuery,
      promptNodes,
      selectedToken,
      isAddingToken,
      prefillName,
      promotingNodeId,
      selectedNodeIds,
      activeInsertionIndex,
      recentInputs,
      searchSettings,
      aiModel,
      isDraftMode,
      draftSource,
      adminSuggestions,
      authError,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};
