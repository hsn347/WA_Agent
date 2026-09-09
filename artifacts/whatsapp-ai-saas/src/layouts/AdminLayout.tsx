import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import MobileNav from "./MobileNav";
import { useLocation } from "wouter";

function getAdminTitle(path: string): string {
  if (path === "/admin/keys") return "إدارة المفاتيح";
  if (path.startsWith("/admin/keys/")) return "تفاصيل المفتاح";
  if (path === "/admin/users") return "إدارة المستخدمين";
  if (path.startsWith("/admin/users/")) return "تفاصيل المستخدم";
  if (path === "/admin/admins") return "إدارة المسؤولين";
  if (path === "/admin/settings") return "إعدادات النظام";
  return "لوحة الإدارة";
}

interface AdminLayoutProps {
  children: React.ReactNode;
  overrideTitle?: string;
  noPadding?: boolean;
}

export default function AdminLayout({ children, overrideTitle, noPadding }: AdminLayoutProps) {
  const [location] = useLocation();
  const title = overrideTitle ?? getAdminTitle(location);
  const isFullCanvas = !!noPadding;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background select-text">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar title={title} />
        <main
          className={
            isFullCanvas
              ? "flex-1 overflow-hidden"
              : "flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pb-24 md:pb-6 scroll-smooth"
          }
        >
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

