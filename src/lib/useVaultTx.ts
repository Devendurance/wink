"use client";

import { useCallback, useEffect, useState } from "react";
import type { Abi, Address, Hex, TransactionReceipt } from "viem";
import { useConnection, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { mapTxError, type TxError } from "./giftRules";
import { ACTIVE, VAULT_ABI } from "./network";

export type TxPhase =
  | { step: "idle" }
  | { step: "checking" }
  | { step: "signing" }
  | { step: "pending"; hash: Hex }
  | { step: "confirmed"; hash: Hex; receipt: TransactionReceipt }
  | { step: "error"; error: TxError; hash?: Hex };

export interface VaultCall {
  functionName: "createGift" | "claim" | "reclaim";
  args: readonly unknown[];
  value?: bigint;
  /** Runs against the confirmed receipt. Throw to reject it. */
  verify: (receipt: TransactionReceipt) => void;
}

/**
 * One write path for create, claim and reclaim. Steps: switch chain, simulate,
 * ask the wallet to sign, wait for a real receipt, verify the vault event.
 * Nothing reports success until the receipt is verified.
 */
export function useVaultTx() {
  const { address, chainId } = useConnection();
  const publicClient = usePublicClient({ chainId: ACTIVE.chain.id });
  const { data: walletClient } = useWalletClient({ chainId: ACTIVE.chain.id });
  const { mutateAsync: switchChainAsync } = useSwitchChain();
  const [phase, setPhase] = useState<TxPhase>({ step: "idle" });

  const reset = useCallback(() => setPhase({ step: "idle" }), []);

  const run = useCallback(
    async (call: VaultCall): Promise<TransactionReceipt | null> => {
      const vault = ACTIVE.vault;
      if (!vault || !publicClient || !address) {
        setPhase({ step: "error", error: { kind: "unknown", message: "Connect a wallet on the Wink network first." } });
        return null;
      }
      let hash: Hex | undefined;
      try {
        setPhase({ step: "checking" });
        if (chainId !== ACTIVE.chain.id) await switchChainAsync({ chainId: ACTIVE.chain.id });
        const wallet = walletClient;
        if (!wallet) throw new Error("Wallet is not ready. Reconnect and try again.");
        const { request } = await publicClient.simulateContract({
          account: address as Address,
          address: vault,
          abi: VAULT_ABI as Abi,
          functionName: call.functionName,
          args: call.args,
          value: call.value,
        } as never);
        setPhase({ step: "signing" });
        hash = await wallet.writeContract(request as never);
        setPhase({ step: "pending", hash });
        const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
        call.verify(receipt);
        setPhase({ step: "confirmed", hash, receipt });
        return receipt;
      } catch (err) {
        const mapped = err instanceof Error && err.name === "ReceiptError" ? { kind: "unknown" as const, message: err.message } : mapTxError(err);
        setPhase({ step: "error", error: mapped, hash });
        return null;
      }
    },
    [address, chainId, publicClient, walletClient, switchChainAsync]
  );

  return { phase, run, reset };
}

/** Estimated gas cost (wei) for a vault call, or null while unknown. */
export function useGasEstimate(
  call: { functionName: "createGift" | "claim" | "reclaim"; args: readonly unknown[]; value?: bigint } | null
): { cost: bigint | null; loading: boolean } {
  const { address } = useConnection();
  const publicClient = usePublicClient({ chainId: ACTIVE.chain.id });
  const [state, setState] = useState<{ key: string; cost: bigint | null }>({ key: "", cost: null });
  const key = call && address ? JSON.stringify([call.functionName, call.args.map(String), String(call.value ?? 0)]) : "";

  useEffect(() => {
    if (!key || !call || !address || !publicClient || !ACTIVE.vault) return;
    let cancelled = false;
    (async () => {
      try {
        const [gas, price] = await Promise.all([
          publicClient.estimateContractGas({
            account: address as Address,
            address: ACTIVE.vault as Address,
            abi: VAULT_ABI as Abi,
            functionName: call.functionName,
            args: call.args,
            value: call.value,
          } as never),
          publicClient.getGasPrice(),
        ]);
        if (!cancelled) setState({ key, cost: gas * price });
      } catch {
        if (!cancelled) setState({ key, cost: null });
      }
    })();
    return () => {
      cancelled = true;
    };
    // The key captures every input that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, address, publicClient]);

  return { cost: state.key === key ? state.cost : null, loading: !!key && state.key !== key };
}
