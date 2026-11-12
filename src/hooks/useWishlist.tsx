import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const FAV_KEY = "fb_favourites_v1";

function readLocal(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]"); } catch { return []; }
}
function writeLocal(ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FAV_KEY, JSON.stringify(ids));
}

export function useWishlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [localIds, setLocalIds] = useState<string[]>([]);

  useEffect(() => {
    setLocalIds(readLocal());
    const onStorage = () => setLocalIds(readLocal());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const remoteQuery = useQuery({
    queryKey: ["wishlist", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlist_items")
        .select("product_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.product_id as string);
    },
  });

  // Merge localStorage favourites into DB on login.
  useEffect(() => {
    if (!user) return;
    const local = readLocal();
    if (local.length === 0) return;
    (async () => {
      await supabase
        .from("wishlist_items")
        .upsert(local.map((pid) => ({ user_id: user.id, product_id: pid })), {
          onConflict: "user_id,product_id",
          ignoreDuplicates: true,
        });
      writeLocal([]);
      setLocalIds([]);
      qc.invalidateQueries({ queryKey: ["wishlist", user.id] });
    })();
  }, [user, qc]);

  const ids = user ? (remoteQuery.data ?? []) : localIds;

  const isFav = useCallback((productId: string) => ids.includes(productId), [ids]);

  const toggle = useCallback(async (productId: string) => {
    if (!user) {
      const cur = readLocal();
      const next = cur.includes(productId) ? cur.filter((i) => i !== productId) : [...cur, productId];
      writeLocal(next);
      setLocalIds(next);
      return;
    }
    const has = ids.includes(productId);
    const previous = qc.getQueryData<string[]>(["wishlist", user.id]);
    // Optimistic update
    qc.setQueryData<string[]>(["wishlist", user.id], (prev) => {
      const cur = prev ?? [];
      return has ? cur.filter((i) => i !== productId) : [...cur, productId];
    });
    const { error } = has
      ? await supabase.from("wishlist_items").delete().eq("user_id", user.id).eq("product_id", productId)
      : await supabase
          .from("wishlist_items")
          .upsert({ user_id: user.id, product_id: productId }, { onConflict: "user_id,product_id" });
    if (error) {
      qc.setQueryData<string[]>(["wishlist", user.id], previous);
      const { toast } = await import("sonner");
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["wishlist", user.id] });
  }, [user, ids, qc]);


  return { ids, isFav, toggle, loading: !!user && remoteQuery.isLoading };
}
