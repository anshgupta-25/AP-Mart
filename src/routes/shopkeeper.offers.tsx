import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { OffersManager } from "@/components/OffersManager";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/shopkeeper/offers")({
  head: () => ({ meta: [{ title: "Offers — Shopkeeper" }] }),
  component: ShopkeeperOffersPage,
});

function ShopkeeperOffersPage() {
  const { user } = useAuth();

  const shop = useQuery({
    queryKey: ["my-shop", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("shops")
        .select("id, name")
        .eq("owner_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  return (
    <div className="p-4 max-w-3xl mx-auto">
      {shop.isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : !shop.data ? (
        <div className="text-center py-12 rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
          You don't have a shop assigned yet. Contact an admin to set one up.
        </div>
      ) : (
        <OffersManager lockedScope="shop" shopId={shop.data.id} />
      )}
    </div>
  );
}
