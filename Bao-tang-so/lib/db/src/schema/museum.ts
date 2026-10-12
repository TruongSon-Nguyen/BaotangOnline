import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const museumIntroTable = pgTable("museum_intro", {
  id: uuid("id").defaultRandom().primaryKey(),
  museumName: text("museum_name").notNull(),
  tagline: text("tagline").notNull(),
  story: text("story").notNull(),
  heroImage: text("hero_image"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const museumAdminsTable = pgTable("museum_admins", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  status: text("status").notNull().default("invited"),
  clerkInvitationId: text("clerk_invitation_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertMuseumIntroSchema = createInsertSchema(museumIntroTable).omit({
  id: true,
  updatedAt: true,
});
export const insertMuseumAdminSchema = createInsertSchema(museumAdminsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMuseumIntro = z.infer<typeof insertMuseumIntroSchema>;
export type InsertMuseumAdmin = z.infer<typeof insertMuseumAdminSchema>;
export type MuseumIntroRow = typeof museumIntroTable.$inferSelect;
export type MuseumAdminRow = typeof museumAdminsTable.$inferSelect;
