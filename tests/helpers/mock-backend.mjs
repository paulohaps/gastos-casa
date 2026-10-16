export const BACKEND =
  "https://br-polished-voice-a5flam43-gastospwa.compute.c-1.us-east-2.aws.neon.tech";
export async function mockBackend(page, options = {}) {
  await page.clock.setFixedTime(new Date("2026-09-22T12:00:00Z"));
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  await page.route("https://cdnjs.cloudflare.com/**", (route) => route.abort());
  await page.route("https://cdn.jsdelivr.net/**", (route) => route.abort());

  await page.addInitScript(() => {
    localStorage.setItem("gastos_pwa_session_token_v2", "visual-test-token");

    class FakeSpeechRecognition {
      constructor() {
        this.lang = "pt-BR";
        this.interimResults = true;
        this.continuous = false;
        this.maxAlternatives = 1;
      }
      start() {
        setTimeout(() => {
          this.onstart?.();
          const result = [
            { transcript: "Paguei 87,50 no mercado hoje no PIX" },
          ];
          result.isFinal = true;
          this.onresult?.({ resultIndex: 0, results: [result] });
          this.onend?.();
        }, 10);
      }
      stop() {
        this.onend?.();
      }
    }
    window.SpeechRecognition = FakeSpeechRecognition;
    window.webkitSpeechRecognition = FakeSpeechRecognition;
  });

  await page.route(BACKEND + "/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const respond = (body) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (path === "/ai/settings")
      return respond({
        storageReady: true,
        settings: null,
        providers: [
          {
            id: "gemini",
            name: "Google Gemini",
            keyUrl: "https://aistudio.google.com/api-keys",
            models: [
              {
                id: "gemini-3.5-flash-lite",
                name: "Gemini Flash-Lite",
                description: "Rápido e econômico",
                recommended: true,
              },
            ],
          },
          {
            id: "deepseek",
            name: "DeepSeek",
            keyUrl: "https://platform.deepseek.com/api_keys",
            models: [
              {
                id: "deepseek-flash",
                name: "DeepSeek Flash",
                description: "Rápido e econômico",
                recommended: true,
              },
            ],
          },
        ],
      });
    if (path === "/assistant/conversation") return respond({ conversation: null });
    if (path === "/wallets") return respond({ wallets: [] });
    if (path === "/features")
      return respond({
        smartEntry: true,
        smartEntryLearning: true,
        smartEntryTelemetry: true,
        smartEntryParser: "rules-learning-history-v4",
        smartEntryAiConfigured: false,
      });
    if (path === "/receipts/inspect")
      return respond({
        receipt: {
          kind: "nfce",
          fiscalStatus: "identified_official_qr",
          confidence: "high",
          accessKey: "11260904082624000822650100009174851071923795",
          duplicateKey: "11260904082624000822650100009174851071923795",
          key: {
            validCheckDigit: true,
            uf: "RO",
            issuerCnpj: "04082624000822",
          },
          issuer: { name: "Irmãos Gonçalves", cnpj: "04082624000822" },
          issueDate: "2026-09-19",
          total: 14.01,
          evidence: [
            {
              code: "ACCESS_KEY_44",
              label: "Chave de acesso encontrada",
              ok: true,
            },
            {
              code: "ACCESS_KEY_DV",
              label: "Dígito verificador da chave válido",
              ok: true,
            },
            {
              code: "OFFICIAL_QR_DOMAIN",
              label: "QR aponta para domínio fiscal oficial",
              ok: true,
            },
            {
              code: "TOTAL_FOUND",
              label: "Valor total identificado",
              ok: true,
            },
          ],
          verification: {
            mode: "assisted-url",
            url: "https://www.nfce.sefin.ro.gov.br/",
            captchaExpected: true,
            verifiedByAuthority: false,
          },
          source: { qr: true, ocr: true },
          duplicate: { found: false },
        },
      });
    if (path === "/smart-entry/metrics")
      return respond({
        metrics: {
          days: 30,
          interpretations: 12,
          expenseInterpretations: 11,
          unsupported: 1,
          confirmed: 9,
          unconfirmed: 2,
          confirmationRate: 81.8,
          noCorrection: 7,
          noCorrectionRate: 77.8,
          corrected: 2,
          correctedRate: 22.2,
          reviewSuggested: 3,
          reviewSuggestedRate: 27.3,
          avgConfirmSeconds: 18.4,
          learningRecorded: 6,
          corrections: {
            value: { count: 0, rate: 0 },
            description: { count: 1, rate: 11.1 },
            category: { count: 1, rate: 11.1 },
            payment: { count: 0, rate: 0 },
            date: { count: 0, rate: 0 },
          },
          sources: { "learned-rule": 4, rules: 4, history: 2, fallback: 1 },
          learningImpact: {
            learnedConfirmed: 4,
            learnedCategoryCorrectionRate: 0,
            baselineConfirmed: 5,
            baselineCategoryCorrectionRate: 20,
            improvementPp: 20,
          },
        },
      });
    if (path === "/smart-entry/rules")
      return respond({
        rules: [
          {
            id: "sr1",
            termo_normalizado: "posto trevo",
            categoria: "Contas",
            confirmacoes: 3,
            manual: false,
            ativo: true,
          },
        ],
      });
    if (path === "/smart-entry/parse")
      return respond({
        intent: "expense",
        parserVersion: "rules-learning-history-v4",
        telemetryId: "telemetry-1",
        draft: {
          valor: 87.5,
          descricao: "Mercado",
          categoria: "Mercado",
          formaPagamento: "Dinheiro",
          data: "2026-09-19",
        },
        confidence: {
          valor: 0.99,
          descricao: 0.9,
          categoria: 0.97,
          formaPagamento: 0.97,
          data: 0.99,
        },
        needsReview: false,
        warnings: [],
        source: {
          parser: "rules-learning-history-v4",
          categoria: "rules",
          descricao: "template-purpose",
          pagamento: "rules",
          data: "relative",
        },
      });
    if (path === "/session")
      return respond({
        token: "visual-test-token",
        user: { name: "Paulo Henrique", email: "paulo@example.com" },
      });
    if (path === "/months")
      return respond({
        months: ["09/2026", "08/2026"],
        user: { name: "Paulo Henrique", email: "paulo@example.com" },
      });
    if (path === "/expenses") {
      if (route.request().method() === "POST") {
        const payload = route.request().postDataJSON();
        options.onExpensePost?.(payload);
        return respond({
          expense: {
            id: "manual-test",
            data: payload.dataGasto,
            usuario: "Paulo Henrique",
            valor: payload.valor,
            descricao: payload.descricao,
            categoria: payload.categoria,
            forma_pagamento: payload.formaPagamento,
          },
        });
      }
      const month = url.searchParams.get("month");
      const current = month === "09/2026";
      return respond({
        expenses: current
          ? [
              {
                id: "1",
                data: "2026-09-18",
                usuario: "Paulo Henrique",
                valor: 120.0,
                descricao: "Mercado da semana",
                categoria: "Mercado",
                forma_pagamento: "Dinheiro",
              },
              {
                id: "2",
                data: "2026-09-12",
                usuario: "Fernando Gustavo",
                valor: 180.5,
                descricao: "Internet",
                categoria: "Contas",
                forma_pagamento: "Dinheiro",
              },
              {
                id: "3",
                data: "2026-09-07",
                usuario: "Paulo Henrique",
                valor: 65.9,
                descricao: "iFood",
                categoria: "Ifood",
                forma_pagamento: "Vale",
              },
            ]
          : [
              {
                id: "4",
                data: "2026-08-18",
                usuario: "Fernando Gustavo",
                valor: 290.0,
                descricao: "Mercado",
                categoria: "Mercado",
                forma_pagamento: "Dinheiro",
              },
            ],
      });
    }
    if (path === "/budgets")
      return respond({
        budgets: [
          { id: "b1", mes: "2026-09", categoria: "Mercado", valor_limite: 700 },
          { id: "b2", mes: "2026-09", categoria: "Contas", valor_limite: 400 },
          { id: "b3", mes: "2026-09", categoria: "Ifood", valor_limite: 250 },
        ],
      });
    if (path === "/recurring")
      return respond({
        recurring: [
          {
            id: "r1",
            descricao: "Internet",
            valor: 120,
            categoria: "Contas",
            forma_pagamento: "Dinheiro",
            dia_vencimento: 12,
            ativo: true,
          },
          {
            id: "r2",
            descricao: "Aluguel",
            valor: 900,
            categoria: "Aluguel",
            forma_pagamento: "Dinheiro",
            dia_vencimento: 5,
            ativo: true,
          },
        ],
      });
    if (path === "/settlements")
      return respond({
        atomicSettlements: true, complete: true, settlements: [
          {
            id: "s1",
            competencia: "2026-09-01",
            data_pagamento: "2026-09-20",
            pagador: "Paulo Henrique",
            recebedor: "Fernando Gustavo",
            forma_pagamento: "Dinheiro",
            valor: 10,
            observacao: "PIX parcial",
          },
        ],
      });
    if (path === "/members")
      return respond({
        members: [
          {
            auth_user_id: "u1",
            nome: "Paulo Henrique",
            email: "paulo@example.com",
            ativo: true,
          },
          {
            auth_user_id: "u2",
            nome: "Fernando Gustavo",
            email: "fernando@example.com",
            ativo: true,
          },
        ],
      });
    if (path === "/health") return respond({ ok: true });
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: "{}",
    });
  });
}
