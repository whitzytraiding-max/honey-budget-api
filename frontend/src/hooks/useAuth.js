import { useState } from "react";
import { apiFetch } from "../lib/api.js";
import { signInWithApple } from "../lib/native.js";
import { STORAGE_KEYS, readStorage, writeStorage, removeStorage } from "../lib/storage.js";

const REGISTER_FIELDS = {
  name: "", email: "", password: "",
  monthlySalary: "", incomeCurrencyCode: "USD", salaryPaymentMethod: "card",
};
const LOGIN_FIELDS = { email: "", password: "" };
const FORGOT_PASSWORD_FIELDS = { email: "" };
const RESET_PASSWORD_FIELDS = { password: "", confirmPassword: "" };

const REGISTER_BOOTSTRAP_ERROR =
  "Your account was created, but we couldn't finish signing you in. Please log in once more.";
const LOGIN_BOOTSTRAP_ERROR =
  "We couldn't finish signing you in. Please try logging in again.";

export function useAuth({ navigate }) {
  const [token, setToken] = useState(() => readStorage(STORAGE_KEYS.TOKEN, ""));
  const [authMode, setAuthMode] = useState("register");
  const [registerForm, setRegisterForm] = useState(REGISTER_FIELDS);
  const [loginForm, setLoginForm] = useState(LOGIN_FIELDS);
  const [forgotPasswordForm, setForgotPasswordForm] = useState(FORGOT_PASSWORD_FIELDS);
  const [resetPasswordForm, setResetPasswordForm] = useState(RESET_PASSWORD_FIELDS);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authInfo, setAuthInfo] = useState("");
  const [previewResetUrl, setPreviewResetUrl] = useState("");
  const [postAuthFailureMessage, setPostAuthFailureMessage] = useState("");

  function clearAuthFeedback() {
    setAuthError("");
    setAuthInfo("");
    setPreviewResetUrl("");
  }

  function saveToken(accessToken) {
    writeStorage(STORAGE_KEYS.TOKEN, accessToken);
    setToken(accessToken);
  }

  function logout() {
    removeStorage(STORAGE_KEYS.TOKEN);
    setToken("");
  }

  function updateAuthMode(nextMode) {
    clearAuthFeedback();
    setPostAuthFailureMessage("");
    setAuthMode(nextMode);
    if (nextMode === "login") navigate("home");
  }

  function updateForm(setter) {
    return (event) => setter((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  async function handleRegister(event) {
    event.preventDefault();
    setAuthBusy(true);
    clearAuthFeedback();
    setPostAuthFailureMessage("");
    const email = registerForm.email.trim().toLowerCase();
    try {
      const data = await apiFetch("/api/auth/register", {
        auth: false,
        method: "POST",
        body: JSON.stringify({ ...registerForm, email, monthlySalary: Number(registerForm.monthlySalary) }),
      });
      setPostAuthFailureMessage(REGISTER_BOOTSTRAP_ERROR);
      setLoginForm({ email, password: registerForm.password });
      setAuthMode("login");
      setRegisterForm(REGISTER_FIELDS);
      saveToken(data.accessToken);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setAuthBusy(true);
    clearAuthFeedback();
    setPostAuthFailureMessage("");
    const email = loginForm.email.trim().toLowerCase();
    try {
      const data = await apiFetch("/api/auth/login", {
        auth: false,
        method: "POST",
        body: JSON.stringify({ ...loginForm, email }),
      });
      setPostAuthFailureMessage(LOGIN_BOOTSTRAP_ERROR);
      setLoginForm(LOGIN_FIELDS);
      saveToken(data.accessToken);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleGoogleAuth(credential) {
    setAuthBusy(true);
    clearAuthFeedback();
    setPostAuthFailureMessage("");
    try {
      const data = await apiFetch("/api/auth/google", {
        auth: false,
        method: "POST",
        body: JSON.stringify({ access_token: credential }),
      });
      if (Number(data.user?.monthlySalary ?? 0) === 0) {
        removeStorage(STORAGE_KEYS.SOLO_MODE);
        window.location.hash = "#/settings";
      }
      setPostAuthFailureMessage(LOGIN_BOOTSTRAP_ERROR);
      saveToken(data.accessToken);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleAppleAuth() {
    setAuthBusy(true);
    clearAuthFeedback();
    setPostAuthFailureMessage("");
    try {
      const appleResponse = await signInWithApple();
      const data = await apiFetch("/api/auth/apple", {
        auth: false,
        method: "POST",
        body: JSON.stringify({
          identity_token: appleResponse.identityToken,
          given_name: appleResponse.givenName || "",
          family_name: appleResponse.familyName || "",
        }),
      });
      if (Number(data.user?.monthlySalary ?? 0) === 0) {
        removeStorage(STORAGE_KEYS.SOLO_MODE);
        window.location.hash = "#/settings";
      }
      setPostAuthFailureMessage(LOGIN_BOOTSTRAP_ERROR);
      saveToken(data.accessToken);
    } catch (error) {
      if (!error?.message?.toLowerCase().includes("cancel")) {
        setAuthError(error.message || "Apple sign-in failed. Please try again.");
      }
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    setAuthBusy(true);
    clearAuthFeedback();
    const email = forgotPasswordForm.email.trim().toLowerCase();
    if (!email) {
      setAuthError("Enter your email address.");
      setAuthBusy(false);
      return;
    }
    try {
      const data = await apiFetch("/api/auth/forgot-password", {
        auth: false,
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setAuthInfo(data.message || "If that email exists, we sent a reset link.");
      setPreviewResetUrl(data.previewResetUrl || "");
      setForgotPasswordForm(FORGOT_PASSWORD_FIELDS);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleResetPassword(event, resetToken) {
    event.preventDefault();
    setAuthBusy(true);
    clearAuthFeedback();
    if (!resetToken) {
      setAuthError("This reset link is missing its token.");
      setAuthBusy(false);
      return;
    }
    if (!resetPasswordForm.password || resetPasswordForm.password.length < 8) {
      setAuthError("Enter a new password with at least 8 characters.");
      setAuthBusy(false);
      return;
    }
    if (resetPasswordForm.password !== resetPasswordForm.confirmPassword) {
      setAuthError("The passwords do not match.");
      setAuthBusy(false);
      return;
    }
    try {
      const data = await apiFetch("/api/auth/reset-password", {
        auth: false,
        method: "POST",
        body: JSON.stringify({ token: resetToken, password: resetPasswordForm.password }),
      });
      saveToken(data.accessToken);
      setResetPasswordForm(RESET_PASSWORD_FIELDS);
      setAuthMode("login");
      navigate("home");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  return {
    token,
    saveToken,
    logout,
    authMode,
    updateAuthMode,
    registerForm,
    loginForm,
    forgotPasswordForm,
    resetPasswordForm,
    onRegisterChange: updateForm(setRegisterForm),
    onLoginChange: (e) => { clearAuthFeedback(); updateForm(setLoginForm)(e); },
    onForgotPasswordChange: (e) => { clearAuthFeedback(); updateForm(setForgotPasswordForm)(e); },
    onResetPasswordChange: (e) => { clearAuthFeedback(); updateForm(setResetPasswordForm)(e); },
    handleRegister,
    handleLogin,
    handleGoogleAuth,
    handleAppleAuth,
    handleForgotPassword,
    handleResetPassword,
    authBusy,
    authError,
    authInfo,
    previewResetUrl,
    postAuthFailureMessage,
    setPostAuthFailureMessage,
    clearAuthFeedback,
    setAuthError,
  };
}
