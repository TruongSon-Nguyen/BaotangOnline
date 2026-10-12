import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const historicalPeriodsTable = pgTable("historical_periods", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  startYear: integer("start_year").notNull(),
  endYear: integer("end_year").notNull(),
  description: text("description"),
});

export const materialsTable = pgTable("materials", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const artifactsTable = pgTable("artifacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  summary: text("summary").notNull(),
  history: text("history").notNull(),
  origin: text("origin").notNull(),
  dateLabel: text("date_label").notNull(),
  dimensions: text("dimensions"),
  condition: text("condition"),
  periodId: uuid("period_id")
    .notNull()
    .references(() => historicalPeriodsTable.id, { onDelete: "restrict" }),
  materialId: uuid("material_id")
    .notNull()
    .references(() => materialsTable.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("draft"),
  isSample: boolean("is_sample").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  featuredOrder: integer("featured_order"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const artifactImagesTable = pgTable("artifact_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  artifactId: uuid("artifact_id")
    .notNull()
    .references(() => artifactsTable.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  alt: text("alt").notNull().default(""),
  caption: text("caption").notNull().default(""),
  isPrimary: boolean("is_primary").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const imageHotspotsTable = pgTable("image_hotspots", {
  id: uuid("id").defaultRandom().primaryKey(),
  imageId: uuid("image_id")
    .notNull()
    .references(() => artifactImagesTable.id, { onDelete: "cascade" }),
  x: doublePrecision("x").notNull(),
  y: doublePrecision("y").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
});

export const insertArtifactSchema = createInsertSchema(artifactsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertArtifact = z.infer<typeof insertArtifactSchema>;
export type ArtifactRow = typeof artifactsTable.$inferSelect;
export type HistoricalPeriodRow = typeof historicalPeriodsTable.$inferSelect;
export type MaterialRow = typeof materialsTable.$inferSelect;
export type ArtifactImageRow = typeof artifactImagesTable.$inferSelect;
export type ImageHotspotRow = typeof imageHotspotsTable.$inferSelect;
