import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import {
  ArrowRight, Edit2, Save, MessageCircle,
  Activity, Clock, Shield, X,
  Mail, Phone, Calendar, RefreshCw,
  Sparkles, AlertTriangle, CheckCircle2, Plus
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import WhatsAppConnectionWizard from "@/components/WhatsAppConnectionWizard";
import { api, type AdminUser, type ApiKey } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { getSubscriptionInfo } from "./UsersPage";

const statusCfg: Record<string, { label: string; cls: string }> = {
  active:   { label: "نشط",    cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20" },
  pending:  { label: "معلق",   cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20" },
  disabled: { label: "موقوف", cls: "bg-red-500/15 text-red-600 hover:bg-red-500/20" },
};

const waCls: Record<string, string> = {
  connected:    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  disconnected: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20",
  error:        "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  idle:         "bg-muted text-muted-foreground border-border",
  not_found:    "bg-orange-50 text-orange-700 border-orange-200",
};

const waLabels: Record<string, string> = {
  connected: "متصل", disconnected: "غير متصل", error: "خطأ", idle: "لم يُعد", not_found: "غير موجود",
};

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const [user, setUser] = useState<AdminUser | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [editMode, setEditMode] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extendingMonths, setExtendingMonths] = useState<number | null>(null);
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    status: "active",
    chatKeyId: "",
    embeddingKeyId: "",
    chatFallbackKeyIds: [] as number[],
    subscriptionExpiresAt: "",
  });

  const load = async () => {
    const [u, k] = await Promise.all([api.users.get(Number(id)), api.keys.list()]);
    setUser(u);
    setApiKeys(k);
    let parsedFallbacks: number[] = [];
    try { parsedFallbacks = JSON.parse((u as any).chatFallbackKeyIds ?? "[]") as number[]; } catch { parsedFallbacks = []; }
    setForm({
      name: u.name,
      email: u.email,
      phone: u.phone ?? "",
      status: u.status,
      chatKeyId: u.chatKeyId ? String(u.chatKeyId) : "",
      embeddingKeyId: u.embeddingKeyId ? String(u.embeddingKeyId) : "",
      chatFallbackKeyIds: parsedFallbacks,
      subscriptionExpiresAt: u.subscriptionExpiresAt ?? "",
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground"><RefreshCw className="w-5 h-5 animate-spin me-2" />جاري التحميل…</div>;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-muted-foreground">المستخدم غير موجود</p>
        <button onClick={() => setLocation("/admin/users")} className="text-sm text-primary hover:underline">العودة للقائمة</button>
      </div>
    );
  }

  const waStatus = user.waStatus ?? "idle";
  const waCl = waCls[waStatus] ?? waCls.idle;
  const waLabel = waLabels[waStatus] ?? "لم يُعد";
  const subInfo = getSubscriptionInfo(user.subscriptionExpiresAt);

  const handleQuickExtend = async (months: number) => {
    if (!user) return;
    setExtendingMonths(months);
    try {
      const res = await api.users.extendSubscription(user.id, months);
      const newExpiry = res.subscriptionExpiresAt;
      setUser(u => u ? { ...u, subscriptionExpiresAt: newExpiry } : u);
      setForm(p => ({ ...p, subscriptionExpiresAt: newExpiry ?? "" }));
      const newDateStr = newExpiry
        ? new Date(newExpiry).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })
        : "";
      toast({
        title: "تم تمديد اشتراك البوت بنجاح ✓",
        description: `تمت إضافة ${months === 1 ? "شهر كامل" : months === 12 ? "سنة كاملة" : `${months} أشهر`}، الصلاحية الجديدة حتى ${newDateStr}`,
      });
    } catch (err: any) {
      toast({
        title: "فشل تمديد الاشتراك",
        description: err.message || "حدث خطأ أثناء الاتصال بالخادم",
        variant: "destructive",
      });
    } finally {
      setExtendingMonths(null);
    }
  };

  const handleResetSubscription = async () => {
    if (!user) return;
    if (!confirm("هل أنت متأكد من إلغاء قيد الصلاحية؟ سيصبح الاشتراك مفتوحاً وغير محدد التاريخ.")) return;
    setExtendingMonths(-1);
    try {
      await api.users.setSubscription(user.id, null);
      setUser(u => u ? { ...u, subscriptionExpiresAt: null } : u);
      setForm(p => ({ ...p, subscriptionExpiresAt: "" }));
      toast({
        title: "تم تحديث الاشتراك",
        description: "تم إلغاء قيد تاريخ الانتهاء وأصبح الاشتراك مفتوحاً.",
      });
    } catch (err: any) {
      toast({
        title: "خطأ",
        description: err.message || "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setExtendingMonths(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const newExpiresAt = form.subscriptionExpiresAt ? form.subscriptionExpiresAt : null;
    await api.users.update(Number(id), {
      name: form.name,
      phone: form.phone,
      status: form.status,
      chatKeyId: form.chatKeyId ? Number(form.chatKeyId) : null,
      embeddingKeyId: form.embeddingKeyId ? Number(form.embeddingKeyId) : null,
      chatFallbackKeyIds: form.chatFallbackKeyIds,
      subscriptionExpiresAt: newExpiresAt,
    });
    setUser(u => u ? {
      ...u,
      name: form.name,
      phone: form.phone,
      status: form.status,
      subscriptionExpiresAt: newExpiresAt,
    } : u);
    setSaved(true);
    setEditMode(false);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const chatKeys = apiKeys.filter(k => k.type === "chat" && k.status === "active");
  const embeddingKeys = apiKeys.filter(k => k.type === "embedding" && k.status === "active");

  const mockActivity = Array.from({ length: 7 }, (_, i) => ({
    date: `يوم ${i + 1}`,
    conversations: Math.floor(Math.random() * 30 + 5),
  }));

  const tabs = [
    { id: "overview", label: "نظرة عامة" },
    { id: "whatsapp", label: "🔗 ربط واتساب" },
    { id: "models",   label: "النماذج" },
    { id: "activity", label: "النشاط" },
  ];

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl pb-10" dir="rtl">
      {/* Back Button */}
      <button
        data-testid="btn-back-users"
        onClick={() => setLocation("/admin/users")}
        className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-xl hover:bg-muted transition-colors active:scale-95"
      >
        <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        <span>العودة لقائمة المستخدمين</span>
      </button>

      {/* User Header Card */}
      <div className="bg-card border border-card-border rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Avatar & Basic Info */}
          <div className="flex items-center gap-3.5 sm:items-start">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-xl sm:text-2xl font-bold text-primary shrink-0 shadow-inner">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0 sm:hidden">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground truncate">{user.name}</h2>
                {saved && <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">تم الحفظ ✓</Badge>}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge className={`text-[10px] px-2 py-0.5 ${statusCfg[user.status]?.cls}`}>
                  {statusCfg[user.status]?.label}
                </Badge>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${waCl}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${waStatus === "connected" ? "bg-emerald-500" : waStatus === "disconnected" ? "bg-amber-500" : "bg-muted-foreground"}`} />
                  {waLabel}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${subInfo.badgeCls}`}>
                  <Sparkles className="w-2.5 h-2.5" />
                  {subInfo.label}
                </span>
              </div>
            </div>
          </div>

          {/* Desktop & Tablet Details */}
          <div className="flex-1 min-w-0">
            <div className="hidden sm:flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground">{user.name}</h2>
                  {saved && <Badge className="text-xs bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">تم الحفظ ✓</Badge>}
                </div>
                <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                  <Badge className={`text-xs ${statusCfg[user.status]?.cls}`}>{statusCfg[user.status]?.label}</Badge>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${waCl}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${waStatus === "connected" ? "bg-emerald-500" : waStatus === "disconnected" ? "bg-amber-500" : "bg-muted-foreground"}`} />
                    {waLabel}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${subInfo.badgeCls}`}>
                    <Sparkles className="w-3 h-3" />
                    {subInfo.label}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    منذ {new Date(user.createdAt).toLocaleDateString("ar")}
                  </span>
                </div>
              </div>

              {/* Desktop Edit Button */}
              <div className="flex items-center gap-2">
                {!editMode ? (
                  <button
                    data-testid="btn-edit-user-detail"
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-all active:scale-95"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>تعديل</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setEditMode(false)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-all active:scale-95"
                    >
                      <X className="w-4 h-4" />
                      <span>إلغاء</span>
                    </button>
                    <button
                      data-testid="btn-save-user-detail"
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{saving ? "…" : "حفظ"}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Contact Pills for Both Mobile & Desktop */}
            <div className="flex items-center gap-2 sm:gap-4 mt-2 sm:mt-2.5 flex-wrap text-xs sm:text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded-lg truncate max-w-full">
                <Mail className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
                <span className="truncate dir-ltr text-right">{user.email}</span>
              </span>
              {user.phone && (
                <span className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded-lg">
                  <Phone className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
                  <span className="dir-ltr">{user.phone}</span>
                </span>
              )}
              <span className="sm:hidden flex items-center gap-1.5 text-[11px] text-muted-foreground/80 py-0.5">
                <Calendar className="w-3 h-3 shrink-0" />
                منذ {new Date(user.createdAt).toLocaleDateString("ar")}
              </span>
            </div>

            {/* Mobile Action Buttons */}
            <div className="sm:hidden flex items-center gap-2 mt-3.5 pt-3 border-t border-border">
              {!editMode ? (
                <button
                  data-testid="btn-edit-user-detail-mobile"
                  onClick={() => setEditMode(true)}
                  className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl border border-border text-xs font-semibold hover:bg-muted transition-all active:scale-95"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>تعديل البيانات</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setEditMode(false)}
                    className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-all active:scale-95"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>إلغاء</span>
                  </button>
                  <button
                    data-testid="btn-save-user-detail-mobile"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? "جاري الحفظ…" : "حفظ"}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mt-4 pt-4 border-t border-border">
          {[
            { label: "المحادثات الكلية", value: (user.conversations ?? 0).toLocaleString("ar"), icon: MessageCircle, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "نموذج الشات", value: user.chatKeyName ?? "—", icon: Activity, color: "text-purple-500", bg: "bg-purple-500/10" },
            { label: "نموذج التضمين", value: user.embeddingKeyName ?? "—", icon: Shield, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: "آخر دخول", value: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString("ar") : "—", icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-muted/30 rounded-xl p-2.5 sm:p-3 text-center transition-all hover:bg-muted/50">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mx-auto mb-1.5`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="font-bold text-foreground text-xs sm:text-sm truncate">{value}</p>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Segmented App Tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar bg-muted/60 p-1.5 rounded-2xl border border-border/50">
        {tabs.map(t => (
          <button
            key={t.id}
            data-testid={`tab-user-${t.id}`}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 min-w-[85px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all text-center active:scale-95 ${
              activeTab === t.id
                ? "bg-card text-foreground shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-4 sm:space-y-5">
          {/* Subscription & Bot Validity Card */}
          <div className="bg-card border border-card-border rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm sm:text-base">اشتراك وصلاحية البوت</h3>
                  <p className="text-xs text-muted-foreground">التحكم في فترة تشغيل واستجابة الوكيل الذكي لهذا المتجر</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${subInfo.badgeCls}`}>
                {subInfo.status === "expired" ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : subInfo.status === "active" ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
                {subInfo.label}
              </span>
            </div>

            {/* Status Notice Banner */}
            {subInfo.status === "expired" ? (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-3 text-red-700 dark:text-red-400 text-xs sm:text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                <div>
                  <p className="font-bold">تنبيه: الاشتراك منتهي الصلاحية والخدمة متوقفة تلقائياً</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    توقف البوت عن معالجة والرد على رسائل عملاء الواتساب لهذا المتجر. يمكنك تمديد الاشتراك لشهر أو أكثر بالأسفل لإعادة تفعيل الخدمة فوراً.
                  </p>
                </div>
              </div>
            ) : subInfo.status === "expiring_soon" ? (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-amber-700 dark:text-amber-300 text-xs sm:text-sm">
                <Clock className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <p className="font-bold">تنبيه: الاشتراك يوشك على الانتهاء</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    متبقي {subInfo.daysLeft} {subInfo.daysLeft === 1 ? "يوم واحد" : "أيام"} فقط على انتهاء فترة الاشتراك. بادر بالتمديد لتجنب توقف البوت المفاجئ.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3 text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
                <div>
                  <p className="font-bold">خدمة البوت نشطة وسارية</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    يعمل الوكيل الذكي بكامل طاقته للرد على العملاء واستقبال المحادثات على الواتساب.
                  </p>
                </div>
              </div>
            )}

            {/* Expiry Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/50">
              <div>
                <span className="block text-[11px] text-muted-foreground font-medium mb-1">تاريخ انتهاء الصلاحية:</span>
                <span className="text-sm font-bold text-foreground">
                  {user.subscriptionExpiresAt ? (
                    new Date(user.subscriptionExpiresAt).toLocaleDateString("ar-EG", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  ) : (
                    <span className="text-muted-foreground font-normal">غير محدد (مفتوح بدون حد)</span>
                  )}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-muted-foreground font-medium mb-1">المدة المتبقية:</span>
                <span className="text-sm font-bold text-foreground">
                  {subInfo.daysLeft !== null ? (
                    subInfo.daysLeft > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">{subInfo.daysLeft} يوم متبقي</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400 font-bold">انتهت الصلاحية (متوقف)</span>
                    )
                  ) : (
                    <span className="text-muted-foreground font-normal">غير مقيد بمدة</span>
                  )}
                </span>
              </div>
            </div>

            {/* Quick Extension Actions */}
            <div className="space-y-2 pt-1">
              <span className="block text-xs font-semibold text-foreground">
                تمديد الاشتراك بضغطة زر (يُضاف للمدة الحالية إذا كانت نشطة، أو يبدأ من اليوم إذا كانت منتهية):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  data-testid="btn-extend-1m"
                  onClick={() => handleQuickExtend(1)}
                  disabled={extendingMonths !== null}
                  className="h-11 px-3 rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary/15 text-primary font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  {extendingMonths === 1 ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>+ شهر كامل</span>
                </button>
                <button
                  type="button"
                  data-testid="btn-extend-3m"
                  onClick={() => handleQuickExtend(3)}
                  disabled={extendingMonths !== null}
                  className="h-11 px-3 rounded-xl border border-border bg-muted/40 hover:bg-muted font-bold text-xs text-foreground flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  {extendingMonths === 3 ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>+ 3 أشهر</span>
                </button>
                <button
                  type="button"
                  data-testid="btn-extend-6m"
                  onClick={() => handleQuickExtend(6)}
                  disabled={extendingMonths !== null}
                  className="h-11 px-3 rounded-xl border border-border bg-muted/40 hover:bg-muted font-bold text-xs text-foreground flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  {extendingMonths === 6 ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>+ 6 أشهر</span>
                </button>
                <button
                  type="button"
                  data-testid="btn-extend-12m"
                  onClick={() => handleQuickExtend(12)}
                  disabled={extendingMonths !== null}
                  className="h-11 px-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  {extendingMonths === 12 ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>+ سنة كاملة</span>
                </button>
              </div>

              {user.subscriptionExpiresAt && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleResetSubscription}
                    disabled={extendingMonths !== null}
                    className="text-xs text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-40"
                  >
                    إلغاء قيد الصلاحية (جعله مفتوح غير محدد)
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Basic User Info Card */}
          <div className="bg-card border border-card-border rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground text-sm sm:text-base">البيانات الأساسية</h3>
              {editMode && <span className="text-xs text-primary font-medium">وضع التعديل نشط</span>}
            </div>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
              {[
                { label: "الاسم الكامل", field: "name" as const, type: "text" },
                { label: "رقم الهاتف", field: "phone" as const, type: "tel" },
              ].map(({ label, field, type }) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
                  {editMode ? (
                    <input
                      type={type}
                      value={form[field]}
                      onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                      className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  ) : (
                    <p className="text-sm font-medium text-foreground px-3.5 py-2.5 bg-muted/30 rounded-xl">{form[field] || "—"}</p>
                  )}
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">البريد الإلكتروني</label>
                <p className="text-sm font-medium text-foreground px-3.5 py-2.5 bg-muted/30 rounded-xl dir-ltr text-right">{user.email}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">حالة الحساب</label>
                {editMode ? (
                  <select
                    value={form.status}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="active">نشط</option>
                    <option value="pending">معلق</option>
                    <option value="disabled">موقوف</option>
                  </select>
                ) : (
                  <div className="px-3.5 py-2 bg-muted/30 rounded-xl">
                    <Badge className={`text-xs ${statusCfg[form.status]?.cls}`}>{statusCfg[form.status]?.label}</Badge>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">تاريخ نهاية الاشتراك</label>
                {editMode ? (
                  <input
                    type="date"
                    value={form.subscriptionExpiresAt ? form.subscriptionExpiresAt.slice(0, 10) : ""}
                    onChange={e => setForm(p => ({ ...p, subscriptionExpiresAt: e.target.value ? new Date(e.target.value).toISOString() : "" }))}
                    className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                ) : (
                  <p className="text-sm font-medium text-foreground px-3.5 py-2.5 bg-muted/30 rounded-xl">
                    {user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).toLocaleDateString("ar-EG") : "غير محدد (مفتوح)"}
                  </p>
                )}
              </div>
            </div>
            {editMode && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full sm:w-auto h-11 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? "جاري الحفظ…" : "حفظ التغييرات"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: WhatsApp Connection */}
      {activeTab === "whatsapp" && (
        <div className="space-y-4 sm:space-y-5">
          {/* Status Banner */}
          <div className="bg-card border border-card-border rounded-2xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-bold text-foreground text-sm sm:text-base">ربط واتساب</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  المزود المعتمد:{" "}
                  <span className="font-bold text-violet-600 dark:text-violet-400">
                    ⚡ Evolution API
                  </span>
                </p>
              </div>
              <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${waCl}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${waStatus === "connected" ? "bg-emerald-500" : waStatus === "disconnected" ? "bg-amber-500" : "bg-muted-foreground"}`} />
                {waLabel}
              </span>
            </div>
          </div>

          {/* Evolution Wizard */}
          <div className="bg-card border border-card-border rounded-2xl p-4 sm:p-6 shadow-sm">
            <h4 className="font-bold text-foreground text-sm sm:text-base mb-4 flex items-center gap-2">
              <span>⚡ معالج ربط Evolution API</span>
            </h4>
            <WhatsAppConnectionWizard
              userId={user.id}
              waBaseUrl={user.waBaseUrl}
              waApiKey=""
              waInstanceName={user.waInstanceName}
              waStatus={user.waStatus}
              onConnected={() => setUser(u => u ? { ...u, waStatus: "connected" } : u)}
            />
          </div>
        </div>
      )}

      {/* Tab 3: Models Settings */}
      {activeTab === "models" && (
        <div className="bg-card border border-card-border rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-foreground text-sm sm:text-base">إعدادات نماذج الذكاء الاصطناعي</h3>
            {!editMode && (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-muted transition-all active:scale-95"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>تعديل</span>
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">نموذج الشات الرئيسي (Chat)</label>
              {editMode ? (
                <select
                  value={form.chatKeyId}
                  onChange={e => setForm(p => ({ ...p, chatKeyId: e.target.value }))}
                  className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">بدون</option>
                  {chatKeys.map(k => <option key={k.id} value={k.id}>{k.name} — {k.model}</option>)}
                </select>
              ) : (
                <p className="text-sm font-medium text-foreground px-3.5 py-2.5 bg-muted/30 rounded-xl">{user.chatKeyName ?? "—"}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">نموذج التضمين (Embedding)</label>
              {editMode ? (
                <select
                  value={form.embeddingKeyId}
                  onChange={e => setForm(p => ({ ...p, embeddingKeyId: e.target.value }))}
                  className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">بدون</option>
                  {embeddingKeys.map(k => <option key={k.id} value={k.id}>{k.name} — {k.model}</option>)}
                </select>
              ) : (
                <p className="text-sm font-medium text-foreground px-3.5 py-2.5 bg-muted/30 rounded-xl">{user.embeddingKeyName ?? "—"}</p>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-border">
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              مفاتيح الشات الاحتياطية (Fallback) — تُجرَّب بالترتيب عند فشل الرئيسي
            </label>
            {editMode ? (
              <div className="space-y-2">
                {chatKeys
                  .filter(k => !form.chatKeyId || String(k.id) !== form.chatKeyId)
                  .map(k => {
                    const checked = form.chatFallbackKeyIds.includes(k.id);
                    return (
                      <label
                        key={k.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all active:scale-[0.99] ${
                          checked
                            ? "bg-primary/5 border-primary/40 shadow-xs"
                            : "border-border bg-muted/20 hover:bg-muted/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            if (e.target.checked) {
                              setForm(p => ({ ...p, chatFallbackKeyIds: [...p.chatFallbackKeyIds, k.id] }));
                            } else {
                              setForm(p => ({ ...p, chatFallbackKeyIds: p.chatFallbackKeyIds.filter(id => id !== k.id) }));
                            }
                          }}
                          className="w-4 h-4 rounded accent-primary shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{k.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{k.model}</p>
                        </div>
                        <Badge className="text-[10px] bg-muted shrink-0">{k.provider}</Badge>
                      </label>
                    );
                  })
                }
                {chatKeys.filter(k => !form.chatKeyId || String(k.id) !== form.chatKeyId).length === 0 && (
                  <p className="text-xs text-muted-foreground p-3 bg-muted/20 rounded-xl">لا توجد مفاتيح إضافية لتعيينها كاحتياطية</p>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {form.chatFallbackKeyIds.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-3.5 py-2.5 bg-muted/30 rounded-xl">لا توجد مفاتيح احتياطية</p>
                ) : (
                  form.chatFallbackKeyIds.map(id => {
                    const k = chatKeys.find(k => k.id === id);
                    return k ? (
                      <span key={id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold">
                        <Activity className="w-3 h-3" />
                        {k.name}
                      </span>
                    ) : null;
                  })
                )}
              </div>
            )}
          </div>

          {editMode && (
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto h-11 px-6 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "جاري الحفظ…" : "حفظ النماذج"}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Activity */}
      {activeTab === "activity" && (
        <div className="space-y-4">
          <div className="bg-card border border-card-border rounded-2xl p-4 sm:p-5 shadow-sm">
            <h3 className="font-bold text-foreground text-sm sm:text-base mb-3">محادثات آخر 7 أيام</h3>
            <div className="h-48 sm:h-56 w-full -ms-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockActivity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem", fontSize: 12, direction: "rtl" }} />
                  <Bar dataKey="conversations" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-card border border-card-border rounded-2xl p-4 sm:p-5 shadow-sm">
            <h3 className="font-bold text-foreground text-sm sm:text-base mb-3">معلومات النشاط</h3>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {[
                { label: "تاريخ التسجيل", value: new Date(user.createdAt).toLocaleDateString("ar") },
                { label: "آخر تسجيل دخول", value: user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString("ar") : "—" },
                { label: "إجمالي المحادثات", value: (user.conversations ?? 0).toLocaleString("ar") },
                { label: "نموذج الشات", value: user.chatKeyName ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-muted/30 rounded-xl p-3">
                  <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
                  <p className="text-xs sm:text-sm font-bold text-foreground truncate">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
