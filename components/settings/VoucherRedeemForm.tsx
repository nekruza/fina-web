"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface VoucherRedeemFormProps {
  /** Called after a successful redeem so the caller can refetch the profile. */
  onRedeemed: () => void;
}

export function VoucherRedeemForm({ onRedeemed }: VoucherRedeemFormProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || redeeming) return;
    setRedeeming(true);
    setError(null);
    try {
      const res = await fetch("/api/vouchers/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not redeem the code. Please try again.");
        return;
      }
      setCode("");
      toast.success("Code redeemed — welcome to Fina Pro!");
      onRedeemed();
    } catch {
      setError("Could not redeem the code. Please try again.");
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 border-t border-line pt-5" noValidate>
      <label htmlFor="voucher-code" className="text-[11px] font-semibold uppercase tracking-[0.1em] text-sub">
        Have a voucher code?
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id="voucher-code"
          name="voucherCode"
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError(null);
          }}
          placeholder="FINA-XXXX-XXXX"
          maxLength={40}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? "voucher-code-error" : undefined}
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 font-mono text-sm uppercase text-ink placeholder:font-sans placeholder:normal-case placeholder:text-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand sm:max-w-xs"
        />
        <button
          type="submit"
          disabled={!code.trim() || redeeming}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink transition hover:border-sub/40 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
        >
          {redeeming && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {redeeming ? "Redeeming…" : "Redeem"}
        </button>
      </div>
      {error && (
        <p id="voucher-code-error" role="alert" className="mt-1.5 text-xs text-hot">
          {error}
        </p>
      )}
    </form>
  );
}
