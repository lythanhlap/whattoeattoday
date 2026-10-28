import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { EmptyState, ErrorState, LoadingState } from '../features/recipes/RecipeStates.jsx';
import { editorialApi, taxonomyApi, uploadImageToCloudinary } from '../services/apiClient.js';
import { useDocumentMeta } from '../lib/useDocumentMeta.js';
import { optimizedImageUrl } from '../utils/image.js';

const STATUS_OPTIONS = [
  { value: 'PENDING_REVIEW', label: 'Chờ duyệt' },
  { value: 'REJECTED', label: 'Bị từ chối' },
  { value: 'DRAFT', label: 'Cần chỉnh sửa' },
  { value: 'PUBLISHED', label: 'Đã xuất bản' },
];

const STATUS_LABELS = {
  DRAFT: 'Bản nháp',
  PENDING_REVIEW: 'Chờ duyệt',
  PUBLISHED: 'Đã xuất bản',
  REJECTED: 'Bị từ chối',
  ARCHIVED: 'Đã lưu trữ',
};

function formatDate(value) {
  return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(value)) : '—';
}

export function EditorPage() {
  const { user, accessToken } = useAuth();
  const [tab, setTab] = useState('review');
  const isEditor = ['EDITOR', 'ADMIN'].includes(user?.role);

  useDocumentMeta({
    title: 'Khu vực biên tập | Bếp Nhà',
    description: 'Duyệt công thức cộng đồng và quản lý danh mục, tag, banner trang chủ.',
    noindex: true,
  });

  if (!isEditor) {
    return (
      <section className="editor-page">
        <h1>Khu vực biên tập</h1>
        <p>Bạn cần quyền biên tập viên để truy cập trang này.</p>
        <Link className="primary-button button-link" to="/">Về trang chủ</Link>
      </section>
    );
  }

  return (
    <section className="editor-page">
      <p className="eyebrow">Biên tập nội dung</p>
      <h1>Duyệt công thức & quản lý nội dung biên tập</h1>
      <div className="tab-list" role="tablist" aria-label="Khu vực biên tập">
        <button className={tab === 'review' ? 'tab-button active' : 'tab-button'} type="button" role="tab" aria-selected={tab === 'review'} onClick={() => setTab('review')}>Duyệt công thức</button>
        <button className={tab === 'taxonomy' ? 'tab-button active' : 'tab-button'} type="button" role="tab" aria-selected={tab === 'taxonomy'} onClick={() => setTab('taxonomy')}>Danh mục & tag</button>
        <button className={tab === 'banners' ? 'tab-button active' : 'tab-button'} type="button" role="tab" aria-selected={tab === 'banners'} onClick={() => setTab('banners')}>Banner trang chủ</button>
      </div>
      {tab === 'review' && <ReviewQueue accessToken={accessToken} />}
      {tab === 'taxonomy' && <TaxonomyManager accessToken={accessToken} />}
      {tab === 'banners' && <BannerManager accessToken={accessToken} />}
    </section>
  );
}

const EMPTY_BANNER_FORM = { title: '', subtitle: '', linkUrl: '', imageId: '', sortOrder: 0, isActive: true, startsAt: '', endsAt: '' };

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function BannerManager({ accessToken }) {
  const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null });
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(EMPTY_BANNER_FORM);
  const [editingId, setEditingId] = useState(null);
  const [preview, setPreview] = useState('');
  const [upload, setUpload] = useState({ status: 'idle', error: null });
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const result = await editorialApi.banners({ status: filter, limit: 20 }, accessToken);
      setState({ status: 'success', items: result.data, meta: result.meta, error: null });
    } catch (error) {
      setState({ status: 'error', items: [], meta: null, error });
    }
  }, [accessToken, filter]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm(EMPTY_BANNER_FORM);
    setEditingId(null);
    setPreview('');
    setUpload({ status: 'idle', error: null });
  };

  const startEdit = (banner) => {
    setEditingId(banner.id);
    setForm({
      title: banner.title,
      subtitle: banner.subtitle || '',
      linkUrl: banner.linkUrl || '',
      imageId: banner.image?.id || '',
      sortOrder: banner.sortOrder ?? 0,
      isActive: banner.isActive,
      startsAt: toLocalInput(banner.startsAt),
      endsAt: toLocalInput(banner.endsAt),
    });
    setPreview(banner.image?.secureUrl || '');
    setUpload({ status: 'idle', error: null });
    setMessage(null);
  };

  const pickImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUpload({ status: 'uploading', error: null });
    try {
      const uploaded = await uploadImageToCloudinary(file, accessToken, 'banner');
      setForm((current) => ({ ...current, imageId: uploaded.mediaAssetId }));
      setPreview(URL.createObjectURL(file));
      setUpload({ status: 'done', error: null });
    } catch (error) {
      setUpload({ status: 'error', error: error.message });
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.imageId) {
      setMessage({ type: 'error', text: 'Hãy tải lên ảnh banner trước khi lưu.' });
      return;
    }
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      linkUrl: form.linkUrl.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      imageId: form.imageId,
    };
    setWorking(true);
    setMessage(null);
    try {
      if (editingId) await editorialApi.updateBanner(editingId, payload, accessToken);
      else await editorialApi.createBanner(payload, accessToken);
      setMessage({ type: 'success', text: editingId ? 'Đã cập nhật banner.' : 'Đã thêm banner.' });
      resetForm();
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setWorking(false);
    }
  };

  const toggleActive = async (banner) => {
    setWorking(true);
    setMessage(null);
    try {
      await editorialApi.updateBanner(banner.id, { isActive: !banner.isActive }, accessToken);
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setWorking(false);
    }
  };

  const remove = async (banner) => {
    if (!window.confirm(`Xóa banner "${banner.title}"?`)) return;
    setWorking(true);
    setMessage(null);
    try {
      await editorialApi.deleteBanner(banner.id, accessToken);
      setMessage({ type: 'success', text: 'Đã xóa banner.' });
      if (editingId === banner.id) resetForm();
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="editor-panel">
      <div className="editor-toolbar">
        <label>
          Trạng thái
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">Tất cả</option>
            <option value="active">Đang bật</option>
            <option value="inactive">Đang tắt</option>
          </select>
        </label>
        <button className="secondary-button" type="button" onClick={load}>Làm mới</button>
      </div>
      {message && <p className={message.type === 'error' ? 'form-error' : 'form-success'} role="status">{message.text}</p>}

      <form className="inline-form banner-form" onSubmit={submit}>
        <h2>{editingId ? 'Sửa banner' : 'Thêm banner'}</h2>
        <label>Tiêu đề<input required minLength="3" maxLength="120" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>Mô tả ngắn<input maxLength="240" value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} /></label>
        <label>Liên kết<input maxLength="500" placeholder="/cong-thuc?diet=mon-chay hoặc https://…" value={form.linkUrl} onChange={(event) => setForm({ ...form, linkUrl: event.target.value })} /></label>
        <label>Thứ tự hiển thị<input type="number" min="0" max="999" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} /></label>
        <label>Bắt đầu<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label>
        <label>Kết thúc<input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label>
        <label className="checkbox-field"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />Hiển thị trên trang chủ</label>
        <label>Ảnh banner<input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickImage} disabled={upload.status === 'uploading'} /></label>
        {upload.status === 'uploading' && <p className="field-hint">Đang tải ảnh…</p>}
        {upload.error && <p className="form-error">{upload.error}</p>}
        {preview && <img className="banner-form-preview" src={preview} alt="Xem trước ảnh banner" loading="lazy" />}
        <div className="review-action-buttons">
          <button className="primary-button" type="submit" disabled={working}>{editingId ? 'Lưu thay đổi' : 'Thêm banner'}</button>
          {editingId && <button className="secondary-button" type="button" onClick={resetForm} disabled={working}>Hủy sửa</button>}
        </div>
      </form>

      {state.status === 'loading' && <LoadingState label="Đang tải banner..." />}
      {state.status === 'error' && <ErrorState error={state.error} onRetry={load} />}
      {state.status === 'success' && state.items.length === 0 && (
        <EmptyState title="Chưa có banner">
          <p>Thêm banner để giới thiệu chủ đề nấu ăn trên trang chủ.</p>
        </EmptyState>
      )}
      {state.status === 'success' && state.items.length > 0 && (
        <ul className="taxonomy-list banner-list">
          {state.items.map((banner) => (
            <li key={banner.id}>
              <div className="banner-row">
                {banner.image?.secureUrl
                  ? <img src={optimizedImageUrl(banner.image.secureUrl, { width: 160, height: 90 })} alt={`Ảnh banner ${banner.title}`} loading="lazy" width="160" height="90" />
                  : <span className="banner-row-placeholder" aria-hidden="true" />}
                <div>
                  <strong>{banner.title}</strong>
                  <small>Thứ tự {banner.sortOrder} · {banner.isActive ? 'Đang bật' : 'Đang tắt'}</small>
                  {(banner.startsAt || banner.endsAt) && (
                    <small>{formatDate(banner.startsAt)} → {formatDate(banner.endsAt)}</small>
                  )}
                </div>
              </div>
              <div className="taxonomy-actions">
                <button className="text-button" type="button" disabled={working} onClick={() => toggleActive(banner)}>
                  {banner.isActive ? 'Tắt' : 'Bật'}
                </button>
                <button className="text-button" type="button" disabled={working} onClick={() => startEdit(banner)}>Sửa</button>
                <button className="icon-button" type="button" aria-label={`Xóa banner ${banner.title}`} disabled={working} onClick={() => remove(banner)}>×</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {state.meta && <p className="pagination-info">Trang {state.meta.page}/{state.meta.totalPages || 1} · {state.meta.total} banner</p>}
    </div>
  );
}

function ReviewQueue({ accessToken }) {
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null });
  const [notes, setNotes] = useState({});
  const [workingId, setWorkingId] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const result = await editorialApi.reviewQueue({ status, limit: 20 }, accessToken);
      setState({ status: 'success', items: result.data, meta: result.meta, error: null });
    } catch (error) {
      setState({ status: 'error', items: [], meta: null, error });
    }
  }, [accessToken, status]);

  useEffect(() => { load(); }, [load]);

  const act = async (recipe, action) => {
    const note = (notes[recipe.id] || '').trim();
    if (['REJECT', 'REQUEST_CHANGES'].includes(action) && note.length < 5) {
      setMessage({ type: 'error', text: 'Hãy nhập ghi chú ít nhất 5 ký tự để giải thích cho tác giả.' });
      return;
    }
    if (action === 'APPROVE' && !window.confirm(`Duyệt và xuất bản công thức "${recipe.title}"?`)) return;
    setWorkingId(recipe.id);
    setMessage(null);
    try {
      await editorialApi.review(recipe.id, { action, note: note || null }, accessToken);
      setNotes((current) => ({ ...current, [recipe.id]: '' }));
      setMessage({ type: 'success', text: action === 'APPROVE' ? 'Đã duyệt công thức.' : 'Đã gửi phản hồi cho tác giả.' });
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setWorkingId(null);
    }
  };

  const toggleFeatured = async (recipe) => {
    setWorkingId(recipe.id);
    setMessage(null);
    try {
      await editorialApi.feature(recipe.id, !recipe.featuredAt, accessToken);
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="editor-panel">
      <div className="editor-toolbar">
        <label>
          Trạng thái
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button className="secondary-button" type="button" onClick={load}>Làm mới</button>
      </div>
      {message && <p className={message.type === 'error' ? 'form-error' : 'form-success'} role="status">{message.text}</p>}
      {state.status === 'loading' && <LoadingState label="Đang tải hàng đợi duyệt..." />}
      {state.status === 'error' && <ErrorState error={state.error} onRetry={load} />}
      {state.status === 'success' && state.items.length === 0 && (
        <EmptyState title="Không có công thức nào">
          <p>Hàng đợi với trạng thái này đang trống.</p>
        </EmptyState>
      )}
      {state.status === 'success' && state.items.length > 0 && (
        <div className="review-list">
          {state.items.map((recipe) => (
            <article className="review-item" key={recipe.id}>
              <div className="review-item-media">
                {recipe.coverImage?.secureUrl
                  ? <img src={optimizedImageUrl(recipe.coverImage.secureUrl, { width: 240, height: 160 })} alt={`Ảnh món ${recipe.title}`} loading="lazy" width="240" height="160" />
                  : <div className="recipe-card-placeholder" aria-hidden="true">{recipe.title.slice(0, 1)}</div>}
              </div>
              <div className="review-item-body">
                <div className="review-item-heading">
                  <div>
                    <span className={`status-badge status-${recipe.status.toLowerCase()}`}>{STATUS_LABELS[recipe.status] || recipe.status}</span>
                    <h2><Link to={`/cong-thuc/${recipe.slug}`}>{recipe.title}</Link></h2>
                    <p>@{recipe.author?.username} · {recipe.category?.name || 'Chưa phân loại'} · cập nhật {formatDate(recipe.updatedAt)}</p>
                    <p className="review-item-stats">{recipe.ingredients?.length || 0} nguyên liệu · {recipe.steps?.length || 0} bước · {recipe.cooksnapCount || 0} ảnh đã nấu</p>
                    {recipe.reviewNote && <p className="review-note">Ghi chú trước đó: {recipe.reviewNote}</p>}
                  </div>
                  {recipe.status === 'PUBLISHED' && (
                    <button className="secondary-button" type="button" disabled={workingId === recipe.id} onClick={() => toggleFeatured(recipe)}>
                      {recipe.featuredAt ? 'Bỏ nổi bật' : 'Gắn nổi bật'}
                    </button>
                  )}
                </div>
                {['PENDING_REVIEW', 'REJECTED', 'DRAFT'].includes(recipe.status) && (
                  <div className="review-actions">
                    <label>
                      Ghi chú cho tác giả
                      <textarea rows="2" maxLength="1000" value={notes[recipe.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [recipe.id]: event.target.value }))} placeholder="Bắt buộc khi từ chối hoặc yêu cầu chỉnh sửa." />
                    </label>
                    <div className="review-action-buttons">
                      <button className="primary-button" type="button" disabled={workingId === recipe.id} onClick={() => act(recipe, 'APPROVE')}>Duyệt & xuất bản</button>
                      <button className="secondary-button" type="button" disabled={workingId === recipe.id} onClick={() => act(recipe, 'REQUEST_CHANGES')}>Yêu cầu chỉnh sửa</button>
                      <button className="danger-button" type="button" disabled={workingId === recipe.id} onClick={() => act(recipe, 'REJECT')}>Từ chối</button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {state.meta && <p className="pagination-info">Trang {state.meta.page}/{state.meta.totalPages || 1} · {state.meta.total} công thức</p>}
    </div>
  );
}

function TaxonomyManager({ accessToken }) {
  const [state, setState] = useState({ status: 'loading', categories: [], tags: [], error: null });
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [tagForm, setTagForm] = useState({ name: '' });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const [categories, tags] = await Promise.all([taxonomyApi.categories(), taxonomyApi.tags()]);
      setState({ status: 'success', categories, tags, error: null });
    } catch (error) {
      setState({ status: 'error', categories: [], tags: [], error });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (action, successText) => {
    setWorking(true);
    setMessage(null);
    try {
      await action();
      setMessage({ type: 'success', text: successText });
      await load();
      return true;
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      return false;
    } finally {
      setWorking(false);
    }
  };

  const createCategory = async (event) => {
    event.preventDefault();
    const ok = await run(() => taxonomyApi.createCategory(categoryForm, accessToken), 'Đã tạo danh mục.');
    if (ok) setCategoryForm({ name: '', description: '' });
  };

  const createTag = async (event) => {
    event.preventDefault();
    const ok = await run(() => taxonomyApi.createTag(tagForm, accessToken), 'Đã tạo tag.');
    if (ok) setTagForm({ name: '' });
  };

  const renameCategory = (category) => {
    const name = window.prompt('Tên danh mục mới', category.name);
    if (!name) return;
    run(() => taxonomyApi.updateCategory(category.id, { name }, accessToken), 'Đã cập nhật danh mục.');
  };

  const renameTag = (tag) => {
    const name = window.prompt('Tên tag mới', tag.name);
    if (!name) return;
    run(() => taxonomyApi.updateTag(tag.id, { name }, accessToken), 'Đã cập nhật tag.');
  };

  const removeCategory = (category) => {
    if (!window.confirm(`Xóa danh mục "${category.name}"? Công thức liên quan sẽ chuyển về chưa phân loại.`)) return;
    run(() => taxonomyApi.deleteCategory(category.id, accessToken), 'Đã xóa danh mục.');
  };

  const removeTag = (tag) => {
    if (!window.confirm(`Xóa tag "${tag.name}"? Tag sẽ được gỡ khỏi mọi công thức.`)) return;
    run(() => taxonomyApi.deleteTag(tag.id, accessToken), 'Đã xóa tag.');
  };

  const totalRecipes = useMemo(() => state.categories.reduce((sum, category) => sum + (category._count?.recipes || 0), 0), [state.categories]);

  if (state.status === 'loading') return <LoadingState label="Đang tải danh mục..." />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={load} />;

  return (
    <div className="editor-panel taxonomy-panel">
      {message && <p className={message.type === 'error' ? 'form-error' : 'form-success'} role="status">{message.text}</p>}
      <section>
        <h2>Danh mục <span className="count-badge">{state.categories.length}</span></h2>
        <p className="field-hint">{totalRecipes} công thức đang được phân loại theo danh mục.</p>
        <form className="inline-form" onSubmit={createCategory}>
          <label>Tên danh mục<input required minLength="2" maxLength="100" value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} /></label>
          <label>Mô tả<input maxLength="500" value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} /></label>
          <button className="primary-button" type="submit" disabled={working}>Thêm danh mục</button>
        </form>
        {state.categories.length ? (
          <ul className="taxonomy-list">
            {state.categories.map((category) => (
              <li key={category.id}>
                <div><strong>{category.name}</strong><small>/{category.slug} · {category._count?.recipes || 0} công thức</small></div>
                <div className="taxonomy-actions">
                  <button className="text-button" type="button" disabled={working} onClick={() => renameCategory(category)}>Đổi tên</button>
                  <button className="icon-button" type="button" aria-label={`Xóa danh mục ${category.name}`} disabled={working} onClick={() => removeCategory(category)}>×</button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p>Chưa có danh mục.</p>}
      </section>

      <section>
        <h2>Tag <span className="count-badge">{state.tags.length}</span></h2>
        <form className="inline-form" onSubmit={createTag}>
          <label>Tên tag<input required minLength="2" maxLength="100" value={tagForm.name} onChange={(event) => setTagForm({ name: event.target.value })} /></label>
          <button className="primary-button" type="submit" disabled={working}>Thêm tag</button>
        </form>
        {state.tags.length ? (
          <ul className="taxonomy-list">
            {state.tags.map((tag) => (
              <li key={tag.id}>
                <div><strong>{tag.name}</strong><small>/{tag.slug} · {tag._count?.recipes || 0} công thức</small></div>
                <div className="taxonomy-actions">
                  <button className="text-button" type="button" disabled={working} onClick={() => renameTag(tag)}>Đổi tên</button>
                  <button className="icon-button" type="button" aria-label={`Xóa tag ${tag.name}`} disabled={working} onClick={() => removeTag(tag)}>×</button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p>Chưa có tag.</p>}
      </section>
    </div>
  );
}
