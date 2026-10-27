import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { recipeApi, taxonomyApi } from '../services/apiClient.js';
import { RecipeCard } from '../features/recipes/RecipeCard.jsx';
import { EmptyState, ErrorState, LoadingState } from '../features/recipes/RecipeStates.jsx';
import { useDocumentMeta } from '../lib/useDocumentMeta.js';

const DIET_OPTIONS = [
  { value: 'mon-chay', label: 'Món chay' },
  { value: 'thuan-chay', label: 'Thuần chay' },
  { value: 'eat-clean', label: 'Eat clean' },
  { value: 'khong-gluten', label: 'Không gluten' },
  { value: 'khong-sua', label: 'Không sữa' },
];

export function RecipesPage() {
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null });
  const [taxonomy, setTaxonomy] = useState({ categories: [], tags: [] });

  const query = params.get('q') || '';
  const ingredient = params.get('ingredient') || '';
  const sort = params.get('sort') || 'newest';
  const maxCookTime = params.get('maxCookTime') || '';
  const categoryId = params.get('categoryId') || '';
  const tagQuery = params.get('tags') || '';
  const tags = tagQuery ? tagQuery.split(',') : [];
  const diet = params.get('diet') || '';
  const hasCooksnap = params.get('hasCooksnap') === 'true';
  const page = Number(params.get('page') || 1);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const result = await recipeApi.list({ q: query, ingredient, sort, maxCookTime, categoryId, tags: tagQuery ? tagQuery.split(',') : [], hasCooksnap, diet, page });
      setState({ status: 'success', items: result.data, meta: result.meta, error: null });
    } catch (error) {
      setState({ status: 'error', items: [], meta: null, error });
    }
  }, [categoryId, diet, hasCooksnap, ingredient, maxCookTime, page, query, sort, tagQuery]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    Promise.all([taxonomyApi.categories(), taxonomyApi.tags()])
      .then(([categories, tagsResult]) => setTaxonomy({ categories, tags: tagsResult }))
      .catch(() => {});
  }, []);

  useDocumentMeta({
    title: 'Khám phá công thức nấu ăn | Bếp Nhà',
    description: 'Tìm công thức theo tên món, nguyên liệu, danh mục và chế độ ăn như món chay, eat clean, không gluten.',
    url: window.location.href,
  });

  const updateFilters = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = {};
    if (form.get('q')) next.q = form.get('q');
    if (form.get('ingredient')) next.ingredient = form.get('ingredient');
    if (form.get('sort') !== 'newest') next.sort = form.get('sort');
    if (form.get('maxCookTime')) next.maxCookTime = form.get('maxCookTime');
    if (form.get('categoryId')) next.categoryId = form.get('categoryId');
    if (form.get('tag')) next.tags = form.get('tag');
    if (form.get('diet')) next.diet = form.get('diet');
    if (form.get('hasCooksnap')) next.hasCooksnap = 'true';
    setParams(next);
  };

  const goToPage = (nextPage) => {
    const next = new URLSearchParams(params);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setParams(next);
  };

  const hasFilters = Boolean(query || ingredient || diet || categoryId || tagQuery || maxCookTime || hasCooksnap);

  return (
    <section className="recipes-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Khám phá</p>
          <h1>Công thức cho hôm nay</h1>
          <p className="lead">Tìm những món dễ nấu, rõ ràng và phù hợp với căn bếp của bạn.</p>
        </div>
        <Link className="primary-button button-link" to="/cong-thuc-moi">Viết công thức</Link>
      </div>

      <form className="search-bar search-filters" onSubmit={updateFilters}>
        <input name="q" defaultValue={query} placeholder="Tìm món ăn, tag hoặc danh mục" aria-label="Tìm công thức" />
        <input name="ingredient" defaultValue={ingredient} placeholder="Nguyên liệu có sẵn" aria-label="Tìm theo nguyên liệu" />
        <select name="diet" defaultValue={diet} aria-label="Chế độ ăn">
          <option value="">Mọi chế độ ăn</option>
          {DIET_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select name="sort" defaultValue={sort} aria-label="Sắp xếp">
          <option value="newest">Mới nhất</option>
          <option value="popular">Phổ biến</option>
          <option value="cooksnaps">Nhiều ảnh đã nấu</option>
        </select>
        <select name="maxCookTime" defaultValue={maxCookTime} aria-label="Thời gian nấu tối đa">
          <option value="">Mọi thời gian</option>
          <option value="30">Tối đa 30 phút</option>
          <option value="60">Tối đa 60 phút</option>
          <option value="120">Tối đa 120 phút</option>
        </select>
        <select name="categoryId" defaultValue={categoryId} aria-label="Danh mục">
          <option value="">Mọi danh mục</option>
          {taxonomy.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select name="tag" defaultValue={tags[0] || ''} aria-label="Tag">
          <option value="">Mọi tag</option>
          {taxonomy.tags.map((tag) => <option key={tag.id} value={tag.slug}>{tag.name}</option>)}
        </select>
        <label className="filter-check"><input name="hasCooksnap" type="checkbox" defaultChecked={hasCooksnap} /> Có ảnh đã nấu</label>
        <button className="secondary-button" type="submit">Lọc</button>
        {hasFilters && <Link className="text-button" to="/cong-thuc">Xóa bộ lọc</Link>}
      </form>

      {state.status === 'loading' && <LoadingState label="Đang tải công thức..." />}
      {state.status === 'error' && <ErrorState error={state.error} onRetry={load} />}
      {state.status === 'success' && state.items.length === 0 && (
        <EmptyState title="Không tìm thấy công thức phù hợp">
          <p>Thử từ khóa ngắn hơn, bỏ bớt bộ lọc hoặc khám phá danh mục khác.</p>
          <Link className="secondary-button button-link" to="/cong-thuc">Xóa bộ lọc</Link>
        </EmptyState>
      )}
      {state.status === 'success' && state.items.length > 0 && (
        <>
          <div className="recipe-grid">
            {state.items.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}
          </div>
          <div className="pagination" aria-label="Phân trang">
            <button className="secondary-button" type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}>Trang trước</button>
            <span>Trang {state.meta.page} / {state.meta.totalPages || 1} · {state.meta.total} công thức</span>
            <button className="secondary-button" type="button" disabled={page >= (state.meta.totalPages || 1)} onClick={() => goToPage(page + 1)}>Trang sau</button>
          </div>
        </>
      )}
    </section>
  );
}
