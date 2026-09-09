export const WA_PROVIDERS = [
  {
    id: "evolution",
    name: "Evolution API",
    logo: "⚡",
    desc: "ربط مباشر عبر واتساب (QR Code) — مجاني ومفتوح المصدر",
    docsUrl: "https://doc.evolution-api.com",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
] as const;

export type WaProviderId = (typeof WA_PROVIDERS)[number]["id"];

export type ProviderField = {
  key: string; label: string; placeholder: string;
  type?: "text" | "password"; hint?: string; required?: boolean;
};

export const PROVIDER_FIELDS: Record<string, ProviderField[]> = {};

export function getWebhookUrl(provider: string, userId: number): string {
  const base = window.location.origin.replace(":5000", ":8080");
  return `${base}/api/webhooks/evolution/${userId}`;
}

