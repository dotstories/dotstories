// Month-to-date usage of the whole account, from the GraphQL Analytics API.
import type { Usage } from "./cost.ts";

// https://developers.cloudflare.com/r2/pricing/ (checked 2026-10-14). Anything else counts as Class A.
const CLASS_B = new Set([
  "HeadBucket",
  "HeadObject",
  "GetObject",
  "UsageSummary",
  "GetBucketEncryption",
  "GetBucketLocation",
  "GetBucketCors",
  "GetBucketLifecycleConfiguration",
]);
const FREE = new Set(["DeleteObject", "DeleteBucket", "AbortMultipartUpload"]);

export const opClass = (action: string) => (FREE.has(action) ? "free" : CLASS_B.has(action) ? "B" : "A");

/** Start of the billing period (UTC midnight). A day past the month's end means its last day. */
export function periodStart(now: Date, billingDay: number): Date {
  const start = (year: number, month: number) => {
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(billingDay, last)));
  };
  const thisMonth = start(now.getUTCFullYear(), now.getUTCMonth());
  return thisMonth <= now ? thisMonth : start(now.getUTCFullYear(), now.getUTCMonth() - 1);
}

type Row = { sum?: { requests: number }; max?: { payloadSize: number; metadataSize: number }; dimensions?: { actionType?: string } };

function query(workersPaid: boolean) {
  const range = "filter: { datetime_geq: $from, datetime_leq: $to }";
  return `query Usage($accountTag: string!, $from: Time!, $to: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      storage: r2StorageAdaptiveGroups(limit: 1000, ${range}) { max { payloadSize metadataSize } dimensions { bucketName } }
      ops: r2OperationsAdaptiveGroups(limit: 1000, ${range}) { sum { requests } dimensions { actionType } }
      ${workersPaid ? `workers: workersInvocationsAdaptive(limit: 1, ${range}) { sum { requests } }` : ""}
    }
  }
}`;
}

export async function fetchUsage(args: {
  accountId: string;
  token: string;
  from: Date;
  to: Date;
  workersPaid?: boolean;
  fetch?: typeof fetch;
}): Promise<Usage> {
  const { accountId, token, from, to, workersPaid = false, fetch: f = fetch } = args;
  const res = await f("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: query(workersPaid),
      variables: { accountTag: accountId, from: from.toISOString(), to: to.toISOString() },
    }),
  });
  if (!res.ok) throw new Error(`Analytics API: HTTP ${res.status}`);
  const json = (await res.json()) as { data?: { viewer?: { accounts?: Record<string, Row[]>[] } }; errors?: { message: string }[] | null };
  if (json.errors?.length) throw new Error(`Analytics API: ${json.errors.map((e) => e.message).join("; ")}`);
  const account = json.data?.viewer?.accounts?.[0];
  if (!account) throw new Error("Analytics API: no data for this account");

  const usage: Usage = { storageGB: 0, opsA: 0, opsB: 0, workerRequests: 0 };
  for (const r of account.storage ?? []) usage.storageGB += ((r.max?.payloadSize ?? 0) + (r.max?.metadataSize ?? 0)) / 1e9;
  for (const r of account.ops ?? []) {
    const kind = opClass(r.dimensions?.actionType ?? "");
    if (kind === "A") usage.opsA += r.sum?.requests ?? 0;
    if (kind === "B") usage.opsB += r.sum?.requests ?? 0;
  }
  for (const r of account.workers ?? []) usage.workerRequests += r.sum?.requests ?? 0;
  return usage;
}
