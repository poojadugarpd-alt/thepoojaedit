import { z } from "zod";

/** Auth form inputs. Supabase enforces its own password policy too. */
export const signUpSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(1).max(120).optional(),
});

export const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(72),
});

export const passwordResetRequestSchema = z.object({
  email: z.email(),
});

export const passwordResetConfirmSchema = z.object({
  password: z.string().min(8).max(72),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
