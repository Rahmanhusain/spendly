import logger from "./logger";

type SendEmailOpts = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(opts: SendEmailOpts): Promise<void> {
  // Best-effort stubbed mailer. Reads env to decide whether to attempt sending.
  const provider = process.env.EMAIL_PROVIDER || "none";

  if (provider === "none" || provider === "") {
    logger.info("Mailer disabled - skipping send", {
      to: opts.to,
      subject: opts.subject,
    });
    return;
  }

  // If real providers are configured, implement their SDK integration here.
  // For now, just log the send attempt.
  logger.info("Sending email (stub)", { to: opts.to, subject: opts.subject });

  // TODO: Integrate SendGrid / SES / SMTP based on EMAIL_PROVIDER env.
}

export default sendEmail;
