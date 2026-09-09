import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Margin Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in to see hours, cost, revenue and margin.
        </p>
      </div>

      {/* LoginForm reads the query string with useSearchParams, which needs a
          Suspense boundary. With one, this page still prerenders and only the
          form waits for the client. */}
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
