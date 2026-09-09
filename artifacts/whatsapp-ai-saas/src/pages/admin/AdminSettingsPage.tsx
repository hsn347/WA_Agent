import { useState, useEffect } from "react";
import { Save, Phone, Send, CheckCircle, XCircle, Loader2, Info, KeyRound } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

function normalizeYemenPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00967")) return digits.slice(2);
  if (digits.startsWith("967")) return digits;
  if (digits.startsWith("0")) return "967" + digits.slice(1);
  if (digits.length === 9) return "967" + digits;
  return digits;
}

function isValidYemenPhone(normalized: string): boolean {
  return /^9677\d{8}$/.test(normalized);
}

function formatDisplay(normalized: string): string {
  if (!normalized) return "";
  const local = normalized.startsWith("967") ? normalized.slice(3) : normalized;
  return local.replace(/(\d{2})(\d{4})(\d{3})/, "$1 $2 $3");
}

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [rawInput, setRawInput] = useState("");
  const [normalizedNumber, setNormalizedNumber] = useState("");

  useEffect(() => {
    api.adminSettings.get().then(settings => {
      const stored = settings["admin_whatsapp_number"] ?? "";
      setNormalizedNumber(stored);
      setRawInput(stored ? formatDisplay(stored) : "");
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRawInput(value);
    setNormalizedNumber(normalizeYemenPhone(value));
    setTestResult(null);
  };

  const handleSave = async () => {
    if (!isValidYemenPhone(normalizedNumber)) {
      toast({ title: "رقم غير صحيح", description: "يرجى إدخال رقم واتساب يمني صحيح (9 أرقام تبدأ بـ 7)", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.adminSettings.update({ admin_whatsapp_number: normalizedNumber });
      toast({ title: "تم الحفظ", description: "تم حفظ رقم واتساب الإدارة بنجاح" });
    } catch {
      toast({ title: "خطأ", description: "فشل الحفظ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!isValidYemenPhone(normalizedNumber)) {
      toast({ title: "رقم غير صحيح", description: "يرجى حفظ رقم صحيح أولاً", variant: "destructive" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.adminSettings.testWhatsapp(normalizedNumber);
      setTestResult(result);
      toast({
        title: result.success ? "تم الإرسال" : "فشل الإرسال",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
      setTestResult({ success: false, message: msg });
      toast({ title: "خطأ", description: msg, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin me-2" />جاري التحميل…
      </div>
    );
  }

  const valid = isValidYemenPhone(normalizedNumber);

  return (
    <div className="max-w-2xl space-y-4 sm:space-y-6 pb-8" dir="rtl">
      {/* ─── WhatsApp notification number ─────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 shadow-sm space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">إشعارات المفاتيح</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              عند فشل أو تعطل أي مفتاح ذكاء اصطناعي (API Key) في النظام، يتم إرسال تنبيه واتساب فوري وتلقائي إلى هذا الرقم لاتخاذ الإجراء السريع.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs sm:text-sm font-semibold text-foreground">رقم واتساب الإدارة</label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 h-11 bg-muted/40 border border-border rounded-xl shrink-0 text-sm font-medium text-foreground select-none">
              <span className="text-base leading-none">🇾🇪</span>
              <span className="text-muted-foreground font-mono text-xs sm:text-sm" dir="ltr">+967</span>
            </div>
            <input
              type="tel"
              dir="ltr"
              placeholder="7X XXXX XXX"
              value={rawInput}
              onChange={handlePhoneChange}
              className="flex-1 h-11 px-3.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring text-left"
            />
          </div>

          {rawInput && (
            <div className={`flex items-center gap-1.5 text-xs ${valid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
              {valid ? (
                <><CheckCircle className="w-3.5 h-3.5 shrink-0" /><span>الرقم صحيح — سيُخزَّن كـ: <span className="font-mono font-bold">{normalizedNumber}</span></span></>
              ) : (
                <><Info className="w-3.5 h-3.5 shrink-0" /><span>الرقم يجب أن يكون 9 أرقام يبدأ بـ 7 (مثال: 777123456)</span></>
              )}
            </div>
          )}

          {testResult && (
            <div className={`flex items-start gap-2 p-3 rounded-xl text-xs sm:text-sm ${testResult.success ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"}`}>
              {testResult.success ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !valid}
            className="w-full sm:w-auto h-11 px-6 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? "جاري الحفظ…" : "حفظ الرقم"}</span>
          </button>
          <button
            onClick={handleTest}
            disabled={testing || !valid}
            className="w-full sm:w-auto h-11 px-5 rounded-xl border border-border text-xs sm:text-sm font-semibold hover:bg-muted disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{testing ? "جاري الاختبار…" : "إرسال رسالة اختبار"}</span>
          </button>
        </div>
      </div>

      {/* ─── Info card ─────────────────────────────────────────────────────────── */}
      <div className="bg-muted/30 border border-border rounded-2xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Phone className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="space-y-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            <p className="font-bold text-foreground">كيف تعمل إشعارات المفاتيح؟</p>
            <p>عندما يفشل مفتاح AI لأي مستخدم بعد استنفاد جميع المحاولات، يتحول النظام تلقائياً للمفتاح الاحتياطي التالي ويرسل إشعار واتساب فوري على هذا الرقم المسجل.</p>
            <p className="text-[11px] sm:text-xs text-muted-foreground/80">ملاحظة: يتطلب استلام الإشعار وجود اتصال واتساب نشط في النظام.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
