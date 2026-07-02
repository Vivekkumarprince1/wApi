"use client";

import { InstagramConnectModal } from "@/components/integrations/InstagramConnectModal";

interface ConnectInstagramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ConnectInstagramModal = ({ isOpen, onClose, onSuccess }: ConnectInstagramModalProps) => (
  <InstagramConnectModal
    isOpen={isOpen}
    onClose={onClose}
    onSuccess={onSuccess || (() => {})}
  />
);

export default ConnectInstagramModal;
