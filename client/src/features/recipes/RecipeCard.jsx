import { Link } from 'react-router-dom';
import { optimizedImageUrl } from '../../utils/image.js';
import { Icon } from '../../components/Icon.jsx';

const DIFFICULTY_LABELS = { EASY: 'Dễ làm', MEDIUM: 'Trung bình', HARD: 'Nâng cao' };

export function RecipeCard({ recipe }) {
  const coverUrl = optimizedImageUrl(recipe.coverImage?.secureUrl, { width: 640, height: 480 });
  const href = `/cong-thuc/${recipe.slug}`;
  const time = recipe.totalTimeMinutes ? `${recipe.totalTimeMinutes} phút` : 'Linh hoạt';
  const difficulty = DIFFICULTY_LABELS[recipe.difficulty] || 'Dễ làm';

  return (
    <article className="recipe-card">
      <Link className="recipe-card-media" to={href} tabIndex={-1} aria-hidden="true">
        {coverUrl ? (
          <img
            className="recipe-card-image"
            src={coverUrl}
            alt={`Ảnh món ${recipe.title}`}
            loading="lazy"
            width="640"
            height="480"
          />
        ) : (
          <span className="recipe-card-image recipe-card-placeholder">
            <Icon name="chef" size={34} />
            <span>{recipe.category?.name || recipe.title?.slice(0, 1) || 'Món ngon'}</span>
          </span>
        )}
        {recipe.featured && (
          <span className="recipe-card-badge"><Icon name="star" size={13} />Nổi bật</span>
        )}
      </Link>

      <div className="recipe-card-body">
        <p className="recipe-category">{recipe.category?.name || 'Công thức nhà làm'}</p>
        <h2><Link to={href}>{recipe.title}</Link></h2>
        <p className="recipe-card-desc">{recipe.description || 'Một công thức dễ làm cho bữa cơm gia đình.'}</p>
        <div className="recipe-card-meta">
          <span><Icon name="clock" size={15} />{time}</span>
          <span><Icon name="flame" size={15} />{difficulty}</span>
        </div>
        <div className="recipe-card-social">
          <span><Icon name="bookmark" size={15} />{recipe.saveCount ?? 0} lượt lưu</span>
          <span><Icon name="image" size={15} />{recipe.cookSnapCount ?? 0} ảnh đã nấu</span>
        </div>
      </div>
    </article>
  );
}
