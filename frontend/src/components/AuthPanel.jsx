/*
 * Honey Budget
 * Copyright (c) 2026 Whitzy. All rights reserved.
 * Proprietary and confidential. Unauthorized copying is prohibited.
 */
import { Brain, TrendingUp, Wallet } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { useLanguage } from "../i18n/LanguageProvider.jsx";
import { getCurrencyOptions } from "../lib/format.js";
import { ActionButton, Input, Select } from "./ui.jsx";

function AuthPanel({
  authMode,
  setAuthMode,
  registerForm,
  loginForm,
  forgotPasswordForm,
  resetPasswordForm,
  onRegisterChange,
  onLoginChange,
  onForgotPasswordChange,
  onResetPasswordChange,
  onRegister,
  onLogin,
  onGoogleAuth,
  onForgotPassword,
  onResetPassword,
  isSubmitting,
  error,
  info,
  previewResetUrl,
  resetToken,
}) {
  const { t, locale } = useLanguage();
  const currencyOptions = getCurrencyOptions(locale);
  const showResetForm = Boolean(resetToken) || authMode === "reset";
  const showForgotPassword = authMode === "forgot" && !showResetForm;

  return (
    <section className="auth-shell mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6">
      <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="auth-hero-panel relative overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(18,37,66,0.96),rgba(25,54,94,0.94),rgba(16,37,63,0.98))] p-8 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] backdrop-blur">
          <div className="auth-hero-glow-left pointer-events-none absolute -left-12 top-8 h-36 w-36 rounded-full bg-amber-200/40 blur-3xl" />
          <div className="auth-hero-glow-right pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-sky-300/30 blur-3xl" />

          <div className="auth-brand-pill hb-brand-pill relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
            <img alt="Honey Budget" className="h-5 w-5" src="/icons/brand-mark.svg" />
            {t("auth.title")}
          </div>

          <div className="relative mt-6 flex items-center gap-6">
            <div className="auth-brand-mark rounded-[2rem] bg-white/10 p-4 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.55)] backdrop-blur">
              <img alt="Honey Budget mark" className="h-28 w-28 sm:h-36 sm:w-36" src="/icons/brand-mark.svg" />
            </div>
            <div className="hidden sm:block">
              <p className="auth-kicker text-sm font-semibold uppercase tracking-[0.22em] text-amber-200/90">
                For Couples
              </p>
              <p className="mt-2 bg-gradient-to-r from-amber-300 via-yellow-200 to-sky-200 bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
                Honey Budget
              </p>
            </div>
          </div>

          <h1 className="auth-hero-title relative mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {t("auth.hero")}
          </h1>
          <p className="auth-hero-copy relative mt-4 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">
            {t("auth.subhero")}
          </p>

          <div className="relative mt-8 grid gap-4 sm:grid-cols-3">
            <div className="auth-feature-card rounded-3xl border border-sky-300/20 bg-white/10 p-4 backdrop-blur">
              <Brain className="h-6 w-6 text-sky-200" />
              <p className="auth-feature-title mt-3 text-sm font-medium text-white">{t("auth.aiPromptsTitle")}</p>
              <p className="auth-feature-copy mt-1 text-sm text-slate-200">{t("auth.aiPromptsBody")}</p>
            </div>
            <div className="auth-feature-card rounded-3xl border border-emerald-300/20 bg-white/10 p-4 backdrop-blur">
              <TrendingUp className="h-6 w-6 text-emerald-200" />
              <p className="auth-feature-title mt-3 text-sm font-medium text-white">{t("auth.fairSplitTitle")}</p>
              <p className="auth-feature-copy mt-1 text-sm text-slate-200">{t("auth.fairSplitBody")}</p>
            </div>
            <div className="auth-feature-card rounded-3xl border border-amber-300/20 bg-white/10 p-4 backdrop-blur">
              <Wallet className="h-6 w-6 text-amber-200" />
              <p className="auth-feature-title mt-3 text-sm font-medium text-white">{t("auth.fastCaptureTitle")}</p>
              <p className="auth-feature-copy mt-1 text-sm text-slate-200">{t("auth.fastCaptureBody")}</p>
            </div>
          </div>
        </div>

        <div className="auth-form-panel rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_20px_60px_-24px_rgba(21,50,65,0.35)] backdrop-blur sm:p-8">
          {!showResetForm && !showForgotPassword ? (
            <div className="auth-tab-bar inline-flex rounded-full bg-slate-100 p-1 text-sm font-medium text-slate-600">
              <button
                className={`auth-tab rounded-full px-4 py-2 transition ${
                  authMode === "register" ? "bg-white text-slate-900 shadow-sm" : ""
                }`}
                onClick={() => setAuthMode("register")}
                type="button"
              >
                {t("auth.createProfile")}
              </button>
              <button
                className={`auth-tab rounded-full px-4 py-2 transition ${
                  authMode === "login" ? "bg-white text-slate-900 shadow-sm" : ""
                }`}
                onClick={() => setAuthMode("login")}
                type="button"
              >
                {t("auth.signIn")}
              </button>
            </div>
          ) : (
            <button
              className="auth-back-link text-sm font-medium text-slate-600 underline-offset-4 hover:underline"
              onClick={() => setAuthMode("login")}
              type="button"
            >
              {t("auth.backToSignIn")}
            </button>
          )}

          {authMode === "register" && !showResetForm && !showForgotPassword ? (
            <form className="mt-6 space-y-4" onSubmit={onRegister}>
              <Input
                label={t("auth.name")}
                name="name"
                value={registerForm.name}
                onChange={onRegisterChange}
                placeholder="Alex"
              />
              <Input
                label={t("auth.email")}
                name="email"
                type="email"
                value={registerForm.email}
                onChange={onRegisterChange}
                placeholder="alex@example.com"
              />
              <Input
                label={t("auth.password")}
                name="password"
                type="password"
                value={registerForm.password}
                onChange={onRegisterChange}
                placeholder="At least 8 characters"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label={t("auth.monthlySalary")}
                  name="monthlySalary"
                  type="number"
                  min="0"
                  step="0.01"
                  value={registerForm.monthlySalary}
                  onChange={onRegisterChange}
                  placeholder="4200"
                />
                <Select
                  label={t("auth.salaryPaymentMethod")}
                  name="salaryPaymentMethod"
                  value={registerForm.salaryPaymentMethod}
                  onChange={onRegisterChange}
                  options={[
                    { label: t("auth.card"), value: "card" },
                    { label: t("auth.cash"), value: "cash" },
                  ]}
                />
              </div>
              <Select
                label={t("settings.incomeCurrency")}
                name="incomeCurrencyCode"
                value={registerForm.incomeCurrencyCode}
                onChange={onRegisterChange}
                options={currencyOptions}
              />
              <p className="auth-helper-copy text-sm leading-6 text-slate-600">{t("auth.currencySetupHelp")}</p>
              <ActionButton busy={isSubmitting}>{t("auth.createAccount")}</ActionButton>
              {onGoogleAuth ? (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs font-medium text-slate-400">or</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  <div className="flex justify-center">
                    <GoogleLogin
                      onSuccess={(response) => onGoogleAuth(response.credential)}
                      onError={() => {}}
                      shape="pill"
                      size="large"
                      text="continue_with"
                    />
                  </div>
                </div>
              ) : null}
            </form>
          ) : null}

          {authMode === "login" && !showResetForm && !showForgotPassword ? (
            <form className="mt-6 space-y-4" onSubmit={onLogin}>
              <Input
                label={t("auth.email")}
                name="email"
                type="email"
                value={loginForm.email}
                onChange={onLoginChange}
                placeholder="alex@example.com"
              />
              <Input
                label={t("auth.password")}
                name="password"
                type="password"
                value={loginForm.password}
                onChange={onLoginChange}
                placeholder="Your password"
              />
              <ActionButton busy={isSubmitting}>{t("auth.signIn")}</ActionButton>
              <button
                className="auth-back-link text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
                onClick={() => setAuthMode("forgot")}
                type="button"
              >
                {t("auth.forgotPassword")}
              </button>
              {onGoogleAuth ? (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs font-medium text-slate-400">or</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  <div className="flex justify-center">
                    <GoogleLogin
                      onSuccess={(response) => onGoogleAuth(response.credential)}
                      onError={() => {}}
                      shape="pill"
                      size="large"
                      text="signin_with"
                    />
                  </div>
                </div>
              ) : null}
            </form>
          ) : null}

          {showForgotPassword ? (
            <form className="mt-6 space-y-4" onSubmit={onForgotPassword}>
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">{t("auth.forgotTitle")}</h2>
                <p className="mt-2 text-sm text-slate-600">{t("auth.forgotBody")}</p>
              </div>
              <Input
                label={t("auth.email")}
                name="email"
                type="email"
                value={forgotPasswordForm.email}
                onChange={onForgotPasswordChange}
                placeholder="alex@example.com"
              />
              <ActionButton busy={isSubmitting}>{t("auth.sendResetLink")}</ActionButton>
            </form>
          ) : null}

          {showResetForm ? (
            <form className="mt-6 space-y-4" onSubmit={onResetPassword}>
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">{t("auth.resetPassword")}</h2>
                <p className="mt-2 text-sm text-slate-600">{t("auth.resetBody")}</p>
              </div>
              <Input
                label={t("auth.password")}
                name="password"
                type="password"
                value={resetPasswordForm.password}
                onChange={onResetPasswordChange}
                placeholder={t("auth.resetHelp")}
              />
              <Input
                label={t("auth.confirmPassword")}
                name="confirmPassword"
                type="password"
                value={resetPasswordForm.confirmPassword}
                onChange={onResetPasswordChange}
                placeholder={t("auth.resetHelp")}
              />
              <ActionButton busy={isSubmitting}>{t("auth.resetPassword")}</ActionButton>
            </form>
          ) : null}

          {error ? (
            <div className="auth-error mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {info ? (
            <div className="auth-info mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <p>{info}</p>
              {previewResetUrl ? (
                <a
                  className="auth-info-link mt-2 inline-flex font-medium underline-offset-4 hover:underline"
                  href={previewResetUrl}
                >
                  {t("auth.openResetLink")}
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="auth-legal mt-6 border-t border-slate-200 pt-4 text-center text-xs leading-5 text-slate-500">
            <p>{t("legal.ownership")}</p>
            <p>{t("legal.rightsReserved")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default AuthPanel;
