import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Supabase] VITE_SUPABASE_URL أو VITE_SUPABASE_ANON_KEY غير موجودة — " +
    "Realtime لن يعمل. أضف هذه المتغيرات في ملف .env"
  );
}

/**
 * Supabase client مُشترك — يُستخدم فقط للـ Realtime subscriptions.
 * طلبات API العادية تظل عبر apiFetch في api.ts.
 *
 * ملاحظة: نُعطّل Realtime بدون أخطاء إذا لم تكن المتغيرات موجودة (dev mode).
 */
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
        auth: {
          // لا نريد session management — فقط Realtime
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;

export type RealtimeTable = "orders" | "returns" | "conversations" | "messages" | "notifications";
