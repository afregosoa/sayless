import { z } from "zod";

export const codeSchema = z.string().trim().regex(/^[A-Za-z0-9]{4,12}$/);

export const rsvpSchema = z.object({
  slug: z.string().min(3).max(60),
  code: codeSchema,
  attending: z.boolean(),
  confirmedCount: z.number().int().min(0).max(10),
  message: z.string().trim().max(500),
});

export type Guest = {
  name: string;
  passes: number;
  attending: boolean | null;
  confirmedCount: number | null;
  message: string | null;
};
