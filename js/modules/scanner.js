(function () {
  'use strict';

  const state = {
    open: false,
    mode: 'qr',
    stream: null,
    scanning: false,
    raf: null,
    decoderLoading: null,
    ocrLoading: null
  };

  const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
  const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

  function toast(message, error) {
    if (window.AppUI?.toast) return window.AppUI.toast(message, error ? 'error' : 'success');
    console[error ? 'error' : 'log'](message);
  }

  function els() {
    return {
      dialog: document.getElementById('smartScannerDialog'),
      video: document.getElementById('smartScannerVideo'),
      canvas: document.getElementById('smartScannerCanvas'),
      status: document.getElementById('smartScannerStatus'),
      file: document.getElementById('smartScannerFile'),
      qrButton: document.getElementById('smartScannerModeQr'),
      receiptButton: document.getElementById('smartScannerModeReceipt'),
      captureButton: document.getElementById('smartScannerCapture')
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

  function updateModeUi() {
    const { qrButton, receiptButton, video, captureButton, file } = els();
    qrButton?.classList.toggle('is-active', state.mode === 'qr');
    receiptButton?.classList.toggle('is-active', state.mode === 'receipt');
    if (video) video.classList.toggle('hidden', state.mode !== 'qr');
    if (captureButton) {
      captureButton.innerHTML = state.mode === 'qr'
        ? '<i class="fa-solid fa-image"></i><span>Ler QR de uma foto</span>'
        : '<i class="fa-solid fa-camera"></i><span>Fotografar cupom</span>';
    }
    if (file) file.accept = 'image/*';
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
    await stopCamera();
    state.open = false;
    const dialog = els().dialog;
    if (dialog) dialog.classList.add('hidden');
    document.body.classList.remove('scanner-open');
  }

  async function open(mode) {
    state.mode = mode === 'receipt' ? 'receipt' : 'qr';
    state.open = true;
    const dialog = els().dialog;
    if (!dialog) return;
    dialog.classList.remove('hidden');
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
    state.mode = mode === 'receipt' ? 'receipt' : 'qr';
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
    await stopCamera();
    const video = els().video;
    if (!video || !navigator.mediaDevices?.getUserMedia) {
      setStatus('Câmera ao vivo indisponível. Use “Ler QR de uma foto”.', 'warning');
      return;
    }

    try {
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
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
    setStatus('QR identificado. Interpretando a NFC-e…', 'working');
    await stopCamera();
    try {
      const result = await window.GastosSmartEntry?.interpretExternal(payload, 'qr');
      if (!result?.draft?.valor) {
        setStatus('QR identificado, mas o valor não veio explícito no código. Fotografe o cupom para completar automaticamente.', 'warning');
        return;
      }
      await close();
      toast('QR lido. Revise os dados antes de confirmar.');
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

  async function readReceipt(file) {
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
      if (text.length < 8) throw new Error('Não encontrei texto legível no cupom.');
      setStatus('Cupom lido. Interpretando estabelecimento, total e data…', 'working');
      await window.GastosSmartEntry?.interpretExternal(text, 'receipt');
      await close();
      toast('Cupom lido. Revise os dados antes de confirmar.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function handleFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type || '')) {
      toast('Selecione uma imagem.', true);
      return;
    }

    try {
      if (state.mode === 'qr') {
        setStatus('Procurando QR Code na imagem…', 'working');
        const payload = await decodeQrImage(file);
        if (!payload) {
          setStatus('Não encontrei QR nessa foto. Tente aproximar ou use o modo Cupom.', 'warning');
          return;
        }
        await handleQr(payload);
      } else {
        await readReceipt(file);
      }
    } catch (error) {
      console.error('Scanner:', error);
      setStatus(error?.message || 'Não foi possível ler a imagem.', 'error');
      toast(error?.message || 'Não foi possível ler a imagem.', true);
    } finally {
      const input = els().file;
      if (input) input.value = '';
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
    document.getElementById('smartScannerCapture')?.addEventListener('click', () => els().file?.click());
    document.getElementById('smartScannerFile')?.addEventListener('change', event => handleFile(event.target.files?.[0]));
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

  window.GastosScanner = { open, close, setMode };
})();