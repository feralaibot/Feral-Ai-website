import { BaseWalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { cn } from "@/lib/utils";

const LABELS = {
  "no-wallet": "Connect Wallet",
  "has-wallet": "Select Wallet",
  connecting: "Connecting...",
  "copy-address": "Copy Address",
  copied: "Copied",
  "change-wallet": "Change Wallet",
  disconnect: "Disconnect",
} as const;

type WalletConnectButtonProps = {
  className?: string;
  children?: never;
};

export function WalletConnectButton({ className }: WalletConnectButtonProps) {
  return (
    <BaseWalletMultiButton
      labels={LABELS}
      className={cn("wallet-adapter-button-reset", className)}
    />
  );
}
