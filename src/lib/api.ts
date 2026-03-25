const ADMIN_TOKEN_KEY = 'promptlab_admin_token';

type ApiSyncStatus = {
  state: 'idle' | 'running' | 'error';
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  queued?: boolean;
  currentJobId?: string | null;
  recentJobs?: any[];
};

export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string | null) {
  if (token) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    return;
  }

  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

type RequestOptions = RequestInit & {
  requireAuth?: boolean;
};

async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.requireAuth) {
    const token = getAdminToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  getConfig: () =>
    request<{
      aiEnabled: boolean;
      dataFile: string;
      rebuildStatus?: ApiSyncStatus;
    }>('/api/config'),
  getSyncStatus: () => request<ApiSyncStatus>('/api/sync-status'),
  getAdminJobs: () =>
    request<{ jobs: any[] }>('/api/admin/jobs', {
      requireAuth: true,
    }),
  getData: () =>
    request<{
      categories: any[];
      tokens: any[];
      meta: { dataFile: string; updatedAt: string; mode: string };
    }>('/api/data'),
  getFullData: () =>
    request<{
      categories: any[];
      tokens: any[];
      meta: { dataFile: string; updatedAt: string; mode: string };
    }>('/api/data?full=1', { requireAuth: true }),
  getToken: (id: string) => request<{ token: any }>(`/api/tokens/${id}`),
  login: (password: string) =>
    request<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  checkSession: () => request<{ isAdmin: boolean }>('/api/auth/session', { requireAuth: true }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST', requireAuth: true }),
  saveData: (data: { categories: any[]; tokens: any[] }) =>
    request<{ ok: boolean; dataFile: string; rebuildStatus?: any }>('/api/admin/data', {
      method: 'POST',
      requireAuth: true,
      body: JSON.stringify(data),
    }),
  saveToken: (token: any) =>
    request<{ ok: boolean; token: any; dataFile: string; rebuildStatus?: any }>('/api/admin/tokens', {
      method: 'POST',
      requireAuth: true,
      body: JSON.stringify(token),
    }),
  deleteToken: (id: string) =>
    request<{ ok: boolean; dataFile: string; rebuildStatus?: any }>(`/api/admin/tokens/${id}`, {
      method: 'DELETE',
      requireAuth: true,
    }),
  saveCategory: (category: any) =>
    request<{ ok: boolean; category: any; dataFile: string; rebuildStatus?: any }>('/api/admin/categories', {
      method: 'POST',
      requireAuth: true,
      body: JSON.stringify(category),
    }),
  deleteCategory: (id: string) =>
    request<{ ok: boolean; dataFile: string; rebuildStatus?: any }>(`/api/admin/categories/${id}`, {
      method: 'DELETE',
      requireAuth: true,
    }),
  reorderCategories: (orderedIds: string[]) =>
    request<{ ok: boolean; dataFile: string; rebuildStatus?: any }>('/api/admin/categories/reorder', {
      method: 'POST',
      requireAuth: true,
      body: JSON.stringify({ orderedIds }),
    }),
  previewImport: (payload: any) =>
    request<{ preview: any; draftId: string }>('/api/admin/import/preview', {
      method: 'POST',
      requireAuth: true,
      body: JSON.stringify(payload),
    }),
  getImportDraft: (draftId: string) =>
    request<{ draftId: string; preview: any; nextData: { categories: any[]; tokens: any[] } }>(`/api/admin/import/drafts/${draftId}`, {
      requireAuth: true,
    }),
  applyImport: (payload: any) =>
    request<{ ok: boolean; dataFile: string; rebuildStatus?: any }>('/api/admin/import/apply', {
      method: 'POST',
      requireAuth: true,
      body: JSON.stringify(payload),
    }),
  submitSuggestion: (payload: any) =>
    request<{ ok: boolean; suggestion: any }>('/api/suggestions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getSuggestions: () =>
    request<{ suggestions: any[] }>('/api/admin/suggestions', {
      requireAuth: true,
    }),
  updateSuggestionStatus: (id: string, status: 'pending' | 'approved' | 'rejected') =>
    request<{ ok: boolean; suggestion: any }>(`/api/admin/suggestions/${id}/status`, {
      method: 'POST',
      requireAuth: true,
      body: JSON.stringify({ status }),
    }),
};
