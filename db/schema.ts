import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// One opaque snapshot per authenticated Site visitor. Only service code updates the revision.
export const userStates = sqliteTable("user_states", {
  userId: text("user_id").primaryKey(),
  revision: integer("revision").notNull(),
  stateJson: text("state_json").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// Shared campaign records are separate from each visitor's personal state.
export const sharedCampaigns = sqliteTable("shared_campaigns", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(), name: text("name").notNull(),
  revision: integer("revision").notNull(), sharedJson: text("shared_json").notNull(),
  notesRevision: integer("notes_revision").notNull(), notes: text("notes").notNull(),
  createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
});
export const campaignMembers = sqliteTable("campaign_members", {
  id: text("id").primaryKey(), campaignId: text("campaign_id").notNull(), userId: text("user_id").notNull(),
  role: text("role").notNull(), joinedAt: integer("joined_at").notNull(),
}, t => [uniqueIndex("campaign_member_identity").on(t.campaignId, t.userId)]);
export const campaignInvites = sqliteTable("campaign_invites", {
  id: text("id").primaryKey(), campaignId: text("campaign_id").notNull(), tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at").notNull(), revokedAt: integer("revoked_at"), usedBy: text("used_by"), usedAt: integer("used_at"),
}, t => [uniqueIndex("campaign_invite_token").on(t.tokenHash)]);
export const campaignShares = sqliteTable("campaign_shares", {
  id: text("id").primaryKey(), campaignId: text("campaign_id").notNull(), userId: text("user_id").notNull(),
  revision: integer("revision").notNull(), dataJson: text("data_json").notNull(), updatedAt: integer("updated_at").notNull(),
});

