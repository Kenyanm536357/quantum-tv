import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import AuthLayout from "@/components/AuthLayout";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" fillRule="evenodd">
        <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </g>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M13.162 9.426c-.017-1.92 1.566-2.846 1.637-2.893-0.893-1.305-2.28-1.483-2.77-1.502-1.18-.12-2.3.697-2.898.697-.598 0-1.523-.68-2.503-.662-1.286.019-2.476.749-3.136 1.9-1.336 2.315-.342 5.74.957 7.617.634.916 1.392 1.944 2.385 1.907.957-.038 1.319-.617 2.477-.617 1.157 0 1.483.617 2.503.598 1.032-.02 1.682-.934 2.312-1.852.73-1.06 1.03-2.087 1.047-2.14-.023-.01-2.007-.77-2.011-3.053zM11.27 3.71c.526-.638.882-1.523.785-2.41-.759.031-1.678.506-2.222 1.143-.487.564-.914 1.468-.8 2.333.847.065 1.71-.43 2.237-1.066z"/>
    </svg>
  );
}

export default function Login() {
  const [error, setError] = useState("");
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingApple, setLoadingApple] = useState(false);

  const handleGoogle = async () => {
    setError("");
    setLoadingGoogle(true);
    try {
      await base44.auth.loginWithProvider("google", "/");
    } catch (err) {
      setError(err.message || "Google sign-in failed");
      setLoadingGoogle(false);
    }
  };

  const handleApple = async () => {
    setError("");
    setLoadingApple(true);
    try {
      await base44.auth.loginWithProvider("apple", "/");
    } catch (err) {
      setError(err.message || "Apple sign-in failed");
      setLoadingApple(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue to Quantum TV">
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={handleGoogle}
          disabled={loadingGoogle || loadingApple}
          className="w-full h-12 flex items-center justify-center gap-3 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground font-medium text-sm transition-colors disabled:opacity-60"
        >
          <GoogleIcon />
          {loadingGoogle ? "Signing in…" : "Continue with Google"}
        </button>

        <button
          onClick={handleApple}
          disabled={loadingGoogle || loadingApple}
          className="w-full h-12 flex items-center justify-center gap-3 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground font-medium text-sm transition-colors disabled:opacity-60"
        >
          <AppleIcon />
          {loadingApple ? "Signing in…" : "Continue with Apple"}
        </button>
      </div>
    </AuthLayout>
  );
}