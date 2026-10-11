import { test, expect } from "@playwright/test";
import { mockBackend } from "./helpers/mock-backend.mjs";
for (const mode of ["qr", "receipt"])
  test(`scanner ${mode} recupera após CDN falhar sem recarregar página`, async ({
    page,
  }) => {
    await mockBackend(page);
    await page.addInitScript(() => {
      delete window.BarcodeDetector;
    });
    let attempts = 0;
    const source = mode === "qr" ? "**/jsqr@*/**" : "**/tesseract.js@*/**";
    await page.route(source, (route) => {
      attempts++;
      if (attempts === 1) return route.abort();
      return route.fulfill({
        contentType: "text/javascript",
        body:
          mode === "qr"
            ? 'window.jsQR = () => ({data:"https://www.nfce.sefin.ro.gov.br/consulta?p=11260904082624000822650100009174851071923795&vNF=14.01"});'
            : 'window.Tesseract = {recognize: async () => ({data:{text:"MERCADO CENTRAL LTDA\\nTOTAL R$ 40,89\\n19/09/2026"}})};',
      });
    });
    await page.goto("/index.html");
    await expect(page.locator("#homeHouseTotal")).toContainText("366");
    const encoded = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 32;
      canvas.getContext("2d").fillRect(0, 0, 32, 32);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    const image = {
      name: "cupom.png",
      mimeType: "image/png",
      buffer: Buffer.from(encoded, "base64"),
    };
    await page.evaluate((mode) => GastosScanner.open(mode), mode);
    const input = page.locator("#smartScannerGalleryFile");
    await input.setInputFiles(image);
    await expect(page.locator("#smartScannerStatus")).toContainText(
      "Falha ao carregar",
    );
    await expect(input).toHaveValue("");
    await input.setInputFiles(image);
    await expect(page.locator("#smartScannerResult")).toBeVisible();
    await expect(page.locator("#smartScannerResultTitle")).toHaveText(
      mode === "qr" ? "NFC-e identificada" : "Cupom interpretado",
    );
    expect(attempts).toBe(2);
  });
