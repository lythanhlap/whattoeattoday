const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest(path, options = {}) {
  const { accessToken, headers, includeMeta, ...requestOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    credentials: 'include',
    headers: {
      ...(requestOptions.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    throw new ApiError(
      payload?.error?.message || 'Không thể hoàn tất yêu cầu',
      response.status,
      payload?.error?.code || 'REQUEST_FAILED',
      payload?.error?.details,
    );
  }

  return includeMeta ? payload : payload?.data;
}

export const authApi = {
  register: (input) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  refresh: () => apiRequest('/auth/refresh', { method: 'POST' }),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  me: (accessToken) => apiRequest('/auth/me', { accessToken }),
  changePassword: (input, accessToken) => apiRequest('/auth/change-password', { method: 'POST', accessToken, body: JSON.stringify(input) }),
};

export const recipeApi = {
  list: ({ page = 1, limit = 12, q = '', sort = 'newest', maxCookTime, categoryId, tags, hasCooksnap, mine, status, visibility, ingredient = '', diet = '', featured = false, accessToken } = {}) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), sort });
    if (q.trim()) params.set('q', q.trim());
    if (ingredient.trim()) params.set('ingredient', ingredient.trim());
    if (diet) params.set('diet', diet);
    if (featured) params.set('featured', 'true');
    if (maxCookTime) params.set('maxCookTime', String(maxCookTime));
    if (categoryId) params.set('categoryId', categoryId);
    if (tags?.length) params.set('tags', tags.join(','));
    if (hasCooksnap) params.set('hasCooksnap', 'true');
    if (mine) params.set('mine', 'true');
    if (status) params.set('status', status);
    if (visibility) params.set('visibility', visibility);
    return apiRequest(`/recipes?${params.toString()}`, { accessToken, includeMeta: true });
  },
  getBySlug: (slug, accessToken) => apiRequest(`/recipes/${encodeURIComponent(slug)}`, { accessToken }),
  create: (input, accessToken) => apiRequest('/recipes', { method: 'POST', accessToken, body: JSON.stringify(input) }),
  update: (id, input, accessToken) => apiRequest(`/recipes/${id}`, { method: 'PATCH', accessToken, body: JSON.stringify(input) }),
  publish: (id, accessToken) => apiRequest(`/recipes/${id}/publish`, { method: 'POST', accessToken }),
  recordView: (id, accessToken) => apiRequest(`/recipes/${id}/view`, { method: 'POST', accessToken }),
};

export const taxonomyApi = {
  categories: () => apiRequest('/categories'),
  tags: () => apiRequest('/tags'),
  createCategory: (input, accessToken) => apiRequest('/categories', { method: 'POST', accessToken, body: JSON.stringify(input) }),
  updateCategory: (id, input, accessToken) => apiRequest(`/categories/${id}`, { method: 'PATCH', accessToken, body: JSON.stringify(input) }),
  deleteCategory: (id, accessToken) => apiRequest(`/categories/${id}`, { method: 'DELETE', accessToken }),
  createTag: (input, accessToken) => apiRequest('/tags', { method: 'POST', accessToken, body: JSON.stringify(input) }),
  updateTag: (id, input, accessToken) => apiRequest(`/tags/${id}`, { method: 'PATCH', accessToken, body: JSON.stringify(input) }),
  deleteTag: (id, accessToken) => apiRequest(`/tags/${id}`, { method: 'DELETE', accessToken }),
};

export const discoveryApi = {
  trendingKeywords: () => apiRequest('/trending-keywords'),
};

export const editorialApi = {
  reviewQueue: (params = {}, accessToken) => {
    const query = new URLSearchParams({ page: String(params.page || 1), limit: String(params.limit || 20) });
    if (params.status) query.set('status', params.status);
    return apiRequest(`/moderation/review-queue?${query.toString()}`, { accessToken, includeMeta: true });
  },
  review: (id, input, accessToken) => apiRequest(`/moderation/recipes/${id}/review`, { method: 'POST', accessToken, body: JSON.stringify(input) }),
  feature: (id, featured, accessToken) => apiRequest(`/moderation/recipes/${id}/featured`, { method: 'PATCH', accessToken, body: JSON.stringify({ featured }) }),
};

export const communityApi = {
  bookmarks: (accessToken) => apiRequest('/me/bookmarks', { accessToken }),
  addBookmark: (recipeId, collectionId, accessToken) => apiRequest(`/recipes/${recipeId}/bookmark`, { method: 'POST', accessToken, body: JSON.stringify({ collectionId }) }),
  removeBookmark: (recipeId, accessToken) => apiRequest(`/recipes/${recipeId}/bookmark`, { method: 'DELETE', accessToken }),
  collections: (accessToken) => apiRequest('/me/collections', { accessToken }),
  getCollection: (id, accessToken) => apiRequest(`/collections/${id}`, { accessToken }),
  createCollection: (input, accessToken) => apiRequest('/collections', { method: 'POST', accessToken, body: JSON.stringify(input) }),
  updateCollection: (id, input, accessToken) => apiRequest(`/collections/${id}`, { method: 'PATCH', accessToken, body: JSON.stringify(input) }),
  deleteCollection: (id, accessToken) => apiRequest(`/collections/${id}`, { method: 'DELETE', accessToken }),
  reportRecipe: (recipeId, input, accessToken) => apiRequest(`/recipes/${recipeId}/report`, { method: 'POST', accessToken, body: JSON.stringify(input) }),
  reportTarget: (type, id, input, accessToken) => apiRequest(`/moderation/${type}/${id}/report`, { method: 'POST', accessToken, body: JSON.stringify(input) }),
  reports: (accessToken) => apiRequest('/moderation/reports', { accessToken }),
  resolveReport: (id, input, accessToken) => apiRequest(`/moderation/reports/${id}/resolve`, { method: 'POST', accessToken, body: JSON.stringify(input) }),
  bulkResolveReports: (ids, input, accessToken) => apiRequest('/moderation/reports/bulk-resolve', { method: 'POST', accessToken, body: JSON.stringify({ ...input, ids }) }),
  warnUser: (id, message, accessToken) => apiRequest(`/moderation/users/${id}/warn`, { method: 'POST', accessToken, body: JSON.stringify({ message }) }),
  suspendUser: (id, input, accessToken) => apiRequest(`/moderation/users/${id}/suspend`, { method: 'POST', accessToken, body: JSON.stringify(input) }),
  auditLogs: (accessToken) => apiRequest('/moderation/audit-logs', { accessToken }),
  cooksnaps: (recipeId, accessToken) => apiRequest(`/recipes/${recipeId}/cooksnaps`, { accessToken }),
  createCooksnap: (recipeId, input, accessToken) => apiRequest(`/recipes/${recipeId}/cooksnaps`, { method: 'POST', accessToken, body: JSON.stringify(input) }),
  deleteCooksnap: (id, accessToken) => apiRequest(`/cooksnaps/${id}`, { method: 'DELETE', accessToken }),
  comments: (recipeId, accessToken) => apiRequest(`/recipes/${recipeId}/comments`, { accessToken }),
  createComment: (recipeId, content, accessToken) => apiRequest(`/recipes/${recipeId}/comments`, { method: 'POST', accessToken, body: JSON.stringify({ content }) }),
  deleteComment: (id, accessToken) => apiRequest(`/comments/${id}`, { method: 'DELETE', accessToken }),
  follow: (userId, accessToken) => apiRequest(`/users/${userId}/follow`, { method: 'POST', accessToken }),
  unfollow: (userId, accessToken) => apiRequest(`/users/${userId}/follow`, { method: 'DELETE', accessToken }),
  feed: (page, accessToken) => apiRequest(`/me/feed?page=${page}&limit=20`, { accessToken, includeMeta: true }),
  profile: (username, accessToken) => apiRequest(`/users/${encodeURIComponent(username)}`, { accessToken }),
  profileConnections: (username, relation) => apiRequest(`/users/${encodeURIComponent(username)}/${relation}`),
  updateProfile: (input, accessToken) => apiRequest('/me/profile', { method: 'PATCH', accessToken, body: JSON.stringify(input) }),
};

export const adminApi = {
  users: (accessToken) => apiRequest('/admin/users', { accessToken }),
  updateUser: (id, input, accessToken) => apiRequest(`/admin/users/${id}`, { method: 'PATCH', accessToken, body: JSON.stringify(input) }),
  auditLogs: (accessToken) => apiRequest('/admin/audit-logs', { accessToken }),
  warnUser: (id, message, accessToken) => apiRequest(`/admin/users/${id}/warn`, { method: 'POST', accessToken, body: JSON.stringify({ message }) }),
  contentStats: (accessToken) => apiRequest('/admin/content-stats', { accessToken }),
  featureRecipe: (id, featured, accessToken) => apiRequest(`/admin/recipes/${id}/featured`, { method: 'PATCH', accessToken, body: JSON.stringify({ featured }) }),
  contentDashboard: (accessToken) => apiRequest('/admin/content-dashboard', { accessToken }),
  content: ({ type = 'recipes', page = 1, limit = 20, state = 'all', q = '' } = {}, accessToken) => {
    const params = new URLSearchParams({ type, page: String(page), limit: String(limit), state });
    if (q.trim()) params.set('q', q.trim());
    return apiRequest(`/admin/content?${params.toString()}`, { accessToken, includeMeta: true });
  },
  contentAction: (type, id, input, accessToken) => apiRequest(`/admin/content/${type}/${id}/action`, { method: 'POST', accessToken, body: JSON.stringify(input) }),
  bulkContentAction: (input, accessToken) => apiRequest('/admin/content/bulk', { method: 'POST', accessToken, body: JSON.stringify(input) }),
};

export const notificationApi = {
  list: (accessToken) => apiRequest('/me/notifications?page=1&limit=50', { accessToken, includeMeta: true }),
  markRead: (id, accessToken) => apiRequest(`/me/notifications/${id}/read`, { method: 'PATCH', accessToken }),
  markAllRead: (accessToken) => apiRequest('/me/notifications/read-all', { method: 'POST', accessToken }),
};

export const challengeApi = {
  list: ({ page = 1, limit = 12, status } = {}) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set('status', status);
    return apiRequest(`/challenges?${params.toString()}`, { includeMeta: true });
  },
  get: (id, accessToken) => apiRequest(`/challenges/${id}`, { accessToken }),
  create: (input, accessToken) => apiRequest('/challenges', { method: 'POST', accessToken, body: JSON.stringify(input) }),
  update: (id, input, accessToken) => apiRequest(`/challenges/${id}`, { method: 'PATCH', accessToken, body: JSON.stringify(input) }),
  archive: (id, accessToken) => apiRequest(`/challenges/${id}`, { method: 'DELETE', accessToken }),
  submitEntry: (id, recipeId, accessToken) => apiRequest(`/challenges/${id}/entries`, { method: 'POST', accessToken, body: JSON.stringify({ recipeId }) }),
  removeEntry: (id, entryId, accessToken) => apiRequest(`/challenges/${id}/entries/${entryId}`, { method: 'DELETE', accessToken }),
};

export async function uploadImageToCloudinary(file, accessToken, purpose = 'cooksnap') {
  const signatureResult = await apiRequest('/media/signature', { method: 'POST', accessToken, body: JSON.stringify({ purpose }) });
  const upload = signatureResult.upload;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > upload.maxFileSize) {
    throw new ApiError('Ảnh phải là JPG, PNG hoặc WEBP và không vượt quá giới hạn dung lượng.', 422, 'MEDIA_POLICY_VIOLATION');
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', upload.apiKey);
  formData.append('timestamp', String(upload.timestamp));
  formData.append('folder', upload.folder);
  formData.append('public_id', upload.publicId);
  formData.append('signature', upload.signature);
  formData.append('allowed_formats', upload.allowedFormats);
  formData.append('max_file_size', String(upload.maxFileSize));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${upload.cloudName}/${upload.resourceType}/upload`, { method: 'POST', body: formData });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.secure_url) throw new ApiError(result?.error?.message || 'Không thể upload ảnh', response.status, 'MEDIA_UPLOAD_FAILED');
  const registered = await apiRequest('/media/assets', { method: 'POST', accessToken, body: JSON.stringify({ mediaAssetId: upload.mediaAssetId, publicId: result.public_id }) });
  return { ...result, mediaAssetId: registered.asset.id };
}
