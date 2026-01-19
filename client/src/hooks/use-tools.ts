import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { buildApiUrl } from "@/lib/api";

export function useTools() {
  return useQuery({
    queryKey: [api.tools.list.path],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(api.tools.list.path));
      if (!res.ok) throw new Error("Failed to fetch tools");
      return api.tools.list.responses[200].parse(await res.json());
    },
  });
}
