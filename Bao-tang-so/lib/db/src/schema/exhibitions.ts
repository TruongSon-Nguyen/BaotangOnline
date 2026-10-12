import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  date,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { artifactsTable } from "./catalog";

export const exhibitionsTable = pgTable("exhibitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  summary: text("summary").notNull(),
  story: text("story").notNull().default(""),
  coverImage: text("cover_image"),
  startDate: date("start_date", { mode: "string" }),
  endDate: date("end_date", { mode: "string" }),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const artifactExhibitionsTable = pgTable(
  "artifact_exhibitions",
  {
    artifactId: uuid("artifact_id")
      .notNull()
      .references(() => artifactsTable.id, { onDelete: "cascade" }),
    exhibitionId: uuid("exhibition_id")
      .notNull()
      .references(() => exhibitionsTable.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.artifactId, table.exhibitionId] })],
);

export const insertExhibitionSchema = createInsertSchema(exhibitionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertExhibition = z.infer<typeof insertExhibitionSchema>;
export type ExhibitionRow = typeof exhibitionsTable.$inferSelect;
