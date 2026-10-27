import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="page-section" aria-labelledby="not-found-title">
      <p className="eyebrow">404</p>
      <h1 id="not-found-title">Khong tim thay trang</h1>
      <p className="lead">Duong dan ban truy cap khong ton tai.</p>
      <Link className="button-link" to="/">Ve trang chu</Link>
    </section>
  );
}
