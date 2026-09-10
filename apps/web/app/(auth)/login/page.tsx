import type { Metadata } from "next";
import { Suspense } from "react";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
      <div className="mx-auto flex w-full max-w-[34rem] flex-col justify-center gap-7 px-6 py-14 sm:px-10 lg:mr-0 lg:ml-auto">
        <Brand />

        <div>
          <h1 className="font-heading text-[29px] leading-tight font-bold tracking-tight">
            Sign in
          </h1>
          <p className="mt-2 text-[14.5px] text-ink-2 text-pretty">
            Agency profitability, built from your own timesheets.
          </p>
        </div>

        {/* LoginForm reads the query string with useSearchParams, which needs a
            Suspense boundary. With one, this page still prerenders and only the
            form waits for the client. */}
        <Suspense fallback={<div className="h-72" aria-hidden />}>
          <LoginForm />
        </Suspense>
      </div>

      {/* Decorative panel. Hidden below lg rather than stacked, so a phone gets
          the form without scrolling past a banner. */}
      <div
        aria-hidden
        className="my-4 mr-4 hidden flex-col justify-between rounded-[28px] bg-brand p-14 text-brand-foreground lg:flex"
      >
        <Brand tone="inverse" />
        <p className="max-w-[16ch] font-heading text-[clamp(1.75rem,3.4vw,2.75rem)] leading-[1.12] font-bold tracking-display">
          Did we actually make money on that project?
        </p>
        <p className="text-[13.5px] text-brand-foreground/70">
          Hours, cost, revenue and margin — from the spreadsheets you already
          keep.
        </p>
      </div>
    </div>
  );
}
