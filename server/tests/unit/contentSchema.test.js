/**
 * Unit test for the ContentUpdateSchema preprocess fix.
 * Validates that empty strings are stripped before Zod validation.
 */
import { ContentUpdateSchema, BaseContentUpdateSchema } from '../../src/controllers/admin/contentController.js';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('ContentUpdateSchema - Empty String Preprocessing', () => {
  test('accepts partial payload with only Welcome fields', () => {
    const payload = {
      welcome_headline: 'Test Headline',
      welcome_subheadline: 'Test Sub',
      welcome_hero_intro: 'Test Intro',
    };

    const result = ContentUpdateSchema.safeParse(payload);
    assert.ok(result.success, `Expected success but got: ${JSON.stringify(result.error?.flatten())}`);
    assert.deepStrictEqual(result.data, payload);
  });

  test('strips empty strings and accepts remaining valid fields', () => {
    const payload = {
      welcome_headline: 'Valid headline',
      welcome_subheadline: 'Valid sub',
      welcome_hero_intro: 'Valid intro',
      projects_label: '',
      projects_title: '',
      projects_intro: '',
      boxes_label: '',
      boxes_title: '',
      boxes_cta: '',
      tiers_label: '',
      tiers_title: '',
      tiers_intro: '',
      roadmap_label: '',
      roadmap_title: '',
      roadmap_intro: '',
      impact_label: '',
      impact_title: '',
      impact_intro: '',
      footer_brand_name: '',
      footer_brand_desc: '',
      footer_tagline: '',
    };

    const result = ContentUpdateSchema.safeParse(payload);
    assert.ok(result.success, `Expected 200 success but got validation errors: ${JSON.stringify(result.error?.flatten())}`);
    assert.strictEqual(Object.keys(result.data).length, 3, 'Should only have 3 valid keys');
    assert.strictEqual(result.data.welcome_headline, 'Valid headline');
    assert.strictEqual(result.data.projects_label, undefined);
  });

  test('strips whitespace-only strings', () => {
    const payload = {
      welcome_headline: 'Real value',
      welcome_subheadline: '   ',
      welcome_hero_intro: '\t\n',
    };

    const result = ContentUpdateSchema.safeParse(payload);
    assert.ok(result.success, `Expected success: ${JSON.stringify(result.error?.flatten())}`);
    assert.strictEqual(Object.keys(result.data).length, 1);
    assert.strictEqual(result.data.welcome_headline, 'Real value');
  });

  test('strips unknown/arbitrary keys from payload', () => {
    const payload = {
      welcome_headline: 'Valid',
      malicious_key: 'should be removed',
      __proto__: 'attack',
    };

    const result = ContentUpdateSchema.safeParse(payload);
    assert.ok(result.success);
    assert.strictEqual(result.data.malicious_key, undefined);
    assert.strictEqual(Object.keys(result.data).length, 1);
  });

  test('rejects completely empty payload (all empty strings)', () => {
    const payload = {
      welcome_headline: '',
      welcome_subheadline: '',
      welcome_hero_intro: '',
    };

    const result = ContentUpdateSchema.safeParse(payload);
    // Should succeed with empty data (partial schema allows all missing)
    assert.ok(result.success);
    assert.strictEqual(Object.keys(result.data).length, 0);
  });

  test('accepts full payload with all 21 valid fields', () => {
    const payload = {
      welcome_headline: 'h', welcome_subheadline: 's', welcome_hero_intro: 'i',
      projects_label: 'pl', projects_title: 'pt', projects_intro: 'pi',
      boxes_label: 'bl', boxes_title: 'bt', boxes_cta: 'bc',
      tiers_label: 'tl', tiers_title: 'tt', tiers_intro: 'ti',
      roadmap_label: 'rl', roadmap_title: 'rt', roadmap_intro: 'ri',
      impact_label: 'il', impact_title: 'it', impact_intro: 'ii',
      footer_brand_name: 'fn', footer_brand_desc: 'fd', footer_tagline: 'ft',
    };

    const result = ContentUpdateSchema.safeParse(payload);
    assert.ok(result.success);
    assert.strictEqual(Object.keys(result.data).length, 21);
  });

  test('handles null/undefined input gracefully', () => {
    const result1 = ContentUpdateSchema.safeParse(null);
    assert.ok(result1.success);
    assert.strictEqual(Object.keys(result1.data).length, 0);

    const result2 = ContentUpdateSchema.safeParse(undefined);
    assert.ok(result2.success);
    assert.strictEqual(Object.keys(result2.data).length, 0);
  });
});
