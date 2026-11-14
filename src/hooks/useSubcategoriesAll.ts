import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Subcategory = {
  id: string;
  category_id: string;
  name: string;
  icon: string | null;
  image_url: string | null;
};

export function useSubcategoriesAll() {
  return useQuery({
    queryKey: ["home-subcategories"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("subcategories")
        .select("id, category_id, name, icon, image_url")
        .eq("is_active", true)
        .order("display_order");
      return (data ?? []) as Subcategory[];
    },
  });
}
