"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, Copy, Loader2, RefreshCw } from "lucide-react";
import {
  DEFAULT_VOUCHER_DAYS,
  generateVoucherCode,
  voucherState,
  type VoucherCodeRow,
} from "@/lib/vouchers";

interface Redemption {
  userId: string;
  email: string | null;
  redeemedAt: string;
  proUntil: string;
}

const STATE_LABELS: Record<ReturnType<typeof voucherState>, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-accent-soft text-accent-brand" },
  scheduled: { label: "Scheduled", className: "bg-cream text-ink" },
  disabled: { label: "Disabled", className: "bg-cream text-sub" },
  expired: { label: "Expired", className: "bg-hot/10 text-hot" },
  used_up: { label: "Used up", className: "bg-hot/10 text-hot" },
};

const FIELD =
  "mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink placeholder:text-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand";
const LABEL = "text-[11px] font-semibold uppercase tracking-[0.1em] text-sub";
const SECONDARY_BUTTON =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink transition hover:border-sub/40 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** ISO → the `YYYY-MM-DDTHH:mm` local-time string a datetime-local input expects. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value (local time) → ISO, or null when blank. */
function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function parseLimit(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

async function sendJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

function CreateVoucherForm({ onCreated }: { onCreated: (v: VoucherCodeRow) => void }) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [durationDays, setDurationDays] = useState(String(DEFAULT_VOUCHER_DAYS));
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const { voucher } = await sendJson<{ voucher: VoucherCodeRow }>("/api/admin/vouchers", "POST", {
        code: code.trim() || undefined,
        description: description.trim() || null,
        durationDays: Number(durationDays),
        maxRedemptions: parseLimit(maxRedemptions),
        startsAt: fromLocalInput(startsAt),
        expiresAt: fromLocalInput(expiresAt),
      });
      onCreated(voucher);
      toast.success(`Created ${voucher.code}`);
      setCode("");
      setDescription("");
      setMaxRedemptions("");
      setStartsAt("");
      setExpiresAt("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create voucher");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <h2 className="font-display text-xl text-ink">New code</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="voucher-new-code" className={LABEL}>
            Code
          </label>
          <div className="flex gap-2">
            <input
              id="voucher-new-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Blank = random code"
              maxLength={40}
              autoComplete="off"
              spellCheck={false}
              className={`${FIELD} font-mono placeholder:font-sans`}
            />
            <button
              type="button"
              onClick={() => setCode(generateVoucherCode())}
              aria-label="Generate a random code"
              className="mt-2 inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-line text-sub transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <p className="mt-1.5 text-xs text-sub">4–40 letters, digits, - or _. Can&apos;t be changed later.</p>
        </div>
        <div>
          <label htmlFor="voucher-new-description" className={LABEL}>
            Note (only admins see this)
          </label>
          <input
            id="voucher-new-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Podcast listeners, Oct 2026"
            maxLength={200}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="voucher-new-duration" className={LABEL}>
            Free Pro for (days)
          </label>
          <input
            id="voucher-new-duration"
            type="number"
            min={1}
            max={3650}
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            className={FIELD}
          />
          <p className="mt-1.5 text-xs text-sub">365 = one year. Counted from when each user redeems.</p>
        </div>
        <div>
          <label htmlFor="voucher-new-limit" className={LABEL}>
            Max uses
          </label>
          <input
            id="voucher-new-limit"
            type="number"
            min={1}
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            placeholder="Blank = unlimited"
            className={FIELD}
          />
          <p className="mt-1.5 text-xs text-sub">Total people who can redeem it. Each person can use a code once.</p>
        </div>
        <div>
          <label htmlFor="voucher-new-starts" className={LABEL}>
            Valid from (optional)
          </label>
          <input
            id="voucher-new-starts"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="voucher-new-expires" className={LABEL}>
            Redeem by (optional)
          </label>
          <input
            id="voucher-new-expires"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={FIELD}
          />
          <p className="mt-1.5 text-xs text-sub">Last moment the code can be redeemed, not when Pro ends.</p>
        </div>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent-brand px-6 text-sm font-semibold text-cream transition hover:bg-accent-brand/90 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {saving ? "Creating…" : "Create code"}
      </button>
    </form>
  );
}

function VoucherDetails({
  voucher,
  onChanged,
  onDeleted,
}: {
  voucher: VoucherCodeRow;
  onChanged: (v: VoucherCodeRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [redemptions, setRedemptions] = useState<Redemption[] | null>(null);
  const [description, setDescription] = useState(voucher.description ?? "");
  const [maxRedemptions, setMaxRedemptions] = useState(voucher.max_redemptions?.toString() ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(voucher.starts_at));
  const [expiresAt, setExpiresAt] = useState(toLocalInput(voucher.expires_at));
  const [busy, setBusy] = useState<"save" | "toggle" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    sendJson<{ redemptions: Redemption[] }>(`/api/admin/vouchers/${voucher.id}`, "GET")
      .then((r) => !cancelled && setRedemptions(r.redemptions))
      .catch(() => !cancelled && setRedemptions([]));
    return () => {
      cancelled = true;
    };
  }, [voucher.id, voucher.redemption_count]);

  async function patch(body: Record<string, unknown>, kind: "save" | "toggle") {
    setBusy(kind);
    try {
      const { voucher: updated } = await sendJson<{ voucher: VoucherCodeRow }>(
        `/api/admin/vouchers/${voucher.id}`,
        "PATCH",
        body
      );
      onChanged(updated);
      toast.success(kind === "toggle" ? (updated.active ? "Code activated" : "Code deactivated") : "Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy("delete");
    try {
      await sendJson(`/api/admin/vouchers/${voucher.id}`, "DELETE");
      onDeleted(voucher.id);
      toast.success(`Deleted ${voucher.code}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
      setBusy(null);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="border-t border-line bg-cream/45 px-5 py-5 sm:px-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`voucher-${voucher.id}-description`} className={LABEL}>
            Note
          </label>
          <input
            id={`voucher-${voucher.id}-description`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor={`voucher-${voucher.id}-limit`} className={LABEL}>
            Max uses
          </label>
          <input
            id={`voucher-${voucher.id}-limit`}
            type="number"
            min={Math.max(1, voucher.redemption_count)}
            value={maxRedemptions}
            onChange={(e) => setMaxRedemptions(e.target.value)}
            placeholder="Unlimited"
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor={`voucher-${voucher.id}-starts`} className={LABEL}>
            Valid from
          </label>
          <input
            id={`voucher-${voucher.id}-starts`}
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor={`voucher-${voucher.id}-expires`} className={LABEL}>
            Redeem by
          </label>
          <input
            id={`voucher-${voucher.id}-expires`}
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className={FIELD}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            patch(
              {
                description: description.trim() || null,
                maxRedemptions: parseLimit(maxRedemptions),
                startsAt: fromLocalInput(startsAt),
                expiresAt: fromLocalInput(expiresAt),
              },
              "save"
            )
          }
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-cream transition hover:bg-ink/90 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
        >
          {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Save changes
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => patch({ active: !voucher.active }, "toggle")}
          className={SECONDARY_BUTTON}
        >
          {busy === "toggle" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {voucher.active ? "Deactivate" : "Activate"}
        </button>
        {voucher.redemption_count === 0 && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={handleDelete}
            onBlur={() => setConfirmDelete(false)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-hot/30 bg-surface px-5 text-sm font-semibold text-hot transition hover:bg-hot/10 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hot"
          >
            {busy === "delete" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {confirmDelete ? "Click again to delete" : "Delete"}
          </button>
        )}
      </div>

      <h3 className="mt-7 text-[11px] font-semibold uppercase tracking-[0.1em] text-sub">
        Redeemed by ({voucher.redemption_count})
      </h3>
      {redemptions === null ? (
        <Loader2 className="mt-3 h-4 w-4 animate-spin text-sub" aria-label="Loading redemptions" />
      ) : redemptions.length === 0 ? (
        <p className="mt-2 text-sm text-sub">Nobody has used this code yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
          {redemptions.map((r) => (
            <li key={r.userId} className="flex flex-col gap-0.5 px-4 py-3 text-sm sm:flex-row sm:justify-between">
              <span className="min-w-0 truncate text-ink">{r.email ?? r.userId}</span>
              <span className="shrink-0 text-sub">
                {formatDate(r.redeemedAt)} · Pro until {formatDate(r.proUntil)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn't copy");
        }
      }}
      aria-label={`Copy ${text}`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sub transition hover:bg-cream hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
    >
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
    </button>
  );
}

export function VoucherAdmin() {
  const [vouchers, setVouchers] = useState<VoucherCodeRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // State is only set in the promise callbacks, never synchronously, so this
  // is safe to call from the mount effect.
  const load = useCallback(
    () =>
      sendJson<{ vouchers: VoucherCodeRow[] }>("/api/admin/vouchers", "GET")
        .then(({ vouchers }) => {
          setLoadError(false);
          setVouchers(vouchers);
        })
        .catch(() => setLoadError(true)),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const replace = (v: VoucherCodeRow) => setVouchers((list) => list?.map((x) => (x.id === v.id ? v : x)) ?? [v]);

  return (
    <div className="mx-auto max-w-[1100px] pb-16">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-brand">Admin</p>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">Voucher codes</h1>
        <p className="mt-2 max-w-[60ch] text-base text-sub">
          Codes give free Fina Pro without a card. Users redeem them in Settings → Subscription. Pro doesn&apos;t
          renew when the period ends.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-6">
        <CreateVoucherForm
          onCreated={(v) => {
            setVouchers((list) => [v, ...(list ?? [])]);
            setExpandedId(v.id);
          }}
        />

        <section className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex items-center justify-between px-6 py-5 sm:px-8">
            <h2 className="font-display text-xl text-ink">All codes</h2>
            <button type="button" onClick={() => void load()} className={SECONDARY_BUTTON}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh
            </button>
          </div>

          {loadError ? (
            <p role="alert" className="border-t border-line px-6 py-8 text-sm text-hot sm:px-8">
              Couldn&apos;t load vouchers. Has the vouchers migration been applied?
            </p>
          ) : vouchers === null ? (
            <div className="flex justify-center border-t border-line py-10">
              <Loader2 className="h-5 w-5 animate-spin text-sub" aria-label="Loading vouchers" />
            </div>
          ) : vouchers.length === 0 ? (
            <p className="border-t border-line px-6 py-8 text-sm text-sub sm:px-8">No codes yet.</p>
          ) : (
            <ul>
              {vouchers.map((v) => {
                const state = STATE_LABELS[voucherState(v)];
                const expanded = expandedId === v.id;
                return (
                  <li key={v.id} className="border-t border-line">
                    <div className="flex items-center gap-2 px-4 py-4 sm:px-6">
                      <CopyButton text={v.code} />
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : v.id)}
                        aria-expanded={expanded}
                        className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand sm:flex-row sm:items-center sm:gap-4"
                      >
                        <span className="min-w-0 sm:w-56">
                          <span className="block truncate font-mono text-sm font-semibold text-ink">{v.code}</span>
                          {v.description && <span className="block truncate text-xs text-sub">{v.description}</span>}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-sub sm:flex-1">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${state.className}`}
                          >
                            {state.label}
                          </span>
                          <span className="tabular-nums">
                            {v.redemption_count} / {v.max_redemptions ?? "∞"} used
                          </span>
                          <span>{v.duration_days} days Pro</span>
                          {v.expires_at && <span>Redeem by {formatDate(v.expires_at)}</span>}
                        </span>
                        <ChevronDown
                          className={`hidden h-4 w-4 shrink-0 text-sub transition-transform sm:block ${expanded ? "rotate-180" : ""}`}
                          aria-hidden
                        />
                      </button>
                    </div>
                    {expanded && (
                      <VoucherDetails
                        voucher={v}
                        onChanged={replace}
                        onDeleted={(id) => {
                          setVouchers((list) => list?.filter((x) => x.id !== id) ?? null);
                          setExpandedId(null);
                        }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
