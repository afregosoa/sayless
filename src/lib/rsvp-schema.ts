import { z } from "zod";

export const codeSchema = z.string().trim().regex(/^[A-Za-z0-9]{4,12}$/);

// Cada persona de la invitación confirma por separado; el nombre es opcional salvo para quien asiste.
export const memberInputSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().max(80),
  attending: z.boolean(),
});

export const rsvpSchema = z.object({
  slug: z.string().min(3).max(60),
  code: codeSchema,
  members: z.array(memberInputSchema).min(1).max(10),
  message: z.string().trim().max(500),
});

export type GuestMember = { id: string; name: string | null; attending: boolean | null };

export type Guest = {
  name: string;
  passes: number;
  attending: boolean | null;
  confirmedCount: number | null;
  message: string | null;
  members: GuestMember[];
};
