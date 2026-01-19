import { pgTable, text, serial, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tools = pgTable("tools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  path: text("path").notNull(),
  status: text("status").notNull(), // 'LIVE', 'COMING SOON'
  isHolderOnly: boolean("is_holder_only").default(false),
  icon: text("icon").notNull(), // icon name
});

export const lore = pgTable("lore", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(), // 'FERAL Prime', 'FANG', 'NULL'
  date: text("date").notNull(),
});

export const insertToolSchema = createInsertSchema(tools);
export const insertLoreSchema = createInsertSchema(lore);

export type Tool = typeof tools.$inferSelect;
export type Lore = typeof lore.$inferSelect;
