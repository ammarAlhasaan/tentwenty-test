import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
    // Capped so an oversized body cannot make the password hasher do unbounded
    // work on request. There is no minimum beyond non-empty: stating a password
    // policy here would only tell an attacker what to generate.
    password: z.string().min(1).max(256),
  })
  .strict();

export type LoginBody = z.infer<typeof loginSchema>;
