import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase, type RealtimeTable } from "@/lib/supabaseClient";
import { invalidateApiCache } from "@/lib/api";
import type { RealtimeChannel } from "@supabase/supabase-js";

const TABLE_TO_API_PATH: Record<string, string> = {
  orders: "/user/orders",
  returns: "/user/returns",
  conversations: "/user/conversations",
  messages: "/user/conversations",
  notifications: "/user/notifications",
};

type QueryKeyMap = Partial<Record<RealtimeTable, unknown[]>>;

/**
 * useRealtimeSync
 *
 * Hook يشترك في تغييرات Supabase Realtime لجداول محددة ويُبطل
 * كاش React Query وكاش API تلقائياً عند أي INSERT أو UPDATE أو DELETE.
 *
 * @example
 * // في OrdersPage — يُبطل ["orders"] و["returns"] عند أي تغيير
 * useRealtimeSync({ orders: ["orders"], returns: ["returns"] });
 *
 * @example
 * // في ConversationsPage
 * useRealtimeSync({
 *   conversations: ["conversations"],
 *   messages: ["messages", selectedConvId],
 * });
 *
 * @param tableQueryKeys - خريطة: اسم الجدول → React Query key
 * @param userId - اختياري: تصفية بـ user_id لتجنب تلقّي تغييرات مستخدمين آخرين
 */
export function useRealtimeSync(
  tableQueryKeys: QueryKeyMap,
  userId?: number
) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!supabase) {
      // Supabase غير مُهيَّأ — تعمل الصفحة بالـ polling الاحتياطي
      return;
    }

    const tables = Object.keys(tableQueryKeys) as RealtimeTable[];
    if (tables.length === 0) return;

    const channelName = `realtime:${tables.join("_")}:${Date.now()}`;
    const channel = supabase.channel(channelName);

    tables.forEach((table) => {
      const queryKey = tableQueryKeys[table];
      if (!queryKey) return;

      channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        {
          event: "*", // INSERT | UPDATE | DELETE
          schema: "public",
          table,
          // تصفية اختيارية بالـ user_id لتجنب الضوضاء
          ...(userId ? { filter: `user_id=eq.${userId}` } : {}),
        },
        (_payload: unknown) => {
          // إبطال كاش React Query
          queryClient.invalidateQueries({ queryKey });

          // إبطال كاش api.ts أيضاً لجلب البيانات الطازجة فوراً
          const apiPath = TABLE_TO_API_PATH[table];
          if (apiPath) invalidateApiCache(apiPath);
        }
      );
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.debug(`[Realtime] ✅ اشتراك نشط: ${tables.join(", ")}`);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn(`[Realtime] ⚠️ مشكلة في الاشتراك: ${status}`);
      }
    });

    channelRef.current = channel;

    return () => {
      if (supabase && channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      channelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(tableQueryKeys), userId]);
}

/**
 * useNotificationsRealtime
 *
 * Hook مُتخصَّص للإشعارات — يستدعي callback عند وصول إشعار جديد
 * بدلاً من إبطال كاش React Query.
 */
export function useNotificationsRealtime(
  onNew: () => void,
  userId?: number
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`notifications:${userId ?? "all"}:${Date.now()}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          ...(userId ? { filter: `user_id=eq.${userId}` } : {}),
        },
        (_payload: unknown) => {
          onNew();
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      if (supabase && channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      channelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
}
