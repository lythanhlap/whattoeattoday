import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { EmptyState, ErrorState, LoadingState } from '../features/recipes/RecipeStates.jsx';
import { editorialApi, taxonomyApi } from '../services/apiClient.js';
import { useDocumentMeta } from '../lib/useDocumentMeta.js';

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
    description: 'Duyệt công thức cộng đồng và quản lý danh mục, tag.',
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
      <h1>Duyệt công thức & quản lý danh mục</h1>
      <div className="tab-list" role="tablist" aria-label="Khu vực biên tập">
        <button className={tab === 'review' ? 'tab-button active' : 'tab-button'} type="button" role="tab" aria-selected={tab === 'review'} onClick={() => setTab('review')}>Duyệt công thức</button>
        <button className={tab === 'taxonomy' ? 'tab-button active' : 'tab-button'} type="button" role="tab" aria-selected={tab === 'taxonomy'} onClick={() => setTab('taxonomy')}>Danh mục & tag</button>
      </div>
      {tab === 'review' ? <ReviewQueue accessToken={accessToken} /> : <TaxonomyManager accessToken={accessToken} />}
    </section>
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
                  ? <img src={recipe.coverImage.secureUrl} alt={`Ảnh món ${recipe.title}`} loading="lazy" width="240" height="160" />
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
