import { z } from "zod";

const signupBaseSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required").max(255),
  companySlug: z
    .string()
    .trim()
    .min(2, "Workspace slug is required")
    .max(80)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and hyphens only",
    ),
  countryCode: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => /^[A-Z]{2}$/.test(value), {
      message: "Use a 2-letter country code",
    }),
  gstin: z.string().trim().max(20).optional().or(z.literal("")),
  companyAddress: z.string().trim().max(280).optional().or(z.literal("")),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.string().trim().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128),
  confirmPassword: z.string().min(8, "Confirm your password"),
  timezone: z.string().trim().min(3).max(64).default("Asia/Kolkata"),
});

export const signupSchema = signupBaseSchema.refine(
  (values) => values.password === values.confirmPassword,
  {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  },
);

export const signupWithOtpSchema = signupBaseSchema
  .extend({
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter the 6-digit OTP sent to your email"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const requestOtpSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

export const forgotPasswordResetSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address"),
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter the 6-digit OTP sent to your email"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .max(128),
    confirmPassword: z.string().min(8, "Confirm your password"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupWithOtpInput = z.infer<typeof signupWithOtpSchema>;
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type ForgotPasswordResetInput = z.infer<
  typeof forgotPasswordResetSchema
>;
