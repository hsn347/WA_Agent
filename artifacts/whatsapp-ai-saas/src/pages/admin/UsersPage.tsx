import { useState, useEffect } from "react";
import {
  Plus, Edit2, Trash2, Users, UserCheck, Clock, Wifi, WifiOff,
  AlertCircle, TriangleAlert, Search, Mail, Phone, Calendar, ChevronLeft, Sparkles, Check
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { api, type AdminUser, type ApiKey } from "@/lib/api";
import { WA_PROVIDERS } from "@/lib/waProviders";
import { ProviderSelector } from "@/components/WhatsAppProviderConfig";
import { useToast } from "@/hooks/use-toast";

export function getSubscriptionInfo(expiresAt?: string | null) {
  if (!expiresAt) {
    return {
      status: "none" as const,
      label: "غير محدد",
      daysLeft: null,
      badgeCls: "bg-muted text-muted-foreground border-border",
    };
  }
  const exp = new Date(expiresAt).getTime();
  const now = Date.now();
  const diffMs = exp - now;
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (days <= 0) {
    return {
      status: "expired" as const,
      label: "منتهي الصلاحية",
      daysLeft: 0,
      badgeCls: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",
    };
  }
  if (days <= 3) {
    return {
      status: "expiring_soon" as const,
      label: `ينتهي خلال ${days} ${days === 1 ? "يوم" : "أيام"}`,
      daysLeft: days,
      badgeCls: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/20",
    };
  }
  return {
    status: "active" as const,
    label: `نشط (متبقي ${days} يوم)`,
    daysLeft: days,
    badgeCls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  };
}

export function formatArabicDate(dateStr?: string | null) {
  if (!dateStr) return "غير محدد (مفتوح)";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "غير محدد (مفتوح)";
    return d.toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "غير محدد (مفتوح)";
  }
}

const statusConfig = {
  active:   { label: "نشط",   className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20" },
  pending:  { label: "معلق",  className: "bg-amber-500/15 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20" },
  disabled: { label: "موقوف", className: "bg-red-500/15 text-red-600 hover:bg-red-500/20" },
};

const waStatusConfig = {
  connected:    { label: "متصل",      Icon: Wifi,         cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  disconnected: { label: "غير متصل", Icon: WifiOff,      cls: "text-amber-600 dark:text-amber-300 bg-amber-500/10 border-amber-500/20" },
  error:        { label: "خطأ",       Icon: AlertCircle,  cls: "text-red-500 bg-red-500/10 border-red-500/20" },
  idle:         { label: "لم يُعد",   Icon: WifiOff,      cls: "text-muted-foreground bg-muted/40 border-border" },
};

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [subscriptionTarget, setSubscriptionTarget] = useState<AdminUser | null>(null);
  const [customExpiryDate, setCustomExpiryDate] = useState("");
  const [extending, setExtending] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", password: "", phone: "",
    chatKeyId: "", embeddingKeyId: "",
    waProvider: "evolution",
    subscriptionMonths: 1,
  });
  const [waConfig, setWaConfig] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const openSubscriptionModal = (user: AdminUser) => {
    setSubscriptionTarget(user);
    if (user.subscriptionExpiresAt) {
      try {
        const d = new Date(user.subscriptionExpiresAt);
        setCustomExpiryDate(d.toISOString().slice(0, 10));
      } catch {
        setCustomExpiryDate("");
      }
    } else {
      const defaultDate = new Date();
      defaultDate.setMonth(defaultDate.getMonth() + 1);
      setCustomExpiryDate(defaultDate.toISOString().slice(0, 10));
    }
  };

  const handleExtendSubscription = async (userId: number, months: number) => {
    setExtending(true);
    try {
      const res = await api.users.extendSubscription(userId, months);
      const newDateStr = res.subscriptionExpiresAt
        ? new Date(res.subscriptionExpiresAt).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })
        : "";
      toast({
        title: "تم تمديد الاشتراك بنجاح ✓",
        description: `تمت إضافة ${months === 1 ? "شهر كامل" : months === 12 ? "سنة كاملة" : `${months} أشهر`}، تاريخ الانتهاء الجديد: ${newDateStr}`,
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, subscriptionExpiresAt: res.subscriptionExpiresAt } : u));
      setSubscriptionTarget(null);
    } catch (err: unknown) {
      toast({
        title: "خطأ في التمديد",
        description: err instanceof Error ? err.message : "فشل تمديد الاشتراك",
        variant: "destructive",
      });
    } finally {
      setExtending(false);
    }
  };

  const handleSetExactDate = async (userId: number, dateStr: string | null) => {
    setExtending(true);
    try {
      let isoDate: string | null = null;
      if (dateStr) {
        const d = new Date(dateStr);
        d.setHours(23, 59, 59, 999);
        isoDate = d.toISOString();
      }
      const res = await api.users.setSubscription(userId, isoDate);
      const newDateFormatted = isoDate
        ? new Date(isoDate).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })
        : "غير مقيد (مفتوح)";
      toast({
        title: "تم تحديث تاريخ الاشتراك بنجاح ✓",
        description: `تاريخ الانتهاء الجديد: ${newDateFormatted}`,
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, subscriptionExpiresAt: res.subscriptionExpiresAt } : u));
      setSubscriptionTarget(null);
    } catch (err: unknown) {
      toast({
        title: "خطأ في تعيين التاريخ",
        description: err instanceof Error ? err.message : "فشل تعيين تاريخ الاشتراك",
        variant: "destructive",
      });
    } finally {
      setExtending(false);
    }
  };

  const load = async () => {
    try {
      const [u, k] = await Promise.all([api.users.list(), api.keys.list()]);
      setUsers(u);
      setApiKeys(k);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const chatKeys = apiKeys.filter(k => k.type === "chat" && k.status === "active");
  const embeddingKeys = apiKeys.filter(k => k.type === "embedding" && k.status === "active");

  const filteredUsers = users.filter(u =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.phone && u.phone.includes(search))
  );

  const activeUsers = users.filter(u => u.status === "active").length;
  const pendingUsers = users.filter(u => u.status === "pending").length;
  const connectedWa = users.filter(u => u.waStatus === "connected").length;

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) return;
    setSaving(true);
    try {
      const created = await api.users.create({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        chatKeyId: form.chatKeyId ? Number(form.chatKeyId) : undefined,
        embeddingKeyId: form.embeddingKeyId ? Number(form.embeddingKeyId) : undefined,
        waProvider: form.waProvider,
        waConfig: Object.keys(waConfig).length > 0 ? waConfig : undefined,
        subscriptionMonths: form.subscriptionMonths,
      });
      setUsers(prev => [...prev, created]);
      setForm({ name: "", email: "", password: "", phone: "", chatKeyId: "", embeddingKeyId: "", waProvider: "evolution", subscriptionMonths: 1 });
      setWaConfig({});
      setShowModal(false);
      setStep(1);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.users.delete(deleteTarget.id);
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast({ title: "تم الحذف", description: `تم حذف المستخدم "${deleteTarget.name}" وجميع بياناته بنجاح` });
    } catch {
      toast({ title: "خطأ", description: "فشل حذف المستخدم، حاول مجدداً", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6" dir="rtl">
      {/* ── Top Stats Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4">
        {[
          { label: "إجمالي المستخدمين",  value: users.length, icon: Users,     color: "text-primary", bg: "bg-primary/10" },
          { label: "المستخدمون النشطون", value: activeUsers,  icon: UserCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "في انتظار الإعداد",  value: pendingUsers, icon: Clock,     color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "واتساب متصل",        value: connectedWa,  icon: Wifi,      color: "text-blue-500", bg: "bg-blue-500/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border border-card-border rounded-xl p-3 sm:p-4 shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] sm:text-xs text-muted-foreground font-medium truncate">{label}</span>
              <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-3.5 h-3.5 ${color}`} />
              </div>
            </div>
            <p className="text-lg sm:text-xl font-bold text-foreground">{loading ? "..." : value}</p>
          </div>
        ))}
      </div>

      {/* ── Main Card Container ── */}
      <div className="bg-card border border-card-border rounded-2xl shadow-xs overflow-hidden">
        {/* Header & Controls */}
        <div className="p-3.5 sm:p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-foreground text-sm sm:text-base">قائمة المستخدمين</h2>
            <button
              data-testid="btn-add-user"
              onClick={() => {
                setShowModal(true);
                setStep(1);
                setWaConfig({});
                setForm({ name: "", email: "", password: "", phone: "", chatKeyId: "", embeddingKeyId: "", waProvider: "evolution" });
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مستخدم</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="البحث بالاسم أو البريد أو رقم الهاتف..."
              className="w-full h-10 pr-9 pl-3 rounded-xl border border-input bg-background text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* ── Mobile Native Cards View (md:hidden) ── */}
        <div className="md:hidden divide-y divide-border">
          {loading && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <span className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
              <p>جاري التحميل...</p>
            </div>
          )}
          {!loading && filteredUsers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm font-medium">لا يوجد مستخدمون مطابقون</p>
            </div>
          )}
          {!loading && filteredUsers.map(user => {
            const waKey = (user.waStatus ?? "idle") as keyof typeof waStatusConfig;
            const wa = waStatusConfig[waKey] ?? waStatusConfig.idle;
            const WaIcon = wa.Icon;
            const sub = getSubscriptionInfo(user.subscriptionExpiresAt);

            return (
              <div
                key={user.id}
                onClick={() => setLocation(`/admin/users/${user.id}`)}
                className="p-3.5 space-y-3 hover:bg-muted/30 active:bg-muted/50 transition-colors cursor-pointer"
              >
                {/* Top Row: Avatar + Name + Status & Subscription Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                      {user.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground text-sm truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span>{user.email}</span>
                      </p>
                      {user.phone && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span dir="ltr">{user.phone}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge className={`text-[10px] ${statusConfig[user.status as keyof typeof statusConfig]?.className}`}>
                      {statusConfig[user.status as keyof typeof statusConfig]?.label}
                    </Badge>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${sub.badgeCls}`}>
                      <Clock className="w-2.5 h-2.5" />
                      <span>{sub.label}</span>
                    </span>
                  </div>
                </div>

                {/* Subscription Row in Mobile Card */}
                <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-muted-foreground block font-medium">تاريخ انتهاء الاشتراك:</span>
                      <span className="font-bold text-foreground truncate block">
                        {user.subscriptionExpiresAt ? (
                          formatArabicDate(user.subscriptionExpiresAt)
                        ) : (
                          <span className="text-muted-foreground font-normal">غير محدد (مفتوح)</span>
                        )}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid={`btn-extend-user-${user.id}`}
                    onClick={(e) => { e.stopPropagation(); openSubscriptionModal(user); }}
                    className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shrink-0 hover:bg-primary/90 active:scale-95 shadow-xs transition-all"
                  >
                    تمديد / ضبط
                  </button>
                </div>

                {/* Info row: Chat key + WhatsApp status */}
                <div className="grid grid-cols-2 gap-2 bg-muted/20 p-2.5 rounded-xl border border-border/50 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">نموذج الشات:</span>
                    <span className="font-medium text-foreground truncate block">{user.chatKeyName ?? "بدون"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block">واتساب (Evolution):</span>
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold mt-0.5 ${wa.cls}`}>
                      <WaIcon className="w-3 h-3" />
                      <span>{wa.label}</span>
                    </div>
                  </div>
                </div>

                {/* Actions footer */}
                <div className="flex items-center gap-2 pt-0.5" onClick={e => e.stopPropagation()}>
                  <button
                    data-testid={`btn-edit-user-${user.id}`}
                    onClick={() => setLocation(`/admin/users/${user.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted active:scale-95 transition-all shadow-2xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>عرض التفاصيل</span>
                  </button>
                  <button
                    data-testid={`btn-delete-user-${user.id}`}
                    onClick={() => setDeleteTarget(user)}
                    className="flex items-center justify-center w-9 h-9 rounded-xl border border-red-500/20 bg-red-500/10 text-red-600 hover:bg-red-500/20 active:scale-95 transition-all shrink-0"
                    title="حذف المستخدم"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Desktop Table (hidden md:block) ── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold">المستخدم</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold">الحالة</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold">الاشتراك</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold hidden md:table-cell">نموذج الشات</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold hidden lg:table-cell">مزود واتساب</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold">واتساب</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold hidden md:table-cell">تاريخ الإنشاء</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-semibold">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">جاري التحميل...</td></tr>}
              {!loading && filteredUsers.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">لا يوجد مستخدمون بعد</td></tr>}
              {filteredUsers.map((user, i) => {
                const waKey = (user.waStatus ?? "idle") as keyof typeof waStatusConfig;
                const wa = waStatusConfig[waKey] ?? waStatusConfig.idle;
                const WaIcon = wa.Icon;
                const prov = WA_PROVIDERS.find(p => p.id === (user.waProvider ?? "evolution"));
                const sub = getSubscriptionInfo(user.subscriptionExpiresAt);
                return (
                  <tr key={user.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                    onClick={() => setLocation(`/admin/users/${user.id}`)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-[10px] ${statusConfig[user.status as keyof typeof statusConfig]?.className}`}>
                        {statusConfig[user.status as keyof typeof statusConfig]?.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${sub.badgeCls}`}>
                          <Clock className="w-3 h-3" />
                          <span>{sub.label}</span>
                        </span>
                        <p className="text-xs text-foreground font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span>
                            {user.subscriptionExpiresAt ? (
                              <>ينتهي: <strong className="text-primary font-bold">{formatArabicDate(user.subscriptionExpiresAt)}</strong></>
                            ) : (
                              <span className="text-muted-foreground">تاريخ الانتهاء: غير محدد</span>
                            )}
                          </span>
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">{user.chatKeyName ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs font-medium text-muted-foreground">
                        {prov ? `${prov.logo} ${prov.name}` : (user.waProvider ?? "evolution")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${wa.cls}`}>
                        <WaIcon className="w-3.5 h-3.5" />
                        <span>{wa.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString("ar")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          data-testid={`btn-desktop-extend-${user.id}`}
                          onClick={() => openSubscriptionModal(user)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all active:scale-95 shadow-2xs"
                          title="تمديد أو ضبط تاريخ الاشتراك"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>تمديد الاشتراك</span>
                        </button>
                        <button data-testid={`btn-edit-user-${user.id}`} onClick={() => setLocation(`/admin/users/${user.id}`)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="عرض تفاصيل المستخدم">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button data-testid={`btn-delete-user-${user.id}`}
                          onClick={() => setDeleteTarget(user)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-600 transition-colors"
                          title="حذف">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Delete confirmation dialog ────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open && !deleting) setDeleteTarget(null); }}>
        <DialogContent className="w-[94vw] sm:max-w-sm rounded-2xl p-5 sm:p-6" dir="rtl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                <TriangleAlert className="w-5 h-5 text-red-600" />
              </div>
              <DialogTitle className="text-base">حذف المستخدم</DialogTitle>
            </div>
          </DialogHeader>

          {deleteTarget && (
            <div className="space-y-3.5 py-1">
              {/* User card */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                  {deleteTarget.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-foreground truncate">{deleteTarget.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{deleteTarget.email}</p>
                </div>
              </div>

              {/* Warning list */}
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1.5">سيتم حذف البيانات التالية نهائياً:</p>
                {[
                  "المحادثات والرسائل",
                  "الطلبات والعملاء",
                  "المنتجات والكوبونات",
                  "إعدادات واتساب والوكيل",
                ].map(item => (
                  <div key={item} className="flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground text-center">لا يمكن التراجع عن هذا الإجراء</p>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2 flex flex-col-reverse sm:flex-row">
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted text-xs sm:text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs"
            >
              {deleting ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />جاري الحذف...</>
              ) : (
                <><Trash2 className="w-4 h-4" />حذف نهائياً</>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add user dialog ───────────────────────────────────────── */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">إضافة مستخدم جديد</DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 my-2 sm:my-3">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s}</div>
                <span className={`text-xs hidden sm:block ${step >= s ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {s === 1 ? "البيانات الأساسية" : s === 2 ? "اختيار النماذج" : "واتساب"}
                </span>
                {s < 3 && <div className={`h-0.5 w-8 ${step > s ? "bg-primary" : "bg-muted"} hidden sm:block`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Basic info */}
          {step === 1 && (
            <div className="space-y-3.5">
              {[
                { label: "الاسم الكامل", field: "name", placeholder: "محمد العمري", type: "text" },
                { label: "البريد الإلكتروني", field: "email", placeholder: "user@store.sa", type: "email" },
                { label: "كلمة المرور", field: "password", placeholder: "••••••••", type: "password" },
                { label: "رقم الهاتف (اختياري)", field: "phone", placeholder: "+966501234567", type: "text" },
              ].map(({ label, field, placeholder, type }) => (
                <div key={field}>
                  <label className="block text-xs font-semibold mb-1.5">{label}</label>
                  <input
                    data-testid={`input-user-${field}`}
                    type={type}
                    value={form[field as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold mb-1.5">فترة الاشتراك الأولية</label>
                <select
                  value={form.subscriptionMonths}
                  onChange={e => setForm(p => ({ ...p, subscriptionMonths: Number(e.target.value) }))}
                  className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value={1}>شهر واحد (30 يوماً - الافتراضي)</option>
                  <option value={3}>3 أشهر (90 يوماً)</option>
                  <option value={6}>6 أشهر (نصف سنة)</option>
                  <option value={12}>سنة كاملة (12 شهراً)</option>
                  <option value={0}>بدون انتهاء (اشتراك مفتوح)</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2: AI keys */}
          {step === 2 && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1.5">نموذج الشات (Chat)</label>
                <select
                  data-testid="select-user-chatKeyId"
                  value={form.chatKeyId}
                  onChange={e => setForm(p => ({ ...p, chatKeyId: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">بدون (اختياري)</option>
                  {chatKeys.map(k => <option key={k.id} value={k.id}>{k.name} — {k.model}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5">نموذج التضمين (Embedding)</label>
                <select
                  data-testid="select-user-embeddingKeyId"
                  value={form.embeddingKeyId}
                  onChange={e => setForm(p => ({ ...p, embeddingKeyId: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">بدون (اختياري)</option>
                  {embeddingKeys.map(k => <option key={k.id} value={k.id}>{k.name} — {k.model}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Step 3: WhatsApp provider config */}
          {step === 3 && (
            <div className="space-y-4 max-h-[55vh] overflow-y-auto pe-1">
              <ProviderSelector />

              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-violet-500/20 bg-violet-500/10 text-sm">
                <span className="text-base">⚡</span>
                <div>
                  <p className="font-semibold text-xs text-violet-600 dark:text-violet-400">Evolution API — ربط عبر QR Code</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    بعد إنشاء المستخدم، ادخل على صفحته واضغط على تبويب «ربط واتساب» لإدخال بيانات الخادم ومسح الـ QR Code.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 mt-4 pt-2 border-t border-border flex flex-col-reverse sm:flex-row">
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted text-sm active:scale-95 transition-all"
              >
                السابق
              </button>
            )}
            <button
              onClick={() => setShowModal(false)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted text-sm active:scale-95 transition-all"
            >
              إلغاء
            </button>
            {step < 3 ? (
              <button
                data-testid="btn-next-step"
                onClick={() => setStep(s => s + 1)}
                disabled={step === 1 && (!form.name || !form.email || !form.password)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 active:scale-95 shadow-xs"
              >
                التالي
              </button>
            ) : (
              <button
                data-testid="btn-save-user"
                onClick={handleCreate}
                disabled={saving}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 active:scale-95 shadow-xs"
              >
                {saving ? "جاري الإنشاء..." : "إنشاء المستخدم"}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Subscription extension dialog ────────────────────────────── */}
      <Dialog open={!!subscriptionTarget} onOpenChange={open => { if (!open && !extending) setSubscriptionTarget(null); }}>
        <DialogContent className="w-[94vw] sm:max-w-md rounded-2xl p-4 sm:p-6" dir="rtl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold">إدارة وتمديد اشتراك المستخدم</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{subscriptionTarget?.name} ({subscriptionTarget?.email})</p>
              </div>
            </div>
          </DialogHeader>

          {subscriptionTarget && (() => {
            const sub = getSubscriptionInfo(subscriptionTarget.subscriptionExpiresAt);
            const expFormatted = formatArabicDate(subscriptionTarget.subscriptionExpiresAt);

            return (
              <div className="space-y-4 py-2">
                {/* Current Status Box */}
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">حالة الاشتراك الحالية:</span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${sub.badgeCls}`}>
                      {sub.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/50">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>تاريخ الانتهاء الحالي:</span>
                    </span>
                    <span className="font-bold text-foreground">{expFormatted}</span>
                  </div>
                </div>

                {/* Option 1: Quick Month Extensions */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground">الخيار 1: تمديد سريع بإضافة أشهر</p>
                    <span className="text-[10px] text-muted-foreground">يُضاف تلقائياً فوق الصلاحية</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { months: 1, label: "+ شهر كامل", desc: "إضافة 30 يوماً" },
                      { months: 3, label: "+ 3 أشهر", desc: "إضافة 90 يوماً" },
                      { months: 6, label: "+ 6 أشهر", desc: "إضافة 180 يوماً" },
                      { months: 12, label: "+ سنة كاملة", desc: "إضافة 365 يوماً" },
                    ].map(({ months, label, desc }) => (
                      <button
                        key={months}
                        type="button"
                        onClick={() => handleExtendSubscription(subscriptionTarget.id, months)}
                        disabled={extending}
                        className="p-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 text-right transition-all active:scale-95 disabled:opacity-50"
                      >
                        <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Option 2: Custom Date Picker */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground">الخيار 2: تحديد تاريخ انتهاء مخصص من التقويم</p>
                    <span className="text-[10px] text-muted-foreground">اختر يوماً محدداً</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customExpiryDate}
                      onChange={e => setCustomExpiryDate(e.target.value)}
                      disabled={extending}
                      className="flex-1 h-11 px-3 rounded-xl border border-input bg-background text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => handleSetExactDate(subscriptionTarget.id, customExpiryDate)}
                      disabled={extending || !customExpiryDate}
                      className="h-11 px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 shrink-0"
                    >
                      {extending ? "جاري الحفظ..." : "حفظ التاريخ"}
                    </button>
                  </div>
                </div>

                {/* Option 3: Reset to unlimited */}
                {subscriptionTarget.subscriptionExpiresAt && (
                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSetExactDate(subscriptionTarget.id, null)}
                      disabled={extending}
                      className="text-xs text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      إلغاء قيد الصلاحية (جعله مفتوح بدون تاريخ انتهاء)
                    </button>
                  </div>
                )}

                {extending && (
                  <div className="text-center py-2 text-xs text-primary font-medium flex items-center justify-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <span>جاري حفظ التغييرات وتحديث الصلاحية...</span>
                  </div>
                )}
              </div>
            );
          })()}

          <DialogFooter className="pt-1">
            <button
              onClick={() => setSubscriptionTarget(null)}
              disabled={extending}
              className="w-full h-11 rounded-xl border border-border text-muted-foreground hover:bg-muted text-xs sm:text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
            >
              إلغاء
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
