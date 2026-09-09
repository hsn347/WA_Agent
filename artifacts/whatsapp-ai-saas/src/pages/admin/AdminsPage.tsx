import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Shield, UserCheck, Clock, X, Save, Loader2, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Admin {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
}

const statusConfig = {
  active:   { label: "نشط",   className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20" },
  pending:  { label: "معلق",  className: "bg-amber-500/15 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20" },
  disabled: { label: "موقوف", className: "bg-red-500/15 text-red-600 hover:bg-red-500/20" },
};

const emptyForm = { name: "", email: "", password: "", phone: "", status: "active" };

export default function AdminsPage() {
  const { user: me } = useAuth();
  const { toast } = useToast();

  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Admin | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Admin | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      const data = await api.admins.list();
      setAdmins(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setShowPassword(false);
    setShowModal(true);
  };

  const openEdit = (admin: Admin) => {
    setEditTarget(admin);
    setForm({ name: admin.name, email: admin.email, password: "", phone: admin.phone ?? "", status: admin.status });
    setShowPassword(false);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) {
      toast({ title: "خطأ", description: "الاسم والبريد الإلكتروني مطلوبان", variant: "destructive" });
      return;
    }
    if (!editTarget && !form.password) {
      toast({ title: "خطأ", description: "كلمة المرور مطلوبة عند الإنشاء", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editTarget) {
        const payload: Record<string, string> = { name: form.name, email: form.email, phone: form.phone, status: form.status };
        if (form.password) payload["password"] = form.password;
        await api.admins.update(editTarget.id, payload);
        toast({ title: "تم الحفظ", description: "تم تحديث بيانات المسؤول بنجاح" });
      } else {
        await api.admins.create({ name: form.name, email: form.email, password: form.password, phone: form.phone || undefined });
        toast({ title: "تم الإنشاء", description: "تم إنشاء حساب المسؤول بنجاح" });
      }
      setShowModal(false);
      await load();
    } catch (err: unknown) {
      toast({ title: "خطأ", description: err instanceof Error ? err.message : "حدث خطأ غير متوقع", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.admins.remove(deleteTarget.id);
      toast({ title: "تم الحذف", description: `تم حذف حساب "${deleteTarget.name}" بنجاح` });
      setDeleteTarget(null);
      await load();
    } catch (err: unknown) {
      toast({ title: "خطأ", description: err instanceof Error ? err.message : "حدث خطأ", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = admins.filter(a => a.status === "active").length;

  return (
    <div className="space-y-4 sm:space-y-6 pb-8" dir="rtl">
      {/* 3-Col Responsive Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: "إجمالي المسؤولين", value: admins.length, icon: Shield, color: "text-primary", bg: "bg-primary/10" },
          { label: "النشطون", value: activeCount, icon: UserCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          {
            label: "آخر دخول",
            value: admins.filter(a => a.lastLoginAt).length > 0
              ? new Date(admins.sort((a, b) => (b.lastLoginAt ?? "").localeCompare(a.lastLoginAt ?? ""))[0]?.lastLoginAt ?? "").toLocaleDateString("ar")
              : "—",
            icon: Clock,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
            text: true,
          },
        ].map(({ label, value, icon: Icon, color, bg, text }) => (
          <div key={label} className="bg-card border border-card-border rounded-2xl p-2.5 sm:p-4 shadow-sm text-center sm:text-right">
            <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-1 mb-1 sm:mb-2">
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium truncate">{label}</span>
              <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-3.5 h-3.5 ${color}`} />
              </div>
            </div>
            <p className="text-sm sm:text-xl font-bold text-foreground truncate">
              {loading ? "..." : (text ? value : (value as number).toLocaleString("ar"))}
            </p>
          </div>
        ))}
      </div>

      {/* Main Container */}
      <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-5 border-b border-border">
          <div>
            <h2 className="font-bold text-foreground text-sm sm:text-base">قائمة المسؤولين</h2>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">إدارة حسابات وصلاحيات مدراء النظام</p>
          </div>
          <button
            data-testid="btn-add-admin"
            onClick={openCreate}
            className="flex items-center gap-1.5 h-10 px-3.5 sm:px-4 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:bg-primary/90 transition-all active:scale-95 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مسؤول</span>
          </button>
        </div>

        {/* Loading / Empty States */}
        {loading && (
          <div className="text-center py-12 text-muted-foreground text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>جاري التحميل...</span>
          </div>
        )}

        {!loading && admins.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">لا يوجد مسؤولون بعد</div>
        )}

        {/* Mobile View: Native Cards (md:hidden) */}
        {!loading && admins.length > 0 && (
          <div className="md:hidden divide-y divide-border/60">
            {admins.map(admin => {
              const isSelf = admin.id === me?.id;
              return (
                <div key={admin.id} className="p-4 space-y-3 hover:bg-muted/20 transition-colors">
                  {/* Top Row: Avatar + Name + Status */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0 shadow-inner">
                        {admin.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-foreground text-sm truncate">{admin.name}</p>
                          {isSelf && (
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded-full font-semibold shrink-0">
                              أنت
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate dir-ltr text-right">{admin.email}</p>
                      </div>
                    </div>
                    <Badge className={`text-[10px] px-2 py-0.5 shrink-0 ${statusConfig[admin.status as keyof typeof statusConfig]?.className}`}>
                      {statusConfig[admin.status as keyof typeof statusConfig]?.label ?? admin.status}
                    </Badge>
                  </div>

                  {/* Contact & Dates Info Pills */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground pt-1">
                    {admin.phone && (
                      <span className="bg-muted/50 px-2 py-0.5 rounded-lg dir-ltr">
                        {admin.phone}
                      </span>
                    )}
                    <span className="bg-muted/50 px-2 py-0.5 rounded-lg">
                      منذ {new Date(admin.createdAt).toLocaleDateString("ar")}
                    </span>
                    <span className="bg-muted/50 px-2 py-0.5 rounded-lg">
                      آخر دخول: {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleDateString("ar") : "—"}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      data-testid={`btn-edit-admin-${admin.id}`}
                      onClick={() => openEdit(admin)}
                      className="flex-1 h-10 rounded-xl border border-border text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-muted transition-all active:scale-95"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>تعديل</span>
                    </button>
                    <button
                      data-testid={`btn-delete-admin-${admin.id}`}
                      onClick={() => !isSelf && setDeleteTarget(admin)}
                      disabled={isSelf}
                      className="h-10 px-3.5 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-red-500/10 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Desktop View: Table (hidden md:block) */}
        {!loading && admins.length > 0 && (
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-right px-5 py-3.5 text-xs text-muted-foreground font-semibold">المسؤول</th>
                  <th className="text-right px-5 py-3.5 text-xs text-muted-foreground font-semibold">الحالة</th>
                  <th className="text-right px-5 py-3.5 text-xs text-muted-foreground font-semibold">تاريخ الإنشاء</th>
                  <th className="text-right px-5 py-3.5 text-xs text-muted-foreground font-semibold">آخر دخول</th>
                  <th className="text-right px-5 py-3.5 text-xs text-muted-foreground font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {admins.map((admin, i) => {
                  const isSelf = admin.id === me?.id;
                  return (
                    <tr
                      key={admin.id}
                      className={`transition-colors hover:bg-muted/20 ${i % 2 === 0 ? "" : "bg-muted/5"}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {admin.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground text-sm">{admin.name}</p>
                              {isSelf && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">أنت</span>}
                            </div>
                            <p className="text-xs text-muted-foreground dir-ltr text-right">{admin.email}</p>
                            {admin.phone && <p className="text-xs text-muted-foreground dir-ltr text-right">{admin.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge className={`text-[10px] px-2 py-0.5 ${statusConfig[admin.status as keyof typeof statusConfig]?.className}`}>
                          {statusConfig[admin.status as keyof typeof statusConfig]?.label ?? admin.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">
                        {new Date(admin.createdAt).toLocaleDateString("ar")}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">
                        {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleDateString("ar") : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            data-testid={`btn-desktop-edit-admin-${admin.id}`}
                            onClick={() => openEdit(admin)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors active:scale-95"
                            title="تعديل"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            data-testid={`btn-desktop-delete-admin-${admin.id}`}
                            onClick={() => !isSelf && setDeleteTarget(admin)}
                            disabled={isSelf}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                            title="حذف"
                          >
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
        )}
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="w-[94vw] sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl p-4 sm:p-6" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold">
              {editTarget ? "تعديل بيانات المسؤول" : "إضافة مسؤول جديد"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                الاسم الكامل <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="أحمد المحمد"
                className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                البريد الإلكتروني <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="admin@example.com"
                dir="ltr"
                className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-left"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                كلمة المرور {editTarget && <span className="text-xs text-muted-foreground font-normal">(اتركها فارغة للإبقاء على الحالية)</span>}
                {!editTarget && <span className="text-red-500"> *</span>}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  dir="ltr"
                  className="w-full h-11 px-3.5 pe-10 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute inset-y-0 end-0 px-3.5 flex items-center text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                رقم الهاتف <span className="text-xs text-muted-foreground font-normal">(اختياري)</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="+967 7XXXXXXXX"
                dir="ltr"
                className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-left"
              />
            </div>
            {editTarget && (
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">حالة الحساب</label>
                <select
                  value={form.status}
                  onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full h-11 px-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="active">نشط</option>
                  <option value="disabled">موقوف</option>
                </select>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <button
              onClick={() => setShowModal(false)}
              className="w-full sm:w-auto h-11 px-5 rounded-xl border border-border text-muted-foreground hover:bg-muted text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-95"
            >
              <X className="w-4 h-4" />
              <span>إلغاء</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto h-11 px-6 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? "جاري الحفظ…" : (editTarget ? "حفظ التعديلات" : "إنشاء المسؤول")}</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="w-[92vw] sm:max-w-sm rounded-2xl p-4 sm:p-6" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 text-base font-bold">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>تأكيد الحذف</span>
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs sm:text-sm text-muted-foreground py-2 leading-relaxed">
            هل أنت متأكد من حذف حساب المسؤول <span className="font-bold text-foreground">"{deleteTarget?.name}"</span>؟
            <br />هذا الإجراء نهائي ولا يمكن التراجع عنه.
          </p>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="w-full sm:w-auto h-11 px-5 rounded-xl border border-border text-muted-foreground hover:bg-muted text-xs sm:text-sm font-semibold active:scale-95"
            >
              إلغاء
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full sm:w-auto h-11 px-6 rounded-xl bg-red-600 text-white text-xs sm:text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>{deleting ? "جاري الحذف…" : "نعم، احذف"}</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
