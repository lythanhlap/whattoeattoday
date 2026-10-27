import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout.jsx';
import { HomePage } from '../pages/HomePage.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { RegisterPage } from '../pages/RegisterPage.jsx';
import { AccountPage } from '../pages/AccountPage.jsx';
import { ProtectedRoute } from '../features/auth/ProtectedRoute.jsx';
import { RecipesPage } from '../pages/RecipesPage.jsx';
import { RecipeDetailPage } from '../pages/RecipeDetailPage.jsx';
import { RecipeFormPage } from '../pages/RecipeFormPage.jsx';
import { CollectionPage } from '../pages/CollectionPage.jsx';
import { ModerationPage } from '../pages/ModerationPage.jsx';
import { AdminPage } from '../pages/AdminPage.jsx';
import { FeedPage } from '../pages/FeedPage.jsx';
import { ProfilePage } from '../pages/ProfilePage.jsx';
import { NotificationsPage } from '../pages/NotificationsPage.jsx';
import { ChallengesPage } from '../pages/ChallengesPage.jsx';
import { ChallengeDetailPage } from '../pages/ChallengeDetailPage.jsx';
import { EditorPage } from '../pages/EditorPage.jsx';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/cong-thuc" element={<RecipesPage />} />
        <Route path="/cong-thuc/:slug" element={<RecipeDetailPage />} />
        <Route path="/bo-suu-tap/:id" element={<CollectionPage />} />
        <Route path="/thu-thach" element={<ChallengesPage />} />
        <Route path="/thu-thach/:id" element={<ChallengeDetailPage />} />
        <Route path="/nguoi-dung/:username" element={<ProfilePage />} />
        <Route path="/dang-nhap" element={<LoginPage />} />
        <Route path="/dang-ky" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/tai-khoan" element={<AccountPage />} />
          <Route path="/cong-thuc-moi" element={<RecipeFormPage mode="create" />} />
          <Route path="/cong-thuc/:slug/chinh-sua" element={<RecipeFormPage mode="edit" />} />
          <Route path="/moderation" element={<ModerationPage />} />
          <Route path="/bien-tap" element={<EditorPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/thong-bao" element={<NotificationsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
