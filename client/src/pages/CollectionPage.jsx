import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { communityApi } from '../services/apiClient.js';
import { EmptyState, ErrorState, LoadingState, NotFoundState } from '../features/recipes/RecipeStates.jsx';
import { RecipeCard } from '../features/recipes/RecipeCard.jsx';

export function CollectionPage() {
  const { id } = useParams(); const { accessToken } = useAuth();
  const [state, setState] = useState({ status: 'loading', collection: null, error: null });
  const load = useCallback(async () => { setState({ status: 'loading', collection: null, error: null }); try { const result = await communityApi.getCollection(id, accessToken); setState({ status: 'success', collection: result.collection, error: null }); } catch (error) { setState({ status: error.code === 'COLLECTION_NOT_FOUND' ? 'not-found' : 'error', collection: null, error }); } }, [accessToken, id]);
  useEffect(() => { load(); }, [load]);
  if (state.status === 'loading') return <LoadingState label="Đang tải bộ sưu tập..." />;
  if (state.status === 'not-found') return <NotFoundState />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={load} />;
  const { collection } = state;
  return <section className="collection-page"><Link className="back-link" to="/tai-khoan">← Kho cá nhân</Link><p className="eyebrow">Bộ sưu tập {collection.visibility === 'PUBLIC' ? 'công khai' : 'riêng tư'}</p><h1>{collection.name}</h1><p className="lead">{collection.description || `Các món ăn được lưu bởi ${collection.owner?.profile?.displayName || collection.owner?.username}.`}</p>{collection.bookmarks.length ? <div className="recipe-grid">{collection.bookmarks.map((bookmark) => <RecipeCard key={`${bookmark.userId}-${bookmark.recipeId}`} recipe={bookmark.recipe} />)}</div> : <EmptyState title="Bộ sưu tập chưa có recipe"><p>Hãy lưu một công thức vào bộ sưu tập này.</p></EmptyState>}</section>;
}
