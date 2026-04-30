"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "@/hooks/use-socket";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";

/**
 * SOCKET HUB
 * A non-rendering component that manages global real-time events.
 * It ensures that system-wide updates (like wallet balance) are 
 * automatically reflected in the store without page refreshes.
 */
export function SocketHub() {
  const queryClient = useQueryClient();
  const { user, workspace } = useAuthStore();
  
  // Connect to the workspace room
  const { socket, isConnected } = useSocket({
    workspaceId: workspace?._id || user?.workspace?._id || user?.workspace,
  });

  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log("[SocketHub] Global Listener Active");

    const invalidateCampaignQueries = (campaignIds: Array<string | undefined> = []) => {
      const uniqueCampaignIds = Array.from(new Set(campaignIds.filter((campaignId): campaignId is string => Boolean(campaignId))));

      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["campaign-messages"] });

      for (const campaignId of uniqueCampaignIds) {
        void queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      }
    };

    /**
     * Handle Wallet Balance Updates
     */
    const handleWalletUpdate = (data: { balance: number; parkedBalance?: number }) => {
      console.log("[SocketHub] Wallet Update received:", data);
      
      // Update global auth store state
      useAuthStore.setState((state) => ({
        wallet: {
          ...state.wallet,
          balance: data.balance,
        }
      }));

      // Optional: Visual cue if balance increased (top-up)
      // If we had the previous balance, we could compare. 
      // For now, we trust the store update is enough for UI reactivity.
    };

    /**
     * Handle Global Notifications / Toasts
     */
    const handleGlobalNotification = (data: { title: string; message: string; type?: 'success' | 'info' | 'error' | 'warning' }) => {
      const type = data.type || 'info';
      toast[type](data.title, {
        description: data.message,
      });
    };

    /**
     * Handle Campaign Completions
     */
    const handleCampaignStatus = (data: { campaignId?: string; status?: string }) => {
      invalidateCampaignQueries([data?.campaignId]);

      const status = (data.status || "").toUpperCase();
      if (status === 'COMPLETED') {
        toast.success("Campaign Completed", {
          description: `Campaign ${data.campaignId || ""} has finished processing all batches.`
        });
      } else if (status === 'FAILED') {
        toast.error("Campaign Failed", {
          description: `Campaign ${data.campaignId || ""} reported a failure.`
        });
      }
    };

    const handleCampaignMessageBatch = (data: { campaignId?: string; updates?: Array<{ campaignId?: string }> }) => {
      const campaignIds = [data?.campaignId, ...(data?.updates || []).map((update) => update?.campaignId)];
      invalidateCampaignQueries(campaignIds);
    };

    // Register global listeners
    socket.on("workspace:wallet_update", handleWalletUpdate);
    socket.on("workspace:notification", handleGlobalNotification);
    socket.on("campaign:status_update", handleCampaignStatus);
    socket.on("campaign:batch_completed", handleCampaignStatus);
    socket.on("campaign:message_status_batch", handleCampaignMessageBatch);
    socket.on("campaign:message_status_update", handleCampaignMessageBatch);

    return () => {
      socket.off("workspace:wallet_update", handleWalletUpdate);
      socket.off("workspace:notification", handleGlobalNotification);
      socket.off("campaign:status_update", handleCampaignStatus);
      socket.off("campaign:batch_completed", handleCampaignStatus);
      socket.off("campaign:message_status_batch", handleCampaignMessageBatch);
      socket.off("campaign:message_status_update", handleCampaignMessageBatch);
    };
  }, [socket, isConnected, queryClient]);

  return null; // This component doesn't render anything
}
