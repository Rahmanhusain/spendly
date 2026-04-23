import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .trim()
  .max(280)
  .optional()
  .or(z.literal(""));

export const signupSchema = z
  .object({
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
      .length(2, "Use a 2-letter country code")
      .transform((value) => value.toUpperCase()),
    gstin: optionalTrimmedString,
    companyAddress: optionalTrimmedString,
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().min(1, "Last name is required").max(100),
    email: z.string().trim().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .max(128),
    confirmPassword: z.string().min(8, "Confirm your password"),
    timezone: z.string().trim().min(3).max(64).default("Asia/Kolkata"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
