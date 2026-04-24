/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { ChevronLeft, ShieldCheck } from "lucide-react";

function Section({ title, children }) {
  return (
    <div>
      <h2 className="mb-2 text-base font-semibold text-slate-900">{title}</h2>
      <div className="space-y-2 text-sm leading-6 text-slate-600">{children}</div>
    </div>
  );
}

function PrivacyPolicyPage({ onBack }) {
  return (
    <div className="hb-surface-card rounded-[2rem] p-6 sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        {onBack && (
          <button
            className="hb-button-secondary shrink-0 rounded-[1rem] p-2.5 transition"
            onClick={onBack}
            type="button"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-slate-700" />
          <h1 className="text-2xl font-semibold">Privacy Policy</h1>
        </div>
      </div>

      <p className="mb-6 text-xs text-slate-500">Effective date: April 24, 2026 · Honey Budget by Whitzy</p>

      <div className="space-y-6">
        <Section title="1. Information We Collect">
          <p>When you use Honey Budget, we collect:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li><strong>Account information</strong> — your name and email address when you register</li>
            <li><strong>Financial data</strong> — income amounts, expenses, savings goals, recurring bills, and budget categories you enter into the app</li>
            <li><strong>Household data</strong> — if you link a partner, their name and your shared financial entries are visible to both of you</li>
          </ul>
          <p>We do not collect bank account numbers, credit card numbers, or any payment credentials.</p>
        </Section>

        <Section title="2. How We Use Your Information">
          <p>We use your information solely to:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Provide and operate the Honey Budget service</li>
            <li>Generate AI-powered financial insights and coaching through the in-app Coach feature</li>
            <li>Send transactional emails such as password resets and partner invite notifications</li>
          </ul>
        </Section>

        <Section title="3. Data Sharing">
          <p>We do not sell your personal data to anyone. Data is shared only in these limited cases:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li><strong>With your linked partner</strong> — both partners can view shared household financial data within the app</li>
            <li><strong>With service providers</strong> — we use Render (hosting), and Resend (email delivery). These providers process data only on our behalf</li>
            <li><strong>AI processing</strong> — when you use Coach Chat, a financial summary is sent to Groq or Google Gemini APIs to generate responses. No bank credentials or passwords are transmitted. Please review Groq's and Google's privacy policies for details on how they handle data</li>
          </ul>
        </Section>

        <Section title="4. Data Storage and Security">
          <p>Your data is stored on secure servers hosted by Render. All data is transmitted using HTTPS encryption. Passwords are hashed using industry-standard algorithms and are never stored in plain text.</p>
        </Section>

        <Section title="5. Data Retention and Deletion">
          <p>You may request deletion of your account and all associated data at any time by emailing us at <strong>whitzytraiding@gmail.com</strong>. We will process all deletion requests within 30 days.</p>
        </Section>

        <Section title="6. Children's Privacy">
          <p>Honey Budget is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us and we will delete it promptly.</p>
        </Section>

        <Section title="7. Changes to This Policy">
          <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by updating the effective date above or through an in-app notice.</p>
        </Section>

        <Section title="8. Contact Us">
          <p>If you have any questions about this Privacy Policy, please contact us at:</p>
          <p className="font-medium text-slate-800">whitzytraiding@gmail.com</p>
        </Section>
      </div>
    </div>
  );
}

export default PrivacyPolicyPage;
