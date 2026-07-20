import { z } from "zod";

export const signUpSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name").max(60),
    lastName: z.string().trim().min(1, "Enter your last name").max(60),
    email: z.string().email("Enter a valid email"),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    accountType: z.enum(["customer", "professional", "both"]).default("customer"),
    acceptTerms: z.coerce.boolean().refine((v) => v === true, { message: "Please accept the terms to continue" }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "At least 8 characters"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
