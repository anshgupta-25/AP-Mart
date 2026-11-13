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
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-4 md:px-6">
      {shop.isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : !shop.data ? (
        <div className="rounded-xl bg-card px-6 py-12 text-center text-body text-muted-foreground border border-border/70">
          You don't have a shop assigned yet. Contact an admin to set one up.
        </div>
      ) : (
        <OffersManager lockedScope="shop" shopId={shop.data.id} />
      )}
    </div>
  );
}
