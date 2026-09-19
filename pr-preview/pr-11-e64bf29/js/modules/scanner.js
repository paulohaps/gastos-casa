(function () {
  'use strict';

  const state = {
    open: false,
    mode: 'qr',
    stream: null,
    scanning: false,
    raf: null,
    decoderLoading: null,
    ocrLoading: null,
    session: 0,
    pending: null
  };

  const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
  const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

  function toast(message, error) {
    if (window.AppUI?.toast) return window.AppUI.toast(message, error ? 'error' : 'success');
    console[error ? 'error' : 'log'](message);
  }

  function els() {
    return {
      backdrop: document.getElementById('smartScannerBackdrop'),
      dialog: document.getElementById('smartScannerDialog'),
      video: document.getElementById('smartScannerVideo'),
      canvas: document.getElementById('smartScannerCanvas'),
      status: document.getElementById('smartScannerStatus'),
      cameraFile: document.getElementById('smartScannerCameraFile'),
      galleryFile: document.getElementById('smartScannerGalleryFile'),
      qrButton: document.getElementById('smartScannerModeQr'),
      receiptButton: document.getElementById('smartScannerModeReceipt'),
      captureButton: document.getElementById('smartScannerCapture'),
      galleryButton: document.getElementById('smartScannerGallery'),
      result: document.getElementById('smartScannerResult'),
      resultTitle: document.getElementById('smartScannerResultTitle'),
      resultMeta: document.getElementById('smartScannerResultMeta'),
      items: document.getElementById('smartScannerItems'),
      continueButton: document.getElementById('smartScannerContinue'),
      fiscalLink: document.getElementById('smartScannerFiscalLink'),
      usePhotoButton: document.getElementById('smartScannerUsePhoto'),
      verificationNote: document.getElementById('smartScannerVerificationNote')
    };
  }

  function setStatus(message, kind) {
    const el = els().status;
    if (!el) return;
    el.textContent = message || '';
    el.dataset.kind = kind || 'neutral';
  }

  function loadScriptOnce(src, globalName) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-smart-scanner="' + globalName + '"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window[globalName]), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.smartScanner = globalName;
      script.onload = () => resolve(window[globalName]);
      script.onerror = () => reject(new Error('Falha ao carregar recurso de leitura.'));
      document.head.appendChild(script);
    });
  }

  function ensureQrFallback() {
    if (!state.decoderLoading) state.decoderLoading = loadScriptOnce(JSQR_URL, 'jsQR');
    return state.decoderLoading;
  }

  function ensureOcr() {
    if (!state.ocrLoading) state.ocrLoading = loadScriptOnce(TESSERACT_URL, 'Tesseract');
    return state.ocrLoading;
  }

  function hideResult() {
    state.pending = null;
    const { result, items, continueButton, fiscalLink, usePhotoButton, verificationNote } = els();
    result?.classList.add('hidden');
    if (items) items.innerHTML = '';
    continueButton?.classList.add('hidden');
    fiscalLink?.classList.add('hidden');
    usePhotoButton?.classList.add('hidden');
    verificationNote?.classList.add('hidden');
  }

  function showResultBase(title, meta) {
    const { result, resultTitle, resultMeta } = els();
    if (resultTitle) resultTitle.textContent = title || 'Leitura encontrada';
    if (resultMeta) resultMeta.textContent = meta || '';
    result?.classList.remove('hidden');
  }

  function renderItems(items) {
    const box = els().items;
    if (!box) return;
    box.innerHTML = '';
    if (!items?.length) {
      const empty = document.createElement('p');
      empty.className = 'scanner-result__empty';
      empty.textContent = 'Nenhum item individual foi identificado com confiança suficiente.';
      box.appendChild(empty);
      return;
    }

    items.slice(0, 8).forEach(item => {
      const row = document.createElement('div');
      row.className = 'scanner-item-row';
      const name = document.createElement('span');
      name.textContent = item.description;
      const value = document.createElement('strong');
      value.textContent = Number(item.total || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
      row.append(name, value);
      box.appendChild(row);
    });

    if (items.length > 8) {
      const more = document.createElement('p');
      more.className = 'scanner-result__more';
      more.textContent = '+' + (items.length - 8) + ' itens identificados';
      box.appendChild(more);
    }
  }

  function renderQrAnalysis(analysis) {
    const { continueButton, fiscalLink, usePhotoButton, verificationNote } = els();
    const totalText = analysis.total
      ? Number(analysis.total).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
      : 'valor não veio no QR';
    const meta = [
      analysis.host ? 'Portal: ' + analysis.host : null,
      analysis.accessKey ? 'Chave: ' + analysis.accessKey.slice(0, 8) + '…' + analysis.accessKey.slice(-6) : null,
      'Total: ' + totalText
    ].filter(Boolean).join(' • ');

    showResultBase('NFC-e identificada', meta);
    renderItems([]);

    state.pending = {
      mode: 'qr',
      payload: analysis.summaryText,
      analysis
    };

    if (analysis.total) {
      continueButton?.classList.remove('hidden');
      setStatus('QR lido com valor explícito. Confira e continue para o lançamento.', 'success');
    } else {
      if (analysis.url && fiscalLink) {
        fiscalLink.href = analysis.url;
        fiscalLink.classList.remove('hidden');
      }
      usePhotoButton?.classList.remove('hidden');
      verificationNote?.classList.remove('hidden');
      setStatus('QR identificado, mas o valor depende da consulta fiscal. Você pode abrir o portal ou fotografar o cupom.', 'warning');
    }
  }

  function renderReceiptAnalysis(text, analysis) {
    const { continueButton } = els();
    const meta = [
      analysis.merchant || null,
      analysis.total ? 'Total: ' + Number(analysis.total).toLocaleString('pt-BR', { style:'currency', currency:'BRL' }) : 'Total precisa de revisão',
      analysis.date ? 'Data: ' + analysis.date : null,
      analysis.itemCount ? analysis.itemCount + (analysis.itemCount === 1 ? ' item' : ' itens') : null
    ].filter(Boolean).join(' • ');

    showResultBase('Cupom interpretado', meta);
    renderItems(analysis.items);
    continueButton?.classList.remove('hidden');

    state.pending = {
      mode: 'receipt',
      payload: window.GastosReceiptParser?.compactReceiptSummary(analysis) || String(text || '').slice(0, 480),
      analysis
    };

    setStatus(
      analysis.itemCount
        ? 'Cupom lido. Confira os itens encontrados antes de continuar.'
        : 'Cupom lido. Confira estabelecimento e total antes de continuar.',
      analysis.total ? 'success' : 'warning'
    );

    if (!analysis.total) {
      const note = els().verificationNote;
      if (note) {
        note.textContent = 'O OCR não encontrou um total confiável. O lançamento seguirá para revisão, sem inventar valor.';
        note.classList.remove('hidden');
      }
    }
  }

  function updateModeUi() {
    const { qrButton, receiptButton, video, captureButton, cameraFile, galleryFile } = els();
    qrButton?.classList.toggle('is-active', state.mode === 'qr');
    receiptButton?.classList.toggle('is-active', state.mode === 'receipt');
    if (video) video.classList.toggle('hidden', state.mode !== 'qr');
    if (captureButton) {
      captureButton.innerHTML = state.mode === 'qr'
        ? '<i class="fa-solid fa-camera"></i><span>Fotografar QR</span>'
        : '<i class="fa-solid fa-camera"></i><span>Fotografar cupom</span>';
    }
    if (cameraFile) cameraFile.accept = 'image/*';
    if (galleryFile) galleryFile.accept = 'image/*';
  }

  async function stopCamera() {
    state.scanning = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = null;
    state.stream?.getTracks?.().forEach(track => track.stop());
    state.stream = null;
    const video = els().video;
    if (video) {
      video.pause?.();
      video.srcObject = null;
    }
  }

  async function close() {
    state.session += 1;
    await stopCamera();
    state.open = false;
    hideResult();
    els().backdrop?.classList.add('hidden');
    document.body.classList.remove('scanner-open');
  }

  async function open(mode) {
    state.session += 1;
    state.mode = mode === 'receipt' ? 'receipt' : 'qr';
    state.open = true;
    hideResult();
    const backdrop = els().backdrop;
    if (!backdrop) return;
    backdrop.classList.remove('hidden');
    document.body.classList.add('scanner-open');
    updateModeUi();

    if (state.mode === 'qr') {
      setStatus('Aponte a câmera para o QR Code da NFC-e.', 'neutral');
      await startQrCamera();
    } else {
      await stopCamera();
      setStatus('Fotografe o cupom inteiro, com boa luz e sem cortar o valor total.', 'neutral');
    }
  }

  async function setMode(mode) {
    state.session += 1;
    state.mode = mode === 'receipt' ? 'receipt' : 'qr';
    hideResult();
    updateModeUi();
    if (state.mode === 'qr') {
      setStatus('Aponte a câmera para o QR Code da NFC-e.', 'neutral');
      await startQrCamera();
    } else {
      await stopCamera();
      setStatus('Fotografe o cupom inteiro, com boa luz e sem cortar o valor total.', 'neutral');
    }
  }

  async function decodeCanvas(canvas) {
    if ('BarcodeDetector' in window) {
      try {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        const found = await detector.detect(canvas);
        if (found?.[0]?.rawValue) return found[0].rawValue;
      } catch {}
    }

    const jsQR = await ensureQrFallback();
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR?.(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
    return result?.data || null;
  }

  async function scanFrame() {
    if (!state.scanning || state.mode !== 'qr') return;
    const { video, canvas } = els();
    if (!video || !canvas || video.readyState < 2) {
      state.raf = requestAnimationFrame(scanFrame);
      return;
    }

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    const maxWidth = 960;
    const scale = Math.min(1, maxWidth / width);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const payload = await decodeCanvas(canvas);
      if (payload) {
        state.scanning = false;
        await handleQr(payload);
        return;
      }
    } catch (error) {
      console.warn('Falha temporária na leitura do QR:', error);
    }

    state.raf = requestAnimationFrame(scanFrame);
  }

  async function startQrCamera() {
    const session = state.session;
    await stopCamera();
    const video = els().video;
    if (!video || !navigator.mediaDevices?.getUserMedia) {
      setStatus('Câmera ao vivo indisponível. Use “Ler QR de uma foto”.', 'warning');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      if (!state.open || state.mode !== 'qr' || session !== state.session) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      state.stream = stream;
      video.srcObject = state.stream;
      await video.play();
      state.scanning = true;
      state.raf = requestAnimationFrame(scanFrame);
    } catch (error) {
      console.warn('Câmera indisponível:', error);
      setStatus('Não consegui abrir a câmera. Você pode selecionar uma foto do QR.', 'warning');
    }
  }

  async function handleQr(payload) {
    setStatus('QR identificado. Lendo os dados fiscais disponíveis…', 'working');
    await stopCamera();
    try {
      const analysis = window.GastosReceiptParser?.analyzeQrPayload(payload);
      if (!analysis) throw new Error('Não consegui interpretar o conteúdo do QR.');
      renderQrAnalysis(analysis);
    } catch (error) {
      setStatus('QR lido, mas não consegui interpretar os dados.', 'error');
      toast(error?.message || 'Não foi possível interpretar o QR.', true);
    }
  }

  async function decodeQrImage(file) {
    const bitmap = await createImageBitmap(file);
    const canvas = els().canvas;
    const maxWidth = 1400;
    const scale = Math.min(1, maxWidth / bitmap.width);
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return decodeCanvas(canvas);
  }

  async function optimizeReceipt(file) {
    const bitmap = await createImageBitmap(file);
    const maxWidth = 1600;
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .88));
  }

  function previewReceiptText(text) {
    const clean = String(text || '').trim();
    if (clean.length < 8) throw new Error('Não encontrei texto legível no cupom.');
    const analysis = window.GastosReceiptParser?.analyzeReceiptText(clean);
    if (!analysis) throw new Error('Não consegui estruturar o cupom.');
    renderReceiptAnalysis(clean, analysis);
    return analysis;
  }

  function previewQrPayload(payload) {
    const analysis = window.GastosReceiptParser?.analyzeQrPayload(payload);
    if (!analysis) throw new Error('Não consegui interpretar o QR.');
    renderQrAnalysis(analysis);
    return analysis;
  }

  async function readReceipt(file, session) {
    setStatus('Preparando a imagem…', 'working');
    const blob = await optimizeReceipt(file);
    const url = URL.createObjectURL(blob || file);
    try {
      const Tesseract = await ensureOcr();
      setStatus('Lendo o cupom no aparelho… 0%', 'working');
      const result = await Tesseract.recognize(url, 'por', {
        logger: event => {
          if (event?.status === 'recognizing text' && Number.isFinite(event.progress)) {
            setStatus('Lendo o cupom no aparelho… ' + Math.round(event.progress * 100) + '%', 'working');
          }
        }
      });
      const text = String(result?.data?.text || '').trim();
      if (!state.open || session !== state.session) return;
      previewReceiptText(text);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function continuePending() {
    if (!state.pending) return;
    const pending = state.pending;
    setStatus('Enviando para a prévia do lançamento…', 'working');
    try {
      const result = await window.GastosSmartEntry?.interpretExternal(pending.payload, pending.mode);
      if (!result) throw new Error('Não foi possível montar a prévia do lançamento.');

      if (pending.mode === 'receipt' && pending.analysis) {
        const itemDescription = window.GastosReceiptParser?.buildItemsDescription(
          pending.analysis.items,
          500
        );
        window.GastosSmartEntry?.applyExternalOverrides?.({
          descricao: itemDescription || result?.draft?.descricao || '',
          estabelecimento: pending.analysis.merchant || '',
          valor: pending.analysis.total || null,
          dataBr: pending.analysis.date || ''
        });
      }

      await close();
      toast('Leitura concluída. Revise os dados antes de confirmar.');
    } catch (error) {
      setStatus(error?.message || 'Não foi possível continuar com a leitura.', 'error');
      toast(error?.message || 'Não foi possível continuar com a leitura.', true);
    }
  }

  async function handleFile(file) {
    if (!file) return;
    const session = state.session;
    if (!/^image\//.test(file.type || '')) {
      toast('Selecione uma imagem.', true);
      return;
    }

    try {
      hideResult();
      if (state.mode === 'qr') {
        setStatus('Procurando QR Code na imagem…', 'working');
        const payload = await decodeQrImage(file);
        if (!payload) {
          setStatus('Não encontrei QR nessa foto. Tente aproximar ou use o modo Cupom.', 'warning');
          return;
        }
        await handleQr(payload);
      } else {
        await readReceipt(file, session);
      }
    } catch (error) {
      console.error('Scanner:', error);
      setStatus(error?.message || 'Não foi possível ler a imagem.', 'error');
      toast(error?.message || 'Não foi possível ler a imagem.', true);
    } finally {
      const { cameraFile, galleryFile } = els();
      if (cameraFile) cameraFile.value = '';
      if (galleryFile) galleryFile.value = '';
    }
  }

  function bind() {
    document.getElementById('btnSmartScanner')?.addEventListener('click', () => open('qr'));
    document.getElementById('smartScannerClose')?.addEventListener('click', close);
    document.getElementById('smartScannerBackdrop')?.addEventListener('click', event => {
      if (event.target?.id === 'smartScannerBackdrop') close();
    });
    document.getElementById('smartScannerModeQr')?.addEventListener('click', () => setMode('qr'));
    document.getElementById('smartScannerModeReceipt')?.addEventListener('click', () => setMode('receipt'));
    document.getElementById('smartScannerCapture')?.addEventListener('click', () => els().cameraFile?.click());
    document.getElementById('smartScannerGallery')?.addEventListener('click', () => els().galleryFile?.click());
    document.getElementById('smartScannerCameraFile')?.addEventListener('change', event => handleFile(event.target.files?.[0]));
    document.getElementById('smartScannerGalleryFile')?.addEventListener('change', event => handleFile(event.target.files?.[0]));
    document.getElementById('smartScannerContinue')?.addEventListener('click', continuePending);
    document.getElementById('smartScannerUsePhoto')?.addEventListener('click', () => setMode('receipt'));
    window.addEventListener('pagehide', stopCamera);
  }

  function init() {
    bind();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.GastosScanner = {
    open,
    close,
    setMode,
    previewReceiptText,
    previewQrPayload
  };
})();