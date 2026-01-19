import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { buildApiUrl } from "@/lib/api";

export function useLore() {
  return useQuery({
    queryKey: [api.lore.list.path],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(api.lore.list.path));
      if (!res.ok) throw new Error("Failed to fetch lore");
      return api.lore.list.responses[200].parse(await res.json());
    },
  });
}
