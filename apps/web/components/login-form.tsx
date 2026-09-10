"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/notice";
import { isApiError } from "@/lib/api";
import { useLogin, useMe } from "@/lib/auth";
import { safeReturnTo } from "@/lib/session";

const FIELD_CLASS =
  "h-12 w-full rounded-[13px] border border-input bg-card px-3.5 text-[14.5px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

const LABEL_CLASS = "text-[13px] font-semibold";

function messageFor(error: unknown): string {
  if (!isApiError(error)) return "Something went wrong. Please try again.";
  if (error.kind === "network") {
    return "Could not reach the service. Check that the API is running, then try again.";
  }
  switch (error.status) {
    case 400:
      return error.messages.join(" ");
    case 401:
      // The API answers identically for an unknown email and a wrong password,
      // so this message must not imply which one it was.
      return "Invalid email or password.";
    case 403:
      return "The service refused this request. Check the API's allowed frontend origin.";
    case 429:
      return (
        error.messages[0] ??
        "Too many attempts. Please wait a few minutes and try again."
      );
    default:
      return error.status !== null && error.status >= 500
        ? "The service is having trouble. Please try again."
        : (error.messages[0] ?? "Sign in failed.");
  }
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safeReturnTo(params.get("returnTo"));
  const expired = params.get("reason") === "expired";

  const { data: user } = useMe();
  const signIn = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);

  const reset = signIn.reset;
  const navigated = useRef(false);

  // One owner for the post-sign-in navigation, covering both a fresh sign-in and
  // an already-signed-in visitor opening /login.
  useEffect(() => {
    if (!user || navigated.current) return;
    navigated.current = true;
    setPassword("");
    reset();
    router.replace(returnTo);
  }, [user, returnTo, router, reset]);

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (signIn.isPending) return;
        signIn.mutate({ email: email.trim(), password });
      }}
    >
      {expired ? (
        <Notice tone="info" title="Your session ended">
          Please sign in again to carry on.
        </Notice>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={LABEL_CLASS}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="name@agency.com"
          className={FIELD_CLASS}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={signIn.isPending}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={LABEL_CLASS}>
          Password
        </label>
        <div className="flex items-center gap-2">
          <input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            className={FIELD_CLASS}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={signIn.isPending}
          />
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label={visible ? "Hide password" : "Show password"}
            onClick={() => setVisible((shown) => !shown)}
          >
            {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </Button>
        </div>
      </div>

      {signIn.isError ? (
        <Notice tone="danger" title={messageFor(signIn.error)} />
      ) : null}

      <Button type="submit" size="lg" className="mt-1" disabled={signIn.isPending}>
        {signIn.isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
