import { Icon } from '../../components/Icon.jsx';

export function LoadingState({ label = 'Đang tải...' }) {
  return (
    <div className="route-state" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function SkeletonGrid({ count = 6, className = 'recipe-grid' }) {
  return (
    <div className={`${className} skeleton-grid`} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-card" key={index}>
          <div className="skeleton-block skeleton-image" />
          <div className="skeleton-body">
            <div className="skeleton-block skeleton-line skeleton-line-sm" />
            <div className="skeleton-block skeleton-line" />
            <div className="skeleton-block skeleton-line skeleton-line-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title = 'Chưa có công thức', icon = 'utc', children }) {
  return (
    <div className="empty-state">
      <span className="state-icon" aria-hidden="true"><Icon name={icon} size={26} /></span>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const forbidden = error?.status === 403;
  // 400/422 mean the URL itself is malformed, so retrying cannot help.
  const badLink = error?.status === 400 || error?.status === 404 || error?.status === 422;
  // Server messages are written for API consumers; only surface them for unexpected failures.
  const serverMessage = error?.message && (!error?.status || error.status >= 500) ? error.message : null;
  return (
    <div className="error-state" role="alert">
      <span className="state-icon state-icon-error" aria-hidden="true">
        <Icon name={forbidden ? 'lock' : 'alert'} size={26} />
      </span>
      <h2>{forbidden ? 'Bạn không có quyền truy cập' : badLink ? 'Không tìm thấy nội dung' : 'Không thể tải dữ liệu'}</h2>
      <p>
        {forbidden
          ? 'Trang này chỉ dành cho tài khoản có quyền phù hợp. Hãy quay lại hoặc đăng nhập bằng tài khoản khác.'
          : badLink
            ? 'Đường dẫn không đúng hoặc nội dung đã được gỡ.'
            : serverMessage || 'Đã có lỗi xảy ra. Vui lòng thử lại sau ít phút.'}
      </p>
      {onRetry && !forbidden && !badLink && <button className="secondary-button" type="button" onClick={onRetry}>Thử lại</button>}
    </div>
  );
}

export function NotFoundState() {
  return (
    <div className="empty-state">
      <p className="eyebrow">404</p>
      <h1>Không tìm thấy công thức</h1>
      <p>Công thức có thể đã được ẩn, xóa hoặc đường dẫn không đúng.</p>
    </div>
  );
}
