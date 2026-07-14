-- Postgres Seed Data Exported from SQLite Test DB

-- ==========================================
-- TIERS
-- ==========================================
INSERT INTO tiers (id, tier_level, name, min_amount, max_amount, is_auto_applied_by_sum, perks) VALUES (79, 1, 'Regular', 1, 84, true, '["Monthly updates from our newsletter","Invitation to \"OMP''s yearly impact\" yearly zoom event","Monthly seed coupons for voting based on the donated amount (1 seed = $1)","Access to OMP group tours at a discounted rate (the real price without the middlemen)"]') ON CONFLICT (id) DO NOTHING;
INSERT INTO tiers (id, tier_level, name, min_amount, max_amount, is_auto_applied_by_sum, perks) VALUES (80, 2, 'Shareholder', 85, 169, true, '["All Regular tier perks","Quarter meetings: progression and behind the scenes — your opinions shape marketing research","Special voting to create a campaign shown on the platform, with monthly aid from OMP for half a year from the second piggy bank","Every $10 above $75 grants an additional vote","Voting on small things like design for camp t-shirts and more"]') ON CONFLICT (id) DO NOTHING;
INSERT INTO tiers (id, tier_level, name, min_amount, max_amount, is_auto_applied_by_sum, perks) VALUES (81, 3, 'Patron', 170, NULL, true, '["All Shareholder tier perks","Your name on the back of camp t-shirts in the \"sponsors\" section","Personal thank-you on our social media — quarterly name posts and video shout-outs"]') ON CONFLICT (id) DO NOTHING;
INSERT INTO tiers (id, tier_level, name, min_amount, max_amount, is_auto_applied_by_sum, perks) VALUES (84, 44, 'VIP Patron', 0, NULL, false, '"[\"Access to VIP lounge\"]"') ON CONFLICT (id) DO NOTHING;
INSERT INTO tiers (id, tier_level, name, min_amount, max_amount, is_auto_applied_by_sum, perks) VALUES (94, 5, 'bob', 66, 77, false, '"[\"bop\"]"') ON CONFLICT (id) DO NOTHING;

-- Reset Sequence for Tiers
SELECT setval(pg_get_serial_sequence('tiers', 'id'), (SELECT COALESCE(MAX(id), 1) FROM tiers));

-- ==========================================
-- DONATION BLOCKS
-- ==========================================
INSERT INTO donation_boxes (id, title, amount, tier_id, tier_details, button_text, is_custom_amount, is_recurring, is_active, display_order, perks) VALUES (89, 'One-Time Donation', 0, NULL, 'Choose your own one-time donation amount', 'Donate', true, false, true, 1, '[]') ON CONFLICT (id) DO NOTHING;
INSERT INTO donation_boxes (id, title, amount, tier_id, tier_details, button_text, is_custom_amount, is_recurring, is_active, display_order, perks) VALUES (90, 'Monthly Donation', 0, NULL, 'Choose your own monthly donation amount', 'Donate', true, true, true, 2, '[]') ON CONFLICT (id) DO NOTHING;
INSERT INTO donation_boxes (id, title, amount, tier_id, tier_details, button_text, is_custom_amount, is_recurring, is_active, display_order, perks) VALUES (91, 'Regular', 10, 79, '', 'Donate $10/mo', false, true, true, 2, '[]') ON CONFLICT (id) DO NOTHING;
INSERT INTO donation_boxes (id, title, amount, tier_id, tier_details, button_text, is_custom_amount, is_recurring, is_active, display_order, perks) VALUES (92, 'Shareholder', 85, 80, '', 'Donate $85/mo', false, true, true, 3, '[]') ON CONFLICT (id) DO NOTHING;
INSERT INTO donation_boxes (id, title, amount, tier_id, tier_details, button_text, is_custom_amount, is_recurring, is_active, display_order, perks) VALUES (93, 'Patron', 170, 81, '', 'Donate $170/mo', false, true, true, 4, '[]') ON CONFLICT (id) DO NOTHING;
INSERT INTO donation_boxes (id, title, amount, tier_id, tier_details, button_text, is_custom_amount, is_recurring, is_active, display_order, perks) VALUES (98, '', 0, 94, '', 'Donate', false, true, true, 5, '[]') ON CONFLICT (id) DO NOTHING;

-- Reset Sequence for Donation Boxes
SELECT setval(pg_get_serial_sequence('donation_boxes', 'id'), (SELECT COALESCE(MAX(id), 1) FROM donation_boxes));

-- ==========================================
-- OBJECTIVES (MILESTONES)
-- ==========================================
INSERT INTO donation_milestones (id, amount_usd, label, description, is_repeatable, display_order) VALUES (111, 1020, 'Silver "OMP Friend"', 'A silver "OMP friend" certificate will be sent to your home.', false, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO donation_milestones (id, amount_usd, label, description, is_repeatable, display_order) VALUES (112, 2040, 'Gold "OMP Friend"', 'A gold "OMP friend" certificate will be sent to your home.', false, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO donation_milestones (id, amount_usd, label, description, is_repeatable, display_order) VALUES (113, 3060, 'Platinum "OMP Friend"', 'A platinum "OMP friend" certificate will be sent to your home.', false, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO donation_milestones (id, amount_usd, label, description, is_repeatable, display_order) VALUES (114, 6000, 'Camp Patrons', '"Camp patron" certificate — a camp will be called by your name and your picture will be printed and put in the camp center.', true, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO donation_milestones (id, amount_usd, label, description, is_repeatable, display_order) VALUES (115, 10000, 'Patreon Wall', 'A permanent place on OMP''s patreon wall at the center.', false, 5) ON CONFLICT (id) DO NOTHING;

-- Reset Sequence for Milestones
SELECT setval(pg_get_serial_sequence('donation_milestones', 'id'), (SELECT COALESCE(MAX(id), 1) FROM donation_milestones));

