import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="page-section" aria-labelledby="not-found-title">
      <p className="eyebrow">404</p>
      <h1 id="not-found-title">Không tìm thấy trang</h1>
      <p className="lead">Đường dẫn bạn truy cập không tồn tại hoặc nội dung đã được gỡ.</p>
      <Link className="primary-button button-link" to="/">Về trang chủ</Link>
    </section>
  );
}
