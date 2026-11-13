import { sql, relations } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  primaryKey,
  check,
} from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
});
export const profiles = sqliteTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    avatar: text("avatar").notNull().default("compass"),
    displayOrder: integer("display_order").notNull(),
    revision: integer("revision").notNull().default(0),
  },
  (t) => [
    uniqueIndex("profile_account_order").on(t.accountId, t.displayOrder),
    check("two_profile_slots", sql`${t.displayOrder} in (0, 1)`),
  ],
);
export const activities = sqliteTable(
  "activities",
  {
    id: text("id").notNull(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category", {
      enum: [
        "Livros",
        "Filmes e séries",
        "Cursos",
        "Projetos",
        "Lugares",
        "Outros",
      ],
    }).notNull(),
    status: text("status", {
      enum: ["Quero fazer", "Em andamento", "Concluído"],
    }).notNull(),
    imageUrl: text("image_url").notNull(),
    linkUrl: text("link_url").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.profileId, t.id] }),
    index("activities_profile_status").on(t.profileId, t.status),
    index("activities_profile_category").on(t.profileId, t.category),
    check("activity_title", sql`length(trim(${t.title})) between 1 and 120`),
    check("activity_description", sql`length(${t.description}) <= 2000`),
    check(
      "activity_category",
      sql`${t.category} in ('Livros','Filmes e séries','Cursos','Projetos','Lugares','Outros')`,
    ),
    check(
      "activity_status",
      sql`${t.status} in ('Quero fazer','Em andamento','Concluído')`,
    ),
  ],
);
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("sessions_expiry").on(t.expiresAt)],
);
export const loginAttempts = sqliteTable("login_attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: integer("reset_at").notNull(),
});
export const accountRelations = relations(accounts, ({ many }) => ({
  profiles: many(profiles),
}));
export const profileRelations = relations(profiles, ({ one, many }) => ({
  account: one(accounts, {
    fields: [profiles.accountId],
    references: [accounts.id],
  }),
  activities: many(activities),
}));
export const activityRelations = relations(activities, ({ one }) => ({
  profile: one(profiles, {
    fields: [activities.profileId],
    references: [profiles.id],
  }),
}));
