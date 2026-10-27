import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthFormMessage } from '../features/auth/AuthFormMessage.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';

export function LoginPage() {
  const { isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/tai-khoan" replace />;

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [event.target.name]: '' }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = {};
    if (!form.identifier.trim()) errors.identifier = 'Nhập email hoặc username.';
    if (!form.password) errors.password = 'Nhập mật khẩu.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await signIn(form);
      navigate(location.state?.from || '/tai-khoan', { replace: true });
    } catch (error) {
      setSubmitError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-page" aria-labelledby="login-title">
      <div className="auth-intro">
        <p className="eyebrow">Chào mừng trở lại</p>
        <h1 id="login-title">Đăng nhập vào căn bếp của bạn</h1>
        <p className="lead">Lưu lại những món muốn nấu và tiếp tục chia sẻ cảm hứng từ căn bếp nhà mình.</p>
      </div>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-heading">
          <h2>Đăng nhập</h2>
          <p>Nhập thông tin tài khoản của bạn.</p>
        </div>
        <label>
          Email hoặc username
          <input name="identifier" value={form.identifier} onChange={updateField} autoComplete="username" />
          {fieldErrors.identifier && <span className="field-error">{fieldErrors.identifier}</span>}
        </label>
        <label>
          Mật khẩu
          <input name="password" type="password" value={form.password} onChange={updateField} autoComplete="current-password" />
          {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
        </label>
        <AuthFormMessage error={submitError} />
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
        <p className="form-footer">Chưa có tài khoản? <Link to="/dang-ky">Đăng ký ngay</Link></p>
      </form>
    </section>
  );
}
