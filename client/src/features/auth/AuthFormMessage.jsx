export function AuthFormMessage({ error }) {
  if (!error) return null;

  if (error.code === 'VALIDATION_ERROR' && error.details) {
    return <p className="form-error" role="alert">Vui lòng kiểm tra lại thông tin đã nhập.</p>;
  }

  return <p className="form-error" role="alert">{error.message}</p>;
}
