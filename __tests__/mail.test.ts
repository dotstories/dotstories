/** @jest-environment node */
jest.mock("server-only", () => ({}));
import { sendCode, sendResetLink } from "../lib/mail";

const fetchMock = jest.fn(async () => Response.json({ data: [{ code: "EM_104", message: "Email request received" }] }, { status: 201 }));
const OLD = { ...process.env };

beforeEach(() => {
  process.env = { ...OLD, ZEPTOMAIL_TOKEN: "abc123" };
  delete process.env.MAIL_LOG;
  fetchMock.mockClear();
  global.fetch = fetchMock as never;
});
afterAll(() => (process.env = OLD));

const sent = () => {
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  return { url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
};

it("sends through Zoho (EU) with the send mail token", async () => {
  await sendCode("ana@example.com", "123456");
  const { url, headers, body } = sent();
  expect(url).toBe("https://cpaas.zoho.eu/v1.1/email");
  expect(headers.Authorization).toBe("Zoho-enczapikey abc123");
  expect(body).toMatchObject({
    from: { address: "noreply@dotstories.com", name: "DotStories" },
    to: [{ email_address: { address: "ana@example.com" } }],
    subject: "123456 is your DotStories code",
  });
  expect(body.htmlbody).toContain("123456");
  expect(body.textbody).toContain("123456");
});

it("a token pasted with its 'Zoho-enczapikey' prefix still works", async () => {
  process.env.ZEPTOMAIL_TOKEN = "Zoho-enczapikey abc123";
  await sendCode("ana@example.com", "123456");
  expect(sent().headers.Authorization).toBe("Zoho-enczapikey abc123");
});

it("reset links point to the site and are escaped", async () => {
  await sendResetLink("ana@example.com", "t<1>");
  const { body } = sent();
  expect(body.htmlbody).toContain("https://dotstories.com/new-password?token=t%3C1%3E");
  expect(body.textbody).toContain("https://dotstories.com/new-password?token=t%3C1%3E");
});

it("MAIL_LOG=1 (local, CI): logged, never sent", async () => {
  process.env.MAIL_LOG = "1";
  const log = jest.spyOn(console, "log").mockImplementation(() => {});
  await sendCode("ana@example.com", "123456");
  expect(fetchMock).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});

it("no token or a refused send: a clear error", async () => {
  delete process.env.ZEPTOMAIL_TOKEN;
  await expect(sendCode("ana@example.com", "1")).rejects.toThrow("Email isn't set up yet");
  process.env.ZEPTOMAIL_TOKEN = "abc123";
  fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "TM_3201" } }, { status: 401 }));
  await expect(sendCode("ana@example.com", "1")).rejects.toThrow("401");
});
