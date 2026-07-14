const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('./prisma/dev.db', { readonly: true });

const blocks = db.prepare(`SELECT * FROM donation_boxes`).all();
const tiers = db.prepare(`SELECT * FROM tiers`).all();
const objectives = db.prepare(`SELECT * FROM donation_milestones`).all();

function escapeString(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function bool(val) {
  return val ? 'true' : 'false';
}

let sql = `-- Postgres Seed Data Exported from SQLite Test DB\n\n`;

// 1. Tiers
sql += `-- ==========================================\n`;
sql += `-- TIERS\n`;
sql += `-- ==========================================\n`;
if (tiers.length > 0) {
  tiers.forEach(t => {
    sql += `INSERT INTO tiers (id, tier_level, name, min_amount, max_amount, is_auto_applied_by_sum, perks) VALUES (`;
    sql += `${t.id}, ${t.tier_level}, ${escapeString(t.name)}, ${t.min_amount}, ${t.max_amount !== null ? t.max_amount : 'NULL'}, ${bool(t.is_auto_applied_by_sum)}, ${escapeString(t.perks)}`;
    sql += `) ON CONFLICT (id) DO NOTHING;\n`;
  });
  sql += `\n-- Reset Sequence for Tiers\n`;
  sql += `SELECT setval(pg_get_serial_sequence('tiers', 'id'), (SELECT COALESCE(MAX(id), 1) FROM tiers));\n\n`;
}

// 2. Donation Blocks
sql += `-- ==========================================\n`;
sql += `-- DONATION BLOCKS\n`;
sql += `-- ==========================================\n`;
if (blocks.length > 0) {
  blocks.forEach(b => {
    sql += `INSERT INTO donation_boxes (id, title, amount, tier_id, tier_details, button_text, is_custom_amount, is_recurring, is_active, display_order, perks) VALUES (`;
    sql += `${b.id}, ${escapeString(b.title)}, ${b.amount}, ${b.tier_id !== null ? b.tier_id : 'NULL'}, ${escapeString(b.tier_details)}, ${escapeString(b.button_text)}, ${bool(b.is_custom_amount)}, ${bool(b.is_recurring)}, ${bool(b.is_active)}, ${b.display_order}, ${escapeString(b.perks)}`;
    sql += `) ON CONFLICT (id) DO NOTHING;\n`;
  });
  sql += `\n-- Reset Sequence for Donation Boxes\n`;
  sql += `SELECT setval(pg_get_serial_sequence('donation_boxes', 'id'), (SELECT COALESCE(MAX(id), 1) FROM donation_boxes));\n\n`;
}

// 3. Objectives
sql += `-- ==========================================\n`;
sql += `-- OBJECTIVES (MILESTONES)\n`;
sql += `-- ==========================================\n`;
if (objectives.length > 0) {
  objectives.forEach(o => {
    sql += `INSERT INTO donation_milestones (id, amount_usd, label, description, is_repeatable, display_order) VALUES (`;
    sql += `${o.id}, ${o.amount_usd}, ${escapeString(o.label)}, ${escapeString(o.description)}, ${bool(o.is_repeatable)}, ${o.display_order}`;
    sql += `) ON CONFLICT (id) DO NOTHING;\n`;
  });
  sql += `\n-- Reset Sequence for Milestones\n`;
  sql += `SELECT setval(pg_get_serial_sequence('donation_milestones', 'id'), (SELECT COALESCE(MAX(id), 1) FROM donation_milestones));\n\n`;
}

fs.writeFileSync('C:/Users/Lenovo/OneDrive/Documents/Donation site/Donation-Site-Project/postgres_seed.sql', sql);
console.log('Postgres SQL seed generated successfully.');
