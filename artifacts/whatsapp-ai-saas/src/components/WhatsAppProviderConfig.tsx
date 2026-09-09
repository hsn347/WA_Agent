import { ExternalLink } from "lucide-react";
import { WA_PROVIDERS } from "@/lib/waProviders";

// ── ProviderSelector ──────────────────────────────────────────────────────────
export function ProviderSelector({
  value = "evolution",
}: { value?: string; onChange?: (v: string) => void; disabled?: boolean }) {
  const prov = WA_PROVIDERS[0];

  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-muted-foreground mb-2">مزود واتساب المعتمد</label>
      <div className="flex items-center gap-3 p-3.5 rounded-xl border border-violet-500/20 bg-violet-500/10">
        <span className="text-2xl">{prov.logo}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm text-violet-600 dark:text-violet-400">{prov.name}</p>
            <span className="text-[10px] font-medium bg-violet-500/20 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full">
              المزود الوحيد
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{prov.desc}</p>
        </div>
      </div>
      {prov.docsUrl && (
        <a
          href={prov.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <ExternalLink className="w-3 h-3" /> التوثيق الرسمي لـ {prov.name}
        </a>
      )}
    </div>
  );
}

// ── ProviderFields (reusable form) ────────────────────────────────────────────
export function ProviderFields({}: {
  provider?: string;
  config?: Record<string, string>;
  onChange?: (key: string, value: string) => void;
  readOnly?: boolean;
}) {
  return null;
}

// ── Main full component (for UserDetailPage) ──────────────────────────────────
interface WhatsAppProviderConfigProps {
  userId: number;
  initialProvider?: string;
  initialConfig?: Record<string, string>;
  onSaved?: (provider: string, config: Record<string, string>) => void;
}

export default function WhatsAppProviderConfig({}: WhatsAppProviderConfigProps) {
  const prov = WA_PROVIDERS[0];

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center gap-3 p-4 rounded-xl border border-violet-500/20 bg-violet-500/10">
        <span className="text-2xl">{prov.logo}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-violet-600 dark:text-violet-400">{prov.name}</h4>
            <span className="text-[10px] font-medium bg-violet-500/20 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full">
              المزود الحصري
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            يتم إعداد وربط الحساب عبر معالج ربط Evolution API أدناه (إدخال عنوان الخادم ومفتاح API ومسح QR Code).
          </p>
        </div>
      </div>
    </div>
  );
}

