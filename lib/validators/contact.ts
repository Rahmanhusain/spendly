import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters.").max(100),
  email: z.string().email("Please enter a valid email address."),
  reason: z.enum(
    ["complaint", "suggestion", "feedback", "query", "support", "partnership"],
    { required_error: "Please select a reason." }
  ),
  subject: z.string().min(3, "Subject must be at least 3 characters.").max(200),
  message: z.string().min(10, "Message must be at least 10 characters.").max(5000),
});

export type ContactPayload = z.infer<typeof contactSchema>;
