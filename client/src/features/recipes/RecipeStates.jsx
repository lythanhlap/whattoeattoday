export function LoadingState({ label = 'Đang tải...' }) {
  return <div className="route-state" role="status">{label}</div>;
}

export function EmptyState({ title = 'Chưa có công thức', children }) {
  return <div className="empty-state"><h2>{title}</h2>{children}</div>;
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="error-state" role="alert">
      <h2>Không thể tải dữ liệu</h2>
      <p>{error?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.'}</p>
      {onRetry && <button className="secondary-button" type="button" onClick={onRetry}>Thử lại</button>}
    </div>
  );
}

export function NotFoundState() {
  return <div className="empty-state"><p className="eyebrow">404</p><h1>Không tìm thấy công thức</h1><p>Công thức có thể đã được ẩn, xóa hoặc đường dẫn không đúng.</p></div>;
}
