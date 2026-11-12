import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OffersManager } from "@/components/OffersManager";

export const Route = createFileRoute("/admin/offers")({
  head: () => ({ meta: [{ title: "Offers — Admin" }] }),
  component: AdminOffersPage,
});

function AdminOffersPage() {
  const shops = useQuery({
    queryKey: ["admin-shops-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("shops").select("id, name").order("name");
      return data ?? [];
    },
  });

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <OffersManager shops={shops.data ?? []} />
    </div>
  );
}
