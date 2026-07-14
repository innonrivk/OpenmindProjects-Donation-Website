const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('./prisma/dev.db', { readonly: true });

const blocks = db.prepare(`
  SELECT db.id, db.title, db.amount, db.is_recurring, db.button_text, t.name as tier_name 
  FROM donation_boxes db
  LEFT JOIN tiers t ON db.tier_id = t.id
  WHERE db.is_active = 1
  ORDER BY db.display_order ASC
`).all();

const tiers = db.prepare(`SELECT * FROM tiers ORDER BY tier_level ASC`).all();
const objectives = db.prepare(`SELECT * FROM donation_milestones ORDER BY display_order ASC, amount_usd ASC`).all();

let output = `# SQLite Test Database Export

## Donation Blocks
| ID | Title | Amount | Recurring | Button | Tier |
|---|---|---|---|---|---|
`;
blocks.forEach(b => {
  output += `| ${b.id} | ${b.title} | $${b.amount} | ${b.is_recurring} | ${b.button_text} | ${b.tier_name || 'None'} |\n`;
});

output += `\n## Tiers
| Level | Name | Min Amount | Max Amount | Auto Apply |
|---|---|---|---|---|
`;
tiers.forEach(t => {
  output += `| ${t.tier_level} | ${t.name} | $${t.min_amount} | ${t.max_amount ? '$'+t.max_amount : 'Unlimited'} | ${t.is_auto_applied_by_sum} |\n`;
});

output += `\n## Objectives (Milestones)
| Order | Label | Amount | Repeatable | Description |
|---|---|---|---|---|
`;
objectives.forEach(o => {
  output += `| ${o.display_order} | ${o.label} | $${o.amount_usd} | ${o.is_repeatable} | ${o.description} |\n`;
});

fs.writeFileSync('C:/Users/Lenovo/.gemini/antigravity-ide/brain/a47cd5e5-ad0e-4d3b-ac5c-6e2505677e2c/sqlite_export.md', output);
console.log('Export created.');
