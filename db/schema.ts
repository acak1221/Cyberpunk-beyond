import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// One opaque snapshot per authenticated Site visitor. Only service code updates the revision.
export const userStates = sqliteTable("user_states", {
  userId: text("user_id").primaryKey(),
  revision: integer("revision").notNull(),
  stateJson: text("state_json").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
