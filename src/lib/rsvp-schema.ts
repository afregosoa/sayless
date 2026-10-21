import { z } from "zod";
import { DIETS } from "./diet";

export const codeSchema = z.string().trim().regex(/^[A-Za-z0-9]{4,12}$/);

// Cada persona de la invitación confirma por separado; el nombre es opcional salvo para quien asiste.
export const memberInputSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().max(80),
  attending: z.boolean(),
  diet: z.array(z.enum(DIETS)).max(DIETS.length).default([]),
  allergies: z.string().trim().max(200).default(""),
});

export const rsvpSchema = z.object({
  slug: z.string().min(3).max(60),
  code: codeSchema,
  members: z.array(memberInputSchema).min(1).max(10),
  message: z.string().trim().max(500),
});

export type GuestMember = { id: string; name: string | null; attending: boolean | null; diet: string[]; allergies: string | null };

export type Guest = {
  name: string;
  passes: number;
  attending: boolean | null;
  confirmedCount: number | null;
  message: string | null;
  members: GuestMember[];
};
