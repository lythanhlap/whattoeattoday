import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthFormMessage } from '../features/auth/AuthFormMessage.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';

const initialForm = { email: '', username: '', password: '', displayName: '' };

export function RegisterPage() {
  const { isAuthenticated, signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/tai-khoan" replace />;

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [event.target.name]: '' }));
  }

  function validate() {
    const errors = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Nhập email hợp lệ.';
    if (!/^[a-z0-9_]{3,30}$/.test(form.username.trim().toLowerCase())) errors.username = 'Dùng 3-30 ký tự: chữ thường, số hoặc dấu gạch dưới.';
    if (form.password.length < 8) errors.password = 'Mật khẩu cần ít nhất 8 ký tự.';
    if (!form.displayName.trim()) errors.displayName = 'Nhập tên hiển thị.';
    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await signUp({ ...form, email: form.email.trim(), username: form.username.trim().toLowerCase(), displayName: form.displayName.trim() });
      navigate('/tai-khoan', { replace: true });
    } catch (error) {
      setSubmitError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-page" aria-labelledby="register-title">
      <div className="auth-intro">
        <p className="eyebrow">Cùng vào bếp</p>
        <h1 id="register-title">Tạo góc nhỏ cho những món ngon</h1>
        <p className="lead">Tham gia cộng đồng, lưu công thức yêu thích và chia sẻ món ăn do chính bạn thực hiện.</p>
      </div>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-heading">
          <h2>Tạo tài khoản</h2>
          <p>Chỉ mất một phút để bắt đầu.</p>
        </div>
        <label>
          Tên hiển thị
          <input name="displayName" value={form.displayName} onChange={updateField} autoComplete="name" />
          {fieldErrors.displayName && <span className="field-error">{fieldErrors.displayName}</span>}
        </label>
        <label>
          Username
          <input name="username" value={form.username} onChange={updateField} autoComplete="username" />
          {fieldErrors.username && <span className="field-error">{fieldErrors.username}</span>}
        </label>
        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" />
          {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
        </label>
        <label>
          Mật khẩu
          <input name="password" type="password" value={form.password} onChange={updateField} autoComplete="new-password" />
          {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
        </label>
        <AuthFormMessage error={submitError} />
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
        </button>
        <p className="form-footer">Đã có tài khoản? <Link to="/dang-nhap">Đăng nhập</Link></p>
      </form>
    </section>
  );
}
