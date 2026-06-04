"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { WorkspaceStatus } from "@/lib/subscription/status";

type SubscriptionData = {
  plan: "trial" | "subscribed" | "expired";
  status: WorkspaceStatus;
  subscriptionPlan: "monthly" | "quarterly" | null;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  daysLeft: number | null;
};

type SubscriptionContextValue = {
  data: SubscriptionData | null;
  isLoading: boolean;
  isReadOnly: boolean;
  refetch: () => void;
};

const SubscriptionContext = createContext<SubscriptionContextValue>({
  data: null,
  isLoading: true,
  isReadOnly: false,
  refetch: () => {},
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/workspace/subscription", {
        credentials: "include",
      });
      if (!res.ok) return;
      const json = await res.json() as { ok: boolean; data: SubscriptionData };
      if (json.ok) setData(json.data);
    } catch {
      // silently fail — UI degrades gracefully
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSubscription();
  }, [fetchSubscription]);

  const isReadOnly = !isLoading && data?.status !== "active";

  return (
    <SubscriptionContext.Provider
      value={{ data, isLoading, isReadOnly, refetch: fetchSubscription }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  return useContext(SubscriptionContext);
}
