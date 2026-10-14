/** @jest-environment node */
import { fetchUsage, opClass, periodStart } from "../../workers/budget-guard/src/usage";

const reply = (data: unknown, errors: unknown = null, status = 200) =>
  jest.fn(async () => new Response(JSON.stringify({ data, errors }), { status }));

const accounts = {
  viewer: {
    accounts: [
      {
        storage: [
          { max: { payloadSize: 12e9, metadataSize: 1e9 }, dimensions: { bucketName: "dotstories-files" } },
          { max: { payloadSize: 2e9, metadataSize: 0 }, dimensions: { bucketName: "other" } },
        ],
        ops: [
          { sum: { requests: 700 }, dimensions: { actionType: "PutObject" } },
          { sum: { requests: 300 }, dimensions: { actionType: "ListObjects" } },
          { sum: { requests: 5000 }, dimensions: { actionType: "GetObject" } },
          { sum: { requests: 50 }, dimensions: { actionType: "HeadObject" } },
          { sum: { requests: 99 }, dimensions: { actionType: "DeleteObject" } },
          { sum: { requests: 1 }, dimensions: { actionType: "SomethingNew" } },
        ],
      },
    ],
  },
};
const args = { accountId: "acc", token: "t", from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-10-14T12:00:00Z") };

it("sums storage of every bucket and splits operations into Class A / B; free ones don't count", async () => {
  const f = reply(accounts);
  expect(await fetchUsage({ ...args, fetch: f })).toEqual({ storageGB: 15, opsA: 1001, opsB: 5050, workerRequests: 0 });

  const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("https://api.cloudflare.com/client/v4/graphql");
  expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t");
  const body = JSON.parse(String(init.body));
  expect(body.variables).toEqual({ accountTag: "acc", from: "2026-10-01T00:00:00.000Z", to: "2026-10-14T12:00:00.000Z" });
  expect(body.query).not.toContain("workersInvocationsAdaptive");
});

it("counts Worker requests when on the paid plan", async () => {
  const f = reply({ viewer: { accounts: [{ ...accounts.viewer.accounts[0], workers: [{ sum: { requests: 42 } }] }] } });
  expect((await fetchUsage({ ...args, workersPaid: true, fetch: f })).workerRequests).toBe(42);
  expect(JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body)).query).toContain("workersInvocationsAdaptive");
});

it("no R2 yet: everything is zero", async () => {
  expect(await fetchUsage({ ...args, fetch: reply({ viewer: { accounts: [{ storage: [], ops: [] }] } }) })).toEqual({
    storageGB: 0,
    opsA: 0,
    opsB: 0,
    workerRequests: 0,
  });
});

it("GraphQL errors, HTTP errors and missing accounts throw", async () => {
  await expect(fetchUsage({ ...args, fetch: reply(null, [{ message: "not authorized" }]) })).rejects.toThrow("not authorized");
  await expect(fetchUsage({ ...args, fetch: reply(accounts, null, 500) })).rejects.toThrow("500");
  await expect(fetchUsage({ ...args, fetch: reply({ viewer: { accounts: [] } }) })).rejects.toThrow("account");
});

it("operation classes follow the R2 price list; unknown ones count as Class A", () => {
  expect(opClass("PutObject")).toBe("A");
  expect(opClass("CompleteMultipartUpload")).toBe("A");
  expect(opClass("GetObject")).toBe("B");
  expect(opClass("HeadBucket")).toBe("B");
  expect(opClass("DeleteObject")).toBe("free");
  expect(opClass("AbortMultipartUpload")).toBe("free");
  expect(opClass("Whatever")).toBe("A");
});

it("the billing period starts on the billing day (UTC), this month or the last", () => {
  expect(periodStart(new Date("2026-10-14T12:00:00Z"), 1).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  expect(periodStart(new Date("2026-10-14T12:00:00Z"), 20).toISOString()).toBe("2026-09-20T00:00:00.000Z");
  expect(periodStart(new Date("2026-10-20T00:00:00Z"), 20).toISOString()).toBe("2026-10-20T00:00:00.000Z");
  expect(periodStart(new Date("2026-03-10T00:00:00Z"), 31).toISOString()).toBe("2026-02-28T00:00:00.000Z"); // short month
});
