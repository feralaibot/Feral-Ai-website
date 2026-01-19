import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { buildApiUrl } from "@/lib/api";
import { getAuthHeaders } from "@/lib/session";

export function useAssets(publicKey: string | null) {
  return useQuery({
    queryKey: [api.wallet.assets.path, publicKey],
    enabled: Boolean(publicKey),
    queryFn: async () => {
      const url = new URL(buildApiUrl(api.wallet.assets.path));
      url.searchParams.set("publicKey", publicKey as string);
      const res = await fetch(url.toString(), {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch assets");
      return api.wallet.assets.responses[200].parse(await res.json());
    },
  });
}
