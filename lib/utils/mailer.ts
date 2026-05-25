import logger from "./logger";
import { Resend } from "resend";
import fs from "fs/promises";
import path from "path";

type TemplateData = Record<string, string | number | boolean | undefined>;

type SendEmailOpts = {
  to: string;
  subject: string;
  from?: string; // optional override; falls back to RESEND_FROM_EMAIL env var
  text?: string;
  html?: string;
  templateName?: string; // name without extension, e.g. 'signup-otp'
  templateData?: TemplateData;
};

function interpolate(template: string, data: TemplateData = {}) {
  return template.replace(/{{\s*([a-zA-Z0-9_\.]+)\s*}}/g, (_, key) => {
    const v = (data as any)[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

async function loadTemplate(name: string) {
  const base = path.join(process.cwd(), "lib", "Email.templates");
  const htmlPath = path.join(base, `${name}.html`);
  const txtPath = path.join(base, `${name}.txt`);

  const [html, txt] = await Promise.all([
    fs.readFile(htmlPath, "utf8").catch(() => null),
    fs.readFile(txtPath, "utf8").catch(() => null),
  ]);

  return { html, text: txt };
}

export async function sendEmail(opts: SendEmailOpts): Promise<void> {
  const provider = (process.env.EMAIL_PROVIDER || "none").toLowerCase();
  const resendApiKey = process.env.RESEND_API_KEY;

  if ((provider === "none" || provider === "") && !resendApiKey) {
    logger.info("Mailer disabled - skipping send", {
      to: opts.to,
      subject: opts.subject,
    });
    return;
  }

  if (provider === "resend" || resendApiKey) {
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured.");
    }

    const resend = new Resend(resendApiKey);
    const from =
      opts.from ||
      process.env.RESEND_FROM_EMAIL ||
      "Spendly <onboarding@resend.dev>";

    let html = opts.html;
    let text = opts.text;

    if (opts.templateName) {
      const loaded = await loadTemplate(opts.templateName);
      if (loaded.html) html = interpolate(loaded.html, opts.templateData);
      if (loaded.text) text = interpolate(loaded.text, opts.templateData);
    }

    // Resend SDK types can be strict about template vs html/text shapes.
    // Cast to any here to avoid TypeScript incompatibilities while preserving runtime behavior.
    await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html,
      text,
    } as any);

    logger.info("Email sent via Resend", {
      to: opts.to,
      subject: opts.subject,
      from,
    });
    return;
  }

  logger.warn("Unknown EMAIL_PROVIDER configured - skipping send", {
    provider,
    to: opts.to,
    subject: opts.subject,
  });
}

export default sendEmail;
