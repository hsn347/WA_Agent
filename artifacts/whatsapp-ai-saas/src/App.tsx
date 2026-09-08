import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ConfirmProvider } from "@/contexts/ConfirmContext";
import { useAuth } from "@/hooks/useAuth";
import { Component, type ReactNode } from "react";

import AdminLayout from "@/layouts/AdminLayout";
import UserLayout from "@/layouts/UserLayout";

import Login from "@/pages/Login";
import KeysPage from "@/pages/admin/KeysPage";
import UsersPage from "@/pages/admin/UsersPage";
import UserDetailPage from "@/pages/admin/UserDetailPage";
import KeyDetailPage from "@/pages/admin/KeyDetailPage";
import AdminSettingsPage from "@/pages/admin/AdminSettingsPage";
import AdminsPage from "@/pages/admin/AdminsPage";
import DashboardPage from "@/pages/user/DashboardPage";
import ConversationsPage from "@/pages/user/ConversationsPage";
import ProductsPage from "@/pages/user/ProductsPage";
import CouponsPage from "@/pages/user/CouponsPage";
import BusinessPage from "@/pages/user/BusinessPage";
import KnowledgePage from "@/pages/user/KnowledgePage";
import BroadcastPage from "@/pages/user/BroadcastPage";
import DeliveryPage from "@/pages/user/DeliveryPage";
import OrdersPage from "@/pages/user/OrdersPage";
import CustomersPage from "@/pages/user/CustomersPage";
import SettingsPage from "@/pages/user/SettingsPage";
import AnalyticsPage from "@/pages/user/AnalyticsPage";
import ReturnsPage from "@/pages/user/ReturnsPage";

// ── Error Boundary: catches any rendering crash gracefully ────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
          <div className="text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-xl font-bold text-foreground">حدث خطأ في الصفحة</h2>
            <p className="text-muted-foreground text-sm">{this.state.error?.message}</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,       // 24 ساعة في الذاكرة لتجربة فورية كواتساب
      staleTime: 1000 * 60 * 5,          // 5 دقائق — لا إعادة تحميل عند التنقل بين الصفحات في نفس الجلسة
      refetchOnWindowFocus: false,       // تجنب الومضات عند التبديل بين النوافذ أو التطبيقات
      refetchOnMount: false,             // استخدام البيانات المحفوظة فوراً بدون انتظار
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes("401")) return false;
        return failureCount < 2;
      },
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  throttleTime: 1000,
});

// الاحتفاظ ببيانات الكاش لمدة 24 ساعة كاملة لتسريع الدخول
const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24;

function getEffectiveUser(user: any): any {
  if (user) return user;
  if (typeof window === "undefined") return null;

  // إذا قام المستخدم بالضغط الصريح على "تسجيل الخروج"، فقط حينها يُسمح بظهور صفحة الدخول
  if (localStorage.getItem("auth_explicit_logout") === "true") {
    return null;
  }

  // 1. فحص كاش المستخدم الأساسي
  try {
    const raw = localStorage.getItem("auth_user_cache");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.id) return parsed;
    }
  } catch {}

  // 2. سلوك واتساب: إذا لم يقم بتسجيل الخروج الصريح، وكان الجهاز غير متصل بالنت أو توجد جلسة سابقة:
  const hasPersistent = localStorage.getItem("auth_persistent_session") === "true";
  const hasCreds = !!localStorage.getItem("auth_credentials_cache");
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  if (hasPersistent || hasCreds || isOffline) {
    const role = (localStorage.getItem("auth_account_role") as "admin" | "user") || "user";
    const recovered = {
      id: role === "admin" ? 1 : 2,
      name: localStorage.getItem("auth_user_name") || (role === "admin" ? "مدير النظام" : "المستخدم"),
      email: localStorage.getItem("auth_user_email") || (role === "admin" ? "admin@demo.com" : "user@demo.com"),
      role,
      avatar: role === "admin" ? "A" : "U",
    };
    try {
      localStorage.setItem("auth_user_cache", JSON.stringify(recovered));
    } catch {}
    return recovered;
  }

  return null;
}

function ProtectedRoute({ children, requireAdmin = false }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  const effectiveUser = getEffectiveUser(user);

  if (isLoading && !effectiveUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground font-medium animate-pulse">جاري التحميل...</p>
      </div>
    );
  }

  if (!effectiveUser) {
    return <Redirect to="/login" />;
  }

  if (requireAdmin && effectiveUser.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

  if (!requireAdmin && effectiveUser.role === "admin" && location === "/dashboard") {
    return <Redirect to="/admin/keys" />;
  }

  return <>{children}</>;
}

function AdminApp() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/admin/keys/:id" component={KeyDetailPage} />
        <Route path="/admin/keys" component={KeysPage} />
        <Route path="/admin/users/:id" component={UserDetailPage} />
        <Route path="/admin/users" component={UsersPage} />
        <Route path="/admin/admins" component={AdminsPage} />
        <Route path="/admin/settings" component={AdminSettingsPage} />
        <Route>
          <Redirect to="/admin/keys" />
        </Route>
      </Switch>
    </AdminLayout>
  );
}

function UserApp() {
  return (
    <UserLayout>
      <Switch>
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/conversations" component={ConversationsPage} />
        <Route path="/products" component={ProductsPage} />
        <Route path="/coupons" component={CouponsPage} />
        <Route path="/business" component={BusinessPage} />
        <Route path="/knowledge" component={KnowledgePage} />
        <Route path="/broadcast" component={BroadcastPage} />
        <Route path="/delivery" component={DeliveryPage} />
        <Route path="/orders" component={OrdersPage} />
        <Route path="/returns" component={ReturnsPage} />
        <Route path="/customers" component={CustomersPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route>
          <Redirect to="/dashboard" />
        </Route>
      </Switch>
    </UserLayout>
  );
}

function AppRoutes() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  const effectiveUser = getEffectiveUser(user);

  if (isLoading && !effectiveUser) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // إذا كان المستخدم مسجلاً أو في وضع الأوفلاين، يُحظر تماماً الوصول لصفحة الدخول ويتم تحويله فوراً إلى لوحة التحكم
  if (location === "/login") {
    if (effectiveUser) {
      return <Redirect to={effectiveUser.role === "admin" ? "/admin/keys" : "/dashboard"} />;
    }
    return <Login />;
  }

  if (!effectiveUser) {
    return <Redirect to="/login" />;
  }

  if (effectiveUser.role === "admin") {
    return (
      <ProtectedRoute requireAdmin>
        <AdminApp />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <UserApp />
    </ProtectedRoute>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: PERSIST_MAX_AGE }}>
          <TooltipProvider>
            <ConfirmProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <AuthProvider>
                  <AppRoutes />
                </AuthProvider>
              </WouterRouter>
              <Toaster />
            </ConfirmProvider>
          </TooltipProvider>
        </PersistQueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
