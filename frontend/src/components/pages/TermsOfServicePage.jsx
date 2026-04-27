/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { ChevronLeft, FileText } from "lucide-react";

function Section({ title, children }) {
  return (
    <div>
      <h2 className="mb-2 text-base font-semibold text-slate-900">{title}</h2>
      <div className="space-y-2 text-sm leading-6 text-slate-600">{children}</div>
    </div>
  );
}

function TermsOfServicePage({ onBack }) {
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
          <FileText className="h-5 w-5 text-slate-700" />
          <h1 className="text-2xl font-semibold">Terms of Service</h1>
        </div>
      </div>

      <p className="mb-6 text-xs text-slate-500">Effective date: April 27, 2026 · Honey Budget by Whitzy</p>

      <div className="space-y-6">
        <Section title="1. Acceptance of Terms">
          <p>By creating an account or using Honey Budget ("the Service"), you agree to these Terms of Service. If you do not agree, do not use the Service.</p>
        </Section>

        <Section title="2. The Service">
          <p>Honey Budget is a personal finance management application for individuals and couples. We offer a free tier and a Pro subscription plan. Features may change over time as we improve the product.</p>
        </Section>

        <Section title="3. Account Registration">
          <p>To use the Service you must create an account. You agree to:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Provide accurate and complete information when registering</li>
            <li>Keep your password secure and not share it with anyone</li>
            <li>Be at least 13 years old to use the Service</li>
            <li>Maintain one account per person — accounts may not be shared</li>
          </ul>
          <p>You are responsible for all activity that occurs under your account.</p>
        </Section>

        <Section title="4. Subscription and Payments">
          <p>Honey Budget Pro is a paid subscription ($5 USD/month). Your linked partner's account is included at no additional cost.</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Subscriptions are billed monthly through the Apple App Store</li>
            <li>Subscriptions automatically renew unless cancelled at least 24 hours before the renewal date</li>
            <li>To cancel, manage your subscription through your Apple ID account settings</li>
            <li>Refunds are handled by Apple in accordance with their refund policy</li>
            <li>We reserve the right to change pricing with reasonable notice</li>
          </ul>
        </Section>

        <Section title="5. Your Data">
          <p>You own the financial data you enter into Honey Budget. By using the Service, you grant us a limited licence to store and process that data solely to provide the Service to you. We do not sell your data. See our Privacy Policy for full details on how your data is handled.</p>
        </Section>

        <Section title="6. Household and Partner Sharing">
          <p>When you link a partner, both accounts share visibility of household financial data within the app. Each user remains responsible for entries they create. You may unlink your partner at any time through Settings.</p>
        </Section>

        <Section title="7. AI Features">
          <p>The Coach Chat and Money Cat features use third-party AI services (Groq, Google Gemini) to generate responses. AI-generated content is for informational and motivational purposes only — it does not constitute certified financial advice. Always consult a qualified financial professional for important financial decisions.</p>
        </Section>

        <Section title="8. Prohibited Uses">
          <p>You agree not to:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Use the Service for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to other accounts or our servers</li>
            <li>Reverse engineer, decompile, or copy any part of the Service</li>
            <li>Use automated tools to scrape or abuse the Service</li>
            <li>Upload or transmit harmful, offensive, or malicious content</li>
          </ul>
        </Section>

        <Section title="9. Disclaimer of Warranties">
          <p>The Service is provided "as is" and "as available" without warranties of any kind, express or implied. We do not guarantee that the Service will be uninterrupted, error-free, or completely secure. Use of the Service is at your own risk.</p>
        </Section>

        <Section title="10. Limitation of Liability">
          <p>To the fullest extent permitted by applicable law, Whitzy shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of or inability to use the Service. Our total cumulative liability for any claim shall not exceed the amount you paid us in the 12 months prior to the claim.</p>
        </Section>

        <Section title="11. Termination">
          <p>We may suspend or terminate your account if you violate these Terms. You may delete your account at any time by contacting us at <strong>whitzytraiding@gmail.com</strong>. Upon termination, your data will be deleted within 30 days.</p>
        </Section>

        <Section title="12. Changes to These Terms">
          <p>We may update these Terms of Service from time to time. We will notify you of significant changes by updating the effective date above or through an in-app notice. Your continued use of the Service after changes are posted constitutes acceptance of the updated terms.</p>
        </Section>

        <Section title="13. Governing Law">
          <p>These Terms are governed by applicable law. Any disputes shall be resolved through good-faith negotiation before any formal legal proceedings are initiated.</p>
        </Section>

        <Section title="14. Contact Us">
          <p>If you have questions about these Terms of Service, please contact us at:</p>
          <p className="font-medium text-slate-800">whitzytraiding@gmail.com</p>
        </Section>
      </div>
    </div>
  );
}

export default TermsOfServicePage;
