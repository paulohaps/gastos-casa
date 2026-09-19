const RO_HOSTS = new Set([
  'nfce.sefin.ro.gov.br',
  'www.nfce.sefin.ro.gov.br'
]);

function htmlToText(html) {
  return String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/tr>|<\/li>|<\/h\d>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function looksLikeCaptcha(text) {
  const value = String(text || '').toLowerCase();
  return /captcha|recaptcha|não sou um robô|nao sou um robo/.test(value);
}

function isAllowedRoUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && RO_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export async function fetchRoNfceByQr(verificationUrl, expectedAccessKey, { timeoutMs = 6500 } = {}) {
  if (!isAllowedRoUrl(verificationUrl)) {
    return { status:'not_applicable', official:false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(verificationUrl, {
      method:'GET',
      redirect:'follow',
      signal:controller.signal,
      headers:{
        Accept:'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'User-Agent':'GastosCasaReceipt/1.0 (+consumer NFC-e validation)'
      }
    });

    const finalUrl = response.url || verificationUrl;
    if (!isAllowedRoUrl(finalUrl)) {
      return { status:'redirect_blocked', official:false };
    }

    const html = await response.text();
    const text = htmlToText(html).slice(0, 30000);

    if (looksLikeCaptcha(text)) {
      return {
        status:'captcha_required',
        official:true,
        httpStatus:response.status,
        finalUrl,
        text:''
      };
    }

    if (!response.ok) {
      return {
        status:'unavailable',
        official:true,
        httpStatus:response.status,
        finalUrl,
        text:''
      };
    }

    const expected = String(expectedAccessKey || '').replace(/\D/g, '');
    const compact = text.replace(/\D/g, '');
    const keyMatched = expected.length === 44 && compact.includes(expected);

    return {
      status:'fetched',
      official:true,
      httpStatus:response.status,
      finalUrl,
      keyMatched,
      text
    };
  } catch (error) {
    return {
      status:error?.name === 'AbortError' ? 'timeout' : 'unavailable',
      official:true,
      error:error?.message || 'Falha ao consultar NFC-e.'
    };
  } finally {
    clearTimeout(timeout);
  }
}
