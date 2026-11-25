import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const enquiries = sqliteTable("enquiries", {
  id: text().primaryKey(),
  request_key: text().notNull().unique(),
  fingerprint: text().notNull(),
  email: text().notNull(),
  name: text().notNull(),
  journey: text().notNull(),
  month: text().notNull(),
  travelers: text().notNull(),
  question: text().notNull(),
  source: text().notNull(),
  received_at: text().notNull(),
  is_test: integer().notNull().default(0),
  acknowledged_at: text()
}, table => [index("pending_enquiries").on(table.acknowledged_at,table.received_at)]);

export const submissionWindows = sqliteTable("submission_windows", {
  key: text().primaryKey(), expires: integer().notNull(), count: integer().notNull()
});

export const tripSessions = sqliteTable("trip_sessions", {
  session_key: text().primaryKey(),
  source: text().notNull(),
  first_visit_at: integer().notNull(),
  first_enquiry_at: integer()
}, table => [index("trip_sessions_first_visit").on(table.first_visit_at)]);
