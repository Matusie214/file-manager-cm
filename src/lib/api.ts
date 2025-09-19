const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://your-app.netlify.app/api' 
  : '/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || 'Request failed');
    }

    return response.json();
  }

  private async uploadRequest<T>(endpoint: string, formData: FormData): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const token = this.getToken();

    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || 'Request failed');
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ token: string; user: { id: string; email: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(email: string, password: string) {
    return this.request<{ token: string; user: { id: string; email: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  // Folders
  async getFolders(parentId?: string, limit = 50, offset = 0) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    if (parentId) params.set('parentId', parentId);
    
    return this.request<unknown[]>(`/folders?${params}`);
  }

  async createFolder(name: string, parentId?: string) {
    return this.request<unknown>('/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parentId }),
    });
  }

  async deleteFolder(id: string) {
    return this.request<{ success: boolean }>(`/folders/${id}`, {
      method: 'DELETE',
    });
  }

  // Files
  async getFiles(folderId?: string, limit = 50, offset = 0) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    if (folderId) params.set('folderId', folderId);
    
    return this.request<unknown[]>(`/files?${params}`);
  }

  async getRecentFiles(limit = 20) {
    const params = new URLSearchParams({
      recent: 'true',
      limit: limit.toString(),
    });
    
    return this.request<unknown[]>(`/files?${params}`);
  }

  async uploadFile(file: File, folderId: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderId', folderId);
    
    return this.uploadRequest<unknown>('/files', formData);
  }

  async deleteFile(id: string) {
    return this.request<{ success: boolean }>(`/files/${id}`, {
      method: 'DELETE',
    });
  }

  async moveFile(id: string, folderId: string) {
    return this.request<unknown>(`/files/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ folderId }),
    });
  }

  // Zip operations
  async createZipJob(fileIds: string[]) {
    return this.request<{ jobId: string; status: string }>('/zip', {
      method: 'POST',
      body: JSON.stringify({ fileIds }),
    });
  }

  async getZipJobStatus(jobId: string) {
    return this.request<{ 
      jobId: string; 
      status: string; 
      downloadUrl?: string;
      createdAt: string;
      completedAt?: string;
    }>(`/zip?jobId=${jobId}`);
  }

  async downloadZip(jobId: string): Promise<Blob> {
    const url = `${API_BASE}/zip/${jobId}`;
    const token = this.getToken();

    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error('Download failed');
    }

    return response.blob();
  }
}

export const apiClient = new ApiClient();