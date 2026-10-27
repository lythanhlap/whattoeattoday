import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { communityApi } from '../services/apiClient.js';
import { EmptyState, ErrorState, LoadingState } from '../features/recipes/RecipeStates.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { optimizedImageUrl } from '../utils/image.js';

export function FeedPage() {
  const { accessToken } = useAuth(); const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null }); const [page, setPage] = useState(1);
  const load = useCallback(async () => { setState((current) => ({ ...current, status: 'loading' })); try { const result = await communityApi.feed(page, accessToken); setState({ status: 'success', items: result.data, meta: result.meta, error: null }); } catch (error) { setState({ status: 'error', items: [], meta: null, error }); } }, [accessToken, page]);
  useEffect(() => { load(); }, [load]);
  if (state.status === 'loading') return <LoadingState label="Đang tải feed..." />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={load} />;
  return <section className="feed-page"><p className="eyebrow">{state.meta?.mode === 'DISCOVERY' ? 'Khám phá' : 'Cộng đồng'}</p><h1>{state.meta?.mode === 'DISCOVERY' ? 'Gợi ý từ cộng đồng' : 'Feed của bạn'}</h1>{state.items.length ? <div className="feed-list">{state.items.map((event) => event.type === 'COOKSNAP' ? <article key={`cooksnap-${event.cooksnap.id}`}><p className="recipe-category">Ảnh đã nấu</p><h2><Link to={`/cong-thuc/${event.cooksnap.recipe.slug}`}>{event.cooksnap.recipe.title}</Link></h2><img className="feed-cooksnap-image" src={optimizedImageUrl(event.cooksnap.imageUrl, { width: 800, height: 600 })} alt={`Món ${event.cooksnap.recipe.title} do ${event.cooksnap.author?.profile?.displayName || event.cooksnap.author?.username} thực hiện`} loading="lazy" width="800" height="600" /><p>{event.cooksnap.caption}</p><small>Bởi {event.cooksnap.author?.profile?.displayName || event.cooksnap.author?.username}</small></article> : <article key={`recipe-${event.recipe.id}`}><p className="recipe-category">{event.recipe.category?.name || 'Công thức'}</p><h2><Link to={`/cong-thuc/${event.recipe.slug}`}>{event.recipe.title}</Link></h2><p>{event.recipe.description}</p><small>Bởi {event.recipe.author?.profile?.displayName || event.recipe.author?.username}</small></article>)}</div> : <EmptyState title="Chưa có nội dung mới"><p>Hãy follow người dùng hoặc quay lại sau.</p></EmptyState>}<div className="pagination"><button className="secondary-button" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Trang trước</button><span>Trang {page} / {state.meta?.totalPages || 1}</span><button className="secondary-button" type="button" disabled={!state.meta || page >= state.meta.totalPages} onClick={() => setPage((current) => current + 1)}>Trang sau</button></div></section>;
}
