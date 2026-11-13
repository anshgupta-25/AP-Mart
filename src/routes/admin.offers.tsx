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
    <div className="mx-auto w-full max-w-4xl px-4 py-4 md:px-6 md:py-6">
      <OffersManager shops={shops.data ?? []} />
    </div>
  );
}
