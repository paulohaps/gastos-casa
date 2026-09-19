import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeSmartTelemetry } from '../backend/smart-entry/metrics.mjs';

test('resume confirmações, correções e tempo médio', () => {
  const rows = [
    {
      intent:'expense', confirmed:true, needs_review:false, category_source:'rules',
      confirmation_ms:10000, corrected_value:false, corrected_description:false,
      corrected_category:false, corrected_payment:false, corrected_date:false,
      learning_recorded:true
    },
    {
      intent:'expense', confirmed:true, needs_review:true, category_source:'history',
      confirmation_ms:20000, corrected_value:false, corrected_description:true,
      corrected_category:true, corrected_payment:false, corrected_date:false,
      learning_recorded:false
    },
    { intent:'expense', confirmed:false, needs_review:true, category_source:'fallback' },
    { intent:'unsupported', confirmed:false, needs_review:true, category_source:null }
  ];

  const m = summarizeSmartTelemetry(rows, 30);
  assert.equal(m.interpretations, 4);
  assert.equal(m.expenseInterpretations, 3);
  assert.equal(m.unsupported, 1);
  assert.equal(m.confirmed, 2);
  assert.equal(m.unconfirmed, 1);
  assert.equal(m.confirmationRate, 66.7);
  assert.equal(m.noCorrection, 1);
  assert.equal(m.noCorrectionRate, 50);
  assert.equal(m.corrections.category.count, 1);
  assert.equal(m.corrections.category.rate, 50);
  assert.equal(m.avgConfirmSeconds, 15);
  assert.equal(m.learningRecorded, 1);
});

test('mede impacto do aprendizado contra baseline', () => {
  const rows = [
    { intent:'expense', confirmed:true, category_source:'learned-rule', corrected_category:false },
    { intent:'expense', confirmed:true, category_source:'learned-rule', corrected_category:false },
    { intent:'expense', confirmed:true, category_source:'manual-rule', corrected_category:true },
    { intent:'expense', confirmed:true, category_source:'rules', corrected_category:true },
    { intent:'expense', confirmed:true, category_source:'rules', corrected_category:true },
    { intent:'expense', confirmed:true, category_source:'history', corrected_category:false }
  ];
  const m = summarizeSmartTelemetry(rows, 7);
  assert.equal(m.learningImpact.learnedConfirmed, 3);
  assert.equal(m.learningImpact.baselineConfirmed, 3);
  assert.equal(m.learningImpact.learnedCategoryCorrectionRate, 33.3);
  assert.equal(m.learningImpact.baselineCategoryCorrectionRate, 66.7);
  assert.equal(m.learningImpact.improvementPp, 33.4);
});

test('retorna nulos quando não há base para percentuais', () => {
  const m = summarizeSmartTelemetry([], 90);
  assert.equal(m.confirmationRate, null);
  assert.equal(m.noCorrectionRate, null);
  assert.equal(m.avgConfirmSeconds, null);
  assert.equal(m.learningImpact.improvementPp, null);
});
