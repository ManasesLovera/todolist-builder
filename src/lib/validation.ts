import { z } from "zod";

/**
 * Shared zod schemas for request validation across the auth/profile/todo
 * routes. Centralized here (rather than duplicated per-route) so validation
 * rules stay consistent. Does not touch src/lib/auth.ts or src/lib/prisma.ts.
 */

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Name cannot be empty.").max(100).optional(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address.")
      .optional(),
    currentPassword: z.string().optional(),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters.")
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.email !== undefined || data.newPassword !== undefined, {
    message: "Nothing to update.",
  })
  .refine((data) => !data.newPassword || Boolean(data.currentPassword), {
    message: "Current password is required to set a new password.",
    path: ["currentPassword"],
  });

export const createListSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const updateListSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
  })
  .refine((data) => data.title !== undefined || data.description !== undefined, {
    message: "Nothing to update.",
  });

export const createItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(300),
  dueDate: z.string().datetime().optional().nullable(),
});

export const updateItemSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(300).optional(),
    isComplete: z.boolean().optional(),
    dueDate: z.string().datetime().optional().nullable(),
  })
  .refine(
    (data) =>
      data.title !== undefined || data.isComplete !== undefined || data.dueDate !== undefined,
    { message: "Nothing to update." },
  );
