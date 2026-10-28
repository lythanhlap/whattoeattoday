import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { recipeApi, taxonomyApi } from '../services/apiClient.js';
import { RecipeCard } from '../features/recipes/RecipeCard.jsx';
import { EmptyState, ErrorState, SkeletonGrid } from '../features/recipes/RecipeStates.jsx';
import { useDocumentMeta } from '../lib/useDocumentMeta.js';
import { Icon } from '../components/Icon.jsx';

const DIET_OPTIONS = [
  { value: 'mon-chay', label: 'Món chay' },
  { value: 'thuan-chay', label: 'Thuần chay' },
  { value: 'eat-clean', label: 'Eat clean' },
  { value: 'khong-gluten', label: 'Không gluten' },
  { value: 'khong-sua', label: 'Không sữa' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'popular', label: 'Được lưu nhiều' },
  { value: 'cooksnaps', label: 'Nhiều ảnh đã nấu' },
];

const SUGGESTION_ICONS = { RECIPE: 'utc', TAG: 'leaf', CATEGORY: 'book' };
const SUGGESTION_LABELS = { RECIPE: 'Công thức', TAG: 'Thẻ', CATEGORY: 'Danh mục' };

export function RecipesPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null });
  const [taxonomy, setTaxonomy] = useState({ categories: [], tags: [] });
  const [searchTerm, setSearchTerm] = useState(params.get('q') || '');
  const [suggestions, setSuggestions] = useState({ open: false, status: 'idle', items: [] });
  const [highlighted, setHighlighted] = useState(-1);
  const searchRef = useRef(null);

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

  useEffect(() => { setSearchTerm(query); }, [query]);

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

  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 2) {
      setSuggestions({ open: false, status: 'idle', items: [] });
      return undefined;
    }
    const controller = new AbortController();
    setSuggestions((current) => ({ ...current, status: 'loading' }));
    const timer = setTimeout(() => {
      recipeApi.suggestions(term, 6, { signal: controller.signal })
        .then((items) => {
          setSuggestions({ open: true, status: 'success', items });
          setHighlighted(-1);
        })
        .catch((error) => {
          if (error?.name !== 'AbortError') setSuggestions({ open: false, status: 'error', items: [] });
        });
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [searchTerm]);

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
    if (form.get('maxCookTime')) next.maxCookTime = form.get('maxCookTime');
    if (form.get('categoryId')) next.categoryId = form.get('categoryId');
    if (form.get('tag')) next.tags = form.get('tag');
    if (form.get('diet')) next.diet = form.get('diet');
    if (form.get('hasCooksnap')) next.hasCooksnap = 'true';
    if (sort !== 'newest') next.sort = sort;
    setSuggestions({ open: false, status: 'idle', items: [] });
    setParams(next);
  };

  const goToPage = (nextPage) => {
    const next = new URLSearchParams(params);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const changeSort = (value) => {
    const next = new URLSearchParams(params);
    if (value === 'newest') next.delete('sort');
    else next.set('sort', value);
    next.delete('page');
    setParams(next);
  };

  const removeFilter = (key) => {
    const next = new URLSearchParams(params);
    next.delete(key);
    next.delete('page');
    setParams(next);
  };

  const chooseSuggestion = (suggestion) => {
    setSuggestions({ open: false, status: 'idle', items: [] });
    if (suggestion.type === 'RECIPE') {
      navigate(`/cong-thuc/${suggestion.slug}`);
      return;
    }
    if (suggestion.type === 'TAG') {
      setParams({ tags: suggestion.slug });
      return;
    }
    const category = taxonomy.categories.find((item) => item.slug === suggestion.slug);
    if (category) setParams({ categoryId: category.id });
    else setParams({ q: suggestion.label });
  };

  const onSearchKeyDown = (event) => {
    if (!suggestions.open || suggestions.items.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((current) => (current + 1) % suggestions.items.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((current) => (current <= 0 ? suggestions.items.length - 1 : current - 1));
    } else if (event.key === 'Enter' && highlighted >= 0) {
      event.preventDefault();
      chooseSuggestion(suggestions.items[highlighted]);
    } else if (event.key === 'Escape') {
      setSuggestions((current) => ({ ...current, open: false }));
    }
  };

  const dietLabel = DIET_OPTIONS.find((option) => option.value === diet)?.label;
  const categoryLabel = taxonomy.categories.find((category) => category.id === categoryId)?.name;
  const tagLabel = taxonomy.tags.find((tag) => tag.slug === tags[0])?.name;
  const activeFilters = [
    query && { key: 'q', label: `“${query}”` },
    ingredient && { key: 'ingredient', label: `Nguyên liệu: ${ingredient}` },
    diet && { key: 'diet', label: dietLabel || diet },
    categoryId && { key: 'categoryId', label: categoryLabel || 'Danh mục' },
    tagQuery && { key: 'tags', label: tagLabel || tagQuery },
    maxCookTime && { key: 'maxCookTime', label: `Tối đa ${maxCookTime} phút` },
    hasCooksnap && { key: 'hasCooksnap', label: 'Có ảnh đã nấu' },
  ].filter(Boolean);

  const hasFilters = activeFilters.length > 0;
  const showSuggestions = suggestions.open && suggestions.items.length > 0;

  return (
    <section className="recipes-page">
      <div className="page-heading recipes-heading">
        <div>
          <p className="eyebrow">Khám phá</p>
          <h1>Công thức cho hôm nay</h1>
          <p className="lead">Tìm những món dễ nấu, rõ ràng và phù hợp với căn bếp của bạn.</p>
        </div>
        <Link className="primary-button button-link" to="/cong-thuc-moi">
          <Icon name="plus" size={17} />Viết công thức
        </Link>
      </div>

      <form className="search-bar search-filters" onSubmit={updateFilters} role="search">
        <div className="search-field">
          <Icon name="search" size={20} className="search-field-icon" />
          <input
            ref={searchRef}
            name="q"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onFocus={() => { if (suggestions.items.length) setSuggestions((current) => ({ ...current, open: true })); }}
            onBlur={() => setSuggestions((current) => ({ ...current, open: false }))}
            onKeyDown={onSearchKeyDown}
            placeholder="Tìm món ăn, nguyên liệu hoặc danh mục"
            aria-label="Tìm công thức"
            autoComplete="off"
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls="recipe-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={highlighted >= 0 ? `suggestion-${highlighted}` : undefined}
          />
          {suggestions.status === 'loading' && <span className="search-spinner" aria-hidden="true" />}
          {showSuggestions && (
            <div className="suggestions" id="recipe-suggestions" role="listbox" aria-label="Gợi ý tìm kiếm">
              {suggestions.items.map((suggestion, index) => (
                <button
                  key={`${suggestion.type}-${suggestion.slug}`}
                  id={`suggestion-${index}`}
                  className={`suggestion-item${index === highlighted ? ' is-highlighted' : ''}`}
                  type="button"
                  role="option"
                  aria-selected={index === highlighted}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => chooseSuggestion(suggestion)}
                >
                  <span className="suggestion-icon" aria-hidden="true"><Icon name={SUGGESTION_ICONS[suggestion.type] || 'search'} size={17} /></span>
                  <span className="suggestion-text">
                    <strong>{suggestion.label}</strong>
                    <small>{SUGGESTION_LABELS[suggestion.type] || 'Gợi ý'}</small>
                  </span>
                  <Icon name="arrow-right" size={15} className="suggestion-arrow" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="filter-grid">
          <label>
            <span>Nguyên liệu</span>
            <input name="ingredient" defaultValue={ingredient} placeholder="Ví dụ: thịt bò" />
          </label>
          <label>
            <span>Chế độ ăn</span>
            <select name="diet" defaultValue={diet}>
              <option value="">Mọi chế độ ăn</option>
              {DIET_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span>Danh mục</span>
            <select name="categoryId" defaultValue={categoryId}>
              <option value="">Mọi danh mục</option>
              {taxonomy.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label>
            <span>Thẻ</span>
            <select name="tag" defaultValue={tags[0] || ''}>
              <option value="">Mọi thẻ</option>
              {taxonomy.tags.map((tag) => <option key={tag.id} value={tag.slug}>{tag.name}</option>)}
            </select>
          </label>
          <label>
            <span>Thời gian nấu</span>
            <select name="maxCookTime" defaultValue={maxCookTime}>
              <option value="">Mọi thời gian</option>
              <option value="30">Tối đa 30 phút</option>
              <option value="60">Tối đa 60 phút</option>
              <option value="120">Tối đa 120 phút</option>
            </select>
          </label>
        </div>

        <div className="filter-actions">
          <label className="filter-check"><input name="hasCooksnap" type="checkbox" defaultChecked={hasCooksnap} /> Có ảnh đã nấu</label>
          <div className="filter-buttons">
            {hasFilters && <Link className="text-button" to="/cong-thuc">Xóa bộ lọc</Link>}
            <button className="primary-button" type="submit"><Icon name="filter" size={16} />Lọc công thức</button>
          </div>
        </div>
      </form>

      {hasFilters && (
        <div className="active-filters" aria-label="Bộ lọc đang áp dụng">
          <span>Đang lọc:</span>
          {activeFilters.map((filter) => (
            <button key={filter.key} className="active-filter" type="button" onClick={() => removeFilter(filter.key)}>
              {filter.label}<Icon name="close" size={14} />
              <span className="sr-only">Bỏ lọc</span>
            </button>
          ))}
          <Link className="text-button" to="/cong-thuc">Xóa tất cả</Link>
        </div>
      )}

      {state.status === 'success' && state.items.length > 0 && (
        <div className="results-heading">
          <p>
            <strong>{state.meta?.total ?? state.items.length}</strong> công thức
            {query && <> cho “{query}”</>}
          </p>
          <label className="sort-inline">
            <span>Sắp xếp</span>
            <select value={sort} onChange={(event) => changeSort(event.target.value)} aria-label="Sắp xếp kết quả">
              {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
      )}

      {state.status === 'loading' && <SkeletonGrid count={9} />}
      {state.status === 'error' && <ErrorState error={state.error} onRetry={load} />}
      {state.status === 'success' && state.items.length === 0 && (
        <EmptyState title="Không tìm thấy công thức phù hợp" icon="search">
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
            <button className="secondary-button" type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
              <Icon name="chevron-right" size={16} className="flip-x" />Trang trước
            </button>
            <span>Trang {state.meta?.page || page} / {state.meta?.totalPages || 1}</span>
            <button className="secondary-button" type="button" disabled={page >= (state.meta?.totalPages || 1)} onClick={() => goToPage(page + 1)}>
              Trang sau<Icon name="chevron-right" size={16} />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
