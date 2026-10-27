import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { recipeApi, taxonomyApi } from '../services/apiClient.js';
import { RecipeForm } from '../features/recipes/RecipeForm.jsx';
import { ErrorState, LoadingState, NotFoundState } from '../features/recipes/RecipeStates.jsx';

export function RecipeFormPage({ mode }) {
  const editing = mode === 'edit'; const { slug } = useParams(); const { accessToken } = useAuth(); const navigate = useNavigate();
  const [state, setState] = useState({ status: editing ? 'loading' : 'ready', recipe: null, error: null, submitting: false, categories: [], tags: [] });
  const load = useCallback(async () => { if (!editing) return; try { const result = await recipeApi.getBySlug(slug, accessToken); setState((current) => ({ ...current, status: 'ready', recipe: result.recipe })); } catch (error) { setState({ status: error.code === 'RECIPE_NOT_FOUND' ? 'not-found' : 'error', recipe: null, error, submitting: false }); } }, [accessToken, editing, slug]);
  useEffect(() => { load(); taxonomyApi.categories().then((categories) => setState((current) => ({ ...current, categories }))).catch(() => {}); taxonomyApi.tags().then((tags) => setState((current) => ({ ...current, tags }))).catch(() => {}); }, [load]);
  if (state.status === 'loading') return <LoadingState label="Đang tải bản nháp..." />;
  if (state.status === 'not-found') return <NotFoundState />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={load} />;
  const save = async (input, shouldPublish) => { setState((current) => ({ ...current, submitting: true, error: null })); try { const result = editing ? await recipeApi.update(state.recipe.id, input, accessToken) : await recipeApi.create(input, accessToken); const published = shouldPublish ? await recipeApi.publish(result.recipe.id, accessToken) : result; navigate(`/cong-thuc/${published.recipe.slug}`, { replace: true }); } catch (error) { setState((current) => ({ ...current, submitting: false, error })); } };
  return <section className="form-page"><Link className="back-link" to="/cong-thuc">← Tất cả công thức</Link><p className="eyebrow">{editing ? 'Chỉnh sửa' : 'Đóng góp'}</p><h1>{editing ? 'Hoàn thiện công thức' : 'Viết công thức mới'}</h1><p className="lead">Lưu bản nháp bất cứ lúc nào. Khi đủ ảnh, nguyên liệu và bước làm, bạn có thể gửi công thức để duyệt.</p><RecipeForm recipe={state.recipe} categories={state.categories} tags={state.tags} isSubmitting={state.submitting} serverError={state.error} onSubmit={save} accessToken={accessToken} /></section>;
}
