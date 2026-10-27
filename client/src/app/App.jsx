import { AppRoutes } from '../routes/AppRoutes.jsx';
import { AuthProvider } from '../features/auth/AuthContext.jsx';

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
