function pct(part, total) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : null;
}

export function summarizeSmartTelemetry(rows, days = 30) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeDays = [7, 30, 90].includes(Number(days)) ? Number(days) : 30;
  const expenseRows = safeRows.filter(row => row.intent === 'expense');
  const confirmed = expenseRows.filter(row => row.confirmed === true);
  const unsupported = safeRows.filter(row => row.intent === 'unsupported').length;
  const correctionFields = ['value','description','category','payment','date'];

  const correctionCounts = Object.fromEntries(correctionFields.map(field => [
    field,
    confirmed.filter(row => row[`corrected_${field}`] === true).length
  ]));

  const correctedAny = confirmed.filter(row =>
    correctionFields.some(field => row[`corrected_${field}`] === true)
  );
  const noCorrection = confirmed.length - correctedAny.length;

  const durations = confirmed
    .map(row => Number(row.confirmation_ms))
    .filter(Number.isFinite);

  const avgConfirmSeconds = durations.length
    ? Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) / 100) / 10
    : null;

  const learnedSources = new Set(['learned-rule','manual-rule']);
  const learnedConfirmed = confirmed.filter(row => learnedSources.has(row.category_source));
  const baselineConfirmed = confirmed.filter(row => !learnedSources.has(row.category_source));
  const learnedCategoryCorrections = learnedConfirmed.filter(row => row.corrected_category === true).length;
  const baselineCategoryCorrections = baselineConfirmed.filter(row => row.corrected_category === true).length;
  const learnedRate = pct(learnedCategoryCorrections, learnedConfirmed.length);
  const baselineRate = pct(baselineCategoryCorrections, baselineConfirmed.length);

  const sourceCounts = {};
  expenseRows.forEach(row => {
    const key = row.category_source || 'unknown';
    sourceCounts[key] = (sourceCounts[key] || 0) + 1;
  });

  return {
    days: safeDays,
    interpretations: safeRows.length,
    expenseInterpretations: expenseRows.length,
    unsupported,
    confirmed: confirmed.length,
    unconfirmed: Math.max(0, expenseRows.length - confirmed.length),
    confirmationRate: pct(confirmed.length, expenseRows.length),
    noCorrection,
    noCorrectionRate: pct(noCorrection, confirmed.length),
    corrected: correctedAny.length,
    correctedRate: pct(correctedAny.length, confirmed.length),
    reviewSuggested: expenseRows.filter(row => row.needs_review === true).length,
    reviewSuggestedRate: pct(expenseRows.filter(row => row.needs_review === true).length, expenseRows.length),
    avgConfirmSeconds,
    learningRecorded: confirmed.filter(row => row.learning_recorded === true).length,
    corrections: Object.fromEntries(correctionFields.map(field => [
      field,
      { count: correctionCounts[field], rate: pct(correctionCounts[field], confirmed.length) }
    ])),
    sources: sourceCounts,
    learningImpact: {
      learnedConfirmed: learnedConfirmed.length,
      learnedCategoryCorrectionRate: learnedRate,
      baselineConfirmed: baselineConfirmed.length,
      baselineCategoryCorrectionRate: baselineRate,
      improvementPp: learnedRate != null && baselineRate != null
        ? Math.round((baselineRate - learnedRate) * 10) / 10
        : null
    }
  };
}
