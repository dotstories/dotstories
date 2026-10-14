import "server-only";

/**
 * Emails go out through ZeptoMail (Zoho), EU data center. Prepaid credits: no surprise bills.
 * ZEPTOMAIL_TOKEN = the agent's "Send Mail Token". MAIL_LOG=1 (local, tests): logged instead of sent.
 */
const API = () => process.env.ZEPTOMAIL_API ?? "https://cpaas.zoho.eu/v1.1/email";
const FROM = { address: process.env.MAIL_FROM ?? "noreply@dotstories.com", name: "DotStories" };
const SITE = () => process.env.SITE_URL ?? "https://dotstories.com";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const layout = (body: string) => `<!doctype html><html><body style="margin:0;background:#161616;font-family:Arial,sans-serif;color:#f4f4f4">
<div style="max-width:480px;margin:0 auto;padding:32px 24px">
<p style="font-size:20px;font-weight:600;margin:0 0 24px">DotStories</p>${body}
<p style="color:#8d8d8d;font-size:12px;margin-top:32px">If you didn't ask for this, you can ignore this email.</p>
</div></body></html>`;
const FOOTER = "\n\nIf you didn't ask for this, you can ignore this email.";

async function send(to: string, subject: string, html: string, text: string) {
  if (process.env.MAIL_LOG === "1") {
    console.log(`[mail] to=${to} subject=${subject}`);
    return;
  }
  const token = process.env.ZEPTOMAIL_TOKEN?.replace(/^Zoho-enczapikey\s+/i, "").trim();
  if (!token) throw new Error("Email isn't set up yet. Please try again later.");
  const res = await fetch(API(), {
    method: "POST",
    headers: { Authorization: `Zoho-enczapikey ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [{ email_address: { address: to } }],
      subject,
      htmlbody: html,
      textbody: text + FOOTER,
    }),
  });
  if (!res.ok) throw new Error(`Could not send the email (${res.status}).`);
}

export const sendCode = (to: string, code: string) =>
  send(
    to,
    `${code} is your DotStories code`,
    layout(`<p>Your code:</p><p style="font-size:32px;letter-spacing:8px;font-weight:600">${esc(code)}</p>
<p style="color:#c6c6c6">It works for 10 minutes.</p>`),
    `Your DotStories code: ${code}\nIt works for 10 minutes.`,
  );

export const sendResetLink = (to: string, token: string) => {
  const url = `${SITE()}/new-password?token=${encodeURIComponent(token)}`;
  return send(
    to,
    "Reset your DotStories password",
    layout(`<p>Choose a new password:</p>
<p><a href="${esc(url)}" style="display:inline-block;background:#0f62fe;color:#fff;padding:12px 20px;text-decoration:none">Reset password</a></p>
<p style="color:#c6c6c6">The link works for 30 minutes.</p>`),
    `Choose a new DotStories password:\n${url}\nThe link works for 30 minutes.`,
  );
};
