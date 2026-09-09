import { useState, useEffect, useRef } from "react";
import { Bell, ChevronDown, X, Sun, Moon, BellRing, BellOff, WifiOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { api, type AppNotification } from "@/lib/api";
import { useTheme } from "@/contexts/ThemeContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";

interface TopBarProps {
  title: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  return `منذ ${Math.floor(hrs / 24)} يوم`;
}

function typeIcon(type: string): string {
  if (type === "new_order") return "🛒";
  if (type === "low_stock") return "⚠️";
  return "🔔";
}

function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  const unreadCount = notifs.filter((n) => !n.read).length;

  const loadNotifs = async () => {
    try {
      const data = await api.user.notifications.list();
      setNotifs(data);
    } catch {}
  };

  useEffect(() => {
    loadNotifs();
    // Fallback polling — Realtime يتولى التحديث الفوري
    const timer = setInterval(loadNotifs, 60_000);
    return () => clearInterval(timer);
  }, []);

  // ─── Supabase Realtime ────────────────────────────────────────────────────────────────────
  // عند INSERT في notifications → أعد جلب الإشعارات فوراً (بدل انتظار 30 ثانية)
  useEffect(() => {
    if (!supabase) return;

    const notifChannel = supabase
      .channel("notifications:realtime")
      .on("postgres_changes" as any, {
        event: "INSERT",
        schema: "public",
        table: "notifications",
      }, () => {
        loadNotifs();
      })
      .subscribe();

    return () => { if (supabase) supabase.removeChannel(notifChannel); };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeAndClear();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifs]);

  const closeAndClear = async () => {
    setOpen(false);
    if (notifs.length > 0) {
      setNotifs([]);
      try {
        await api.user.notifications.removeAll();
      } catch {}
    }
  };

  const handleToggle = async () => {
    if (open) {
      await closeAndClear();
    } else {
      setOpen(true);
      setLoading(true);
      await loadNotifs();
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await api.user.notifications.markAllRead();
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  const removeOne = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.user.notifications.remove(id);
      setNotifs((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  };

  const handleClick = async (n: AppNotification) => {
    if (n.link) navigate(n.link);
    await closeAndClear();
  };

  return (
    <div ref={panelRef} className="relative shrink-0">
      <button
        onClick={handleToggle}
        className="relative w-9 h-9 shrink-0 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        title="الإشعارات"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-destructive text-[10px] font-bold text-white rounded-full flex items-center justify-center px-0.5 leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-11 end-0 w-80 max-h-[440px] bg-card border border-border rounded-2xl shadow-xl z-50 flex flex-col overflow-hidden"
          dir="rtl"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">الإشعارات</span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount} جديد
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] text-primary hover:text-primary/80 transition-colors"
                >
                  تحديد الكل مقروء
                </button>
              )}
              <button
                onClick={closeAndClear}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {loading && notifs.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">
                جاري التحميل...
              </div>
            )}
            {!loading && notifs.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <Bell className="w-9 h-9 mx-auto mb-2 opacity-20" />
                <p className="text-sm font-medium">لا توجد إشعارات</p>
                <p className="text-xs mt-0.5 opacity-70">ستظهر هنا الطلبات الجديدة وتنبيهات المخزون</p>
              </div>
            )}
            {notifs.map((n) => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  "group flex items-start gap-3 px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-muted/40 transition-colors",
                  !n.read && "bg-primary/5 hover:bg-primary/10",
                )}
              >
                <span className="text-lg shrink-0 mt-0.5">{typeIcon(n.type)}</span>
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm leading-snug",
                      !n.read ? "font-semibold text-foreground" : "text-foreground/80",
                    )}
                  >
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                    {n.body}
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                <button
                  onClick={(e) => removeOne(n.id, e)}
                  className="shrink-0 w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors mt-0.5 opacity-0 group-hover:opacity-100"
                  title="حذف"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      title={theme === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

function PushButton() {
  const { status, subscribe, unsubscribe } = usePushNotifications();

  if (status === "unsupported" || status === "denied") return null;

  const handleClick = async () => {
    if (status === "granted") await unsubscribe();
    else await subscribe();
  };

  const isGranted = status === "granted";
  const isLoading = status === "loading";

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-lg transition-colors ${
        isGranted
          ? "text-primary bg-primary/10 hover:bg-primary/20"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
      title={isGranted ? "تعطيل إشعارات الجوال" : "تفعيل إشعارات الجوال"}
    >
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : isGranted ? (
        <BellRing className="w-4 h-4" />
      ) : (
        <BellOff className="w-4 h-4" />
      )}
    </button>
  );
}

export default function TopBar({ title }: TopBarProps) {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    let offlineTimer: ReturnType<typeof setTimeout> | null = null;

    const handleOnline = () => {
      if (offlineTimer) {
        clearTimeout(offlineTimer);
        offlineTimer = null;
      }
      setIsOnline(true);
    };

    const handleOffline = () => {
      // تجنب الذبذبة اللحظية في شبكات الجوال عند تبديل الأبراج أو ضعف الإشارة المؤقت (Debounce لمدة 2.5 ثانية)
      // تظهر الشارة فقط إذا انقطع النت فعلياً واستمر الانقطاع
      if (offlineTimer) clearTimeout(offlineTimer);
      offlineTimer = setTimeout(() => {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setIsOnline(false);
        }
      }, 2500);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      if (offlineTimer) clearTimeout(offlineTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleOfflineBadgeClick = async () => {
    // التحقق المباشر من الاتصال الفعلي بالسيرفر عند النقر
    try {
      const res = await fetch("/manifest.json", { method: "HEAD", cache: "no-store" });
      if (res.ok) {
        setIsOnline(true);
        toast({
          title: "تم استعادة الاتصال بنجاح ✅",
          description: "أنت متصل بالإنترنت والتطبيق يعمل بكامل كفاءته.",
        });
        return;
      }
    } catch {}

    toast({
      title: "أنت في وضع عدم الاتصال 📡",
      description: "الإنترنت غير متصل حالياً. يمكنك تصفح البيانات المحفوظة، وسيعاد الاتصال تلقائياً فور عودة الشبكة.",
    });
  };

  return (
    <header className="relative h-14 max-h-14 bg-card border-b border-border flex items-center justify-between px-3 sm:px-4 md:px-6 sticky top-0 z-20 shrink-0 select-none">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 me-2">
        <h1 className="font-bold text-foreground text-sm sm:text-base md:text-lg truncate leading-none">
          {title}
        </h1>
        {!isOnline && (
          <>
            {/* شارة للشاشات المتوسطة والكبيرة */}
            <button
              type="button"
              onClick={handleOfflineBadgeClick}
              data-testid="badge-offline"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap shrink-0 hover:bg-amber-500/20 transition-all cursor-pointer shadow-sm active:scale-95"
              title="اضغط للتفاصيل — وضع عدم الاتصال"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <WifiOff className="w-3.5 h-3.5" />
              <span>غير متصل بالإنترنت</span>
            </button>

            {/* شارة أنيقة ومضغوطة جداً للجوال لا تكسر التقسيم أو الارتفاع أبداً */}
            <button
              type="button"
              onClick={handleOfflineBadgeClick}
              data-testid="badge-offline-mobile"
              className="sm:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0 whitespace-nowrap hover:bg-amber-500/25 transition-all cursor-pointer active:scale-95 shadow-xs"
              title="أنت في وضع عدم الاتصال (اضغط للتفاصيل)"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
              </span>
              <WifiOff className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              <span>أوفلاين</span>
            </button>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <ThemeToggle />
        <PushButton />
        <NotificationPanel />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="btn-user-menu"
              className="flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2 py-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
            >
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
                {user?.avatar}
              </div>
              <span className="hidden sm:block text-sm font-medium text-foreground max-w-[100px] truncate">{user?.name}</span>
              <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuItem
              onClick={logout}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              تسجيل الخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* خط إشعاعي رفيع أسفل الهيدر يعطي لمسة جمالية وفيدباك بصري دون أي تأثير على الارتفاع */}
      {!isOnline && (
        <div
          className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent animate-pulse pointer-events-none"
          aria-hidden="true"
        />
      )}
    </header>
  );
}
