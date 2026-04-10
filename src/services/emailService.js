/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import nodemailer from "nodemailer";

function createEmailService({
  host = process.env.SMTP_HOST,
  port = process.env.SMTP_PORT,
  secure = process.env.SMTP_SECURE,
  user = process.env.SMTP_USER,
  pass = process.env.SMTP_PASS,
  from = process.env.SMTP_FROM || "no-reply@honeybudget.app",
} = {}) {
  const isProduction = process.env.NODE_ENV === "production";
  const hasSmtpConfig = Boolean(host && port && from);

  if (!hasSmtpConfig) {
    return {
      isPreviewMode: true,
      async sendPasswordResetEmail({ to, name, resetUrl }) {
        console.log(
          `[password-reset-preview] to=${to} name=${name ?? ""} resetUrl=${resetUrl}`,
        );

        return {
          delivered: false,
          preview: true,
          resetUrl,
        };
      },
    };
  }

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

      return {
        delivered: true,
        preview: false,
      };
    },
  };
}

export { createEmailService };
