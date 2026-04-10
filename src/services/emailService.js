/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import nodemailer from "nodemailer";

// ---------------------------------------------------------------------------
// Resend HTTP API (preferred when RESEND_API_KEY is set)
// ---------------------------------------------------------------------------
function createResendEmailService({ apiKey, from }) {
  return {
    isPreviewMode: false,
    async sendPasswordResetEmail({ to, name, resetUrl }) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: "Reset your Honey Budget password",
          text: [
            `Hi ${name || "there"},`,
            "",
            "We received a request to reset your Honey Budget password.",
            `Open this link to choose a new password: ${resetUrl}`,
            "",
            "If you did not request this, you can ignore this email.",
          ].join("\n"),
          html: `
            <p>Hi ${name || "there"},</p>
            <p>We received a request to reset your Honey Budget password.</p>
            <p><a href="${resetUrl}">Open this link to choose a new password</a></p>
            <p>If you did not request this, you can ignore this email.</p>
          `,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend API error ${response.status}: ${body}`);
      }

      return { delivered: true, preview: false };
    },
  };
}

// ---------------------------------------------------------------------------
// SMTP fallback (nodemailer)
// ---------------------------------------------------------------------------
function createSmtpEmailService({ host, port, secure, user, pass, from }) {
  const transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: String(secure).toLowerCase() === "true",
    auth: user && pass ? { user, pass } : undefined,
  });

  return {
    isPreviewMode: false,
    async sendPasswordResetEmail({ to, name, resetUrl }) {
      await transporter.sendMail({
        from,
        to,
        subject: "Reset your Honey Budget password",
        text: [
          `Hi ${name || "there"},`,
          "",
          "We received a request to reset your Honey Budget password.",
          `Open this link to choose a new password: ${resetUrl}`,
          "",
          "If you did not request this, you can ignore this email.",
        ].join("\n"),
        html: `
          <p>Hi ${name || "there"},</p>
          <p>We received a request to reset your Honey Budget password.</p>
          <p><a href="${resetUrl}">Open this link to choose a new password</a></p>
          <p>If you did not request this, you can ignore this email.</p>
        `,
      });

      return { delivered: true, preview: false };
    },
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
function createEmailService({
  resendApiKey = process.env.RESEND_API_KEY,
  host = process.env.SMTP_HOST,
  port = process.env.SMTP_PORT,
  secure = process.env.SMTP_SECURE,
  user = process.env.SMTP_USER,
  pass = process.env.SMTP_PASS,
  from = process.env.SMTP_FROM || "Honey Budget <onboarding@resend.dev>",
} = {}) {
  // 1. Resend API key — simplest, most reliable
  if (resendApiKey) {
    console.log("[emailService] Using Resend HTTP API");
    return createResendEmailService({ apiKey: resendApiKey, from });
  }

  // 2. SMTP (nodemailer)
  if (host && port) {
    console.log("[emailService] Using SMTP:", host);
    return createSmtpEmailService({ host, port, secure, user, pass, from });
  }

  // 3. Preview mode — logs reset URL to console, returns it in API response
  console.warn("[emailService] No email config found — running in preview mode");
  return {
    isPreviewMode: true,
    async sendPasswordResetEmail({ to, name, resetUrl }) {
      console.log(
        `[password-reset-preview] to=${to} name=${name ?? ""} resetUrl=${resetUrl}`,
      );
      return { delivered: false, preview: true, resetUrl };
    },
  };
}

export { createEmailService };
