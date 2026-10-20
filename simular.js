/* Simulador de telhado - Do Teto ao Jardim
   Recebe a foto, pede para a IA do Google limpar ou pintar o telhado e devolve a imagem.
   Variáveis de ambiente (Vercel > Settings > Environment Variables):
     GEMINI_API_KEY   (obrigatória) chave do Google AI Studio
     GEMINI_MODEL     (opcional)    padrão: gemini-3.1-flash-image
     ALLOWED_ORIGINS  (opcional)    sites que podem chamar esta API, separados por vírgula
     LIMIT_PER_HOUR   (opcional)    simulações por pessoa por hora, padrão 12
     LIMIT_PER_DAY    (opcional)    simulações no total por dia, padrão 300
*/
const COLORS = {
  'Cerâmica': '#B65A3C', 'Vermelho colonial': '#A33B2E', 'Marrom café': '#5E4032', 'Cinza claro': '#A7A9A8',
  'Cinza grafite': '#4A4D50', 'Preto': '#26282A', 'Verde musgo': '#556B4A', 'Branco': '#E8E6E0'
};
const KEEP = 'Keep the exact same camera angle, framing, composition, house, walls, windows, gutters, solar panels, plants, sky, lighting and shadows. Do not change anything that is not the roof. Do not add or remove objects, text or people. Photorealistic, natural result, same image proportions.';
const PROMPT_CLEAN = 'Edit this photo of a house. Make ONLY the roof look freshly and professionally cleaned: remove all dirt, black mold, algae, moss, lichen, dark streaks and stains from the roof tiles, restoring the original clean color of the tiles while keeping the real tile shapes, texture and natural shading. ' + KEEP;
const promptPaint = (name, hex) => 'Edit this photo of a house that has a clean roof. Repaint ONLY the roof tiles with rubberized waterproofing roof paint in the color "' + name + '" (approximately ' + hex + '), applied evenly with a smooth semi-matte finish that still shows the tile ridges, edges and natural shadows. ' + KEEP;

const hits = new Map();
let day = { d: '', n: 0 };
const num = (v, d) => { const n = parseInt(v, 10); return n > 0 ? n : d; };

function limited(ip) {
  const now = Date.now(), w = 3600e3, lim = num(process.env.LIMIT_PER_HOUR, 12);
  const today = new Date().toISOString().slice(0, 10);
  if (day.d !== today) day = { d: today, n: 0 };
  if (day.n >= num(process.env.LIMIT_PER_DAY, 300)) return true;
  const a = (hits.get(ip) || []).filter(t => now - t < w);
  if (a.length >= lim) { hits.set(ip, a); return true; }
  a.push(now); hits.set(ip, a); day.n++;
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < w)) hits.delete(k);
  return false;
}

function pickImage(j) {
  const parts = (j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  for (const p of parts) { const d = p.inlineData || p.inline_data; if (d && d.data) return { data: d.data, mime: d.mimeType || d.mime_type || 'image/png' }; }
  if (j && j.output_image && j.output_image.data) return { data: j.output_image.data, mime: j.output_image.mime_type || 'image/png' };
  const steps = (j && j.steps) || [];
  for (const s of steps) for (const c of (s.content || [])) if (c.type === 'image' && c.data) return { data: c.data, mime: c.mime_type || 'image/png' };
  return null;
}

async function viaGenerateContent(model, key, prompt, b64, mime) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: b64 } }] }], generationConfig: { responseModalities: ['IMAGE'] } })
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, img: r.ok ? pickImage(j) : null, raw: j };
}
async function viaInteractions(model, key, prompt, b64, mime) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ model, input: [{ type: 'text', text: prompt }, { type: 'image', mime_type: mime, data: b64 }], response_format: { type: 'image' } })
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, img: r.ok ? pickImage(j) : null, raw: j };
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const host = req.headers.host || '';
  const sameOrigin = !origin || origin.replace(/^https?:\/\//, '') === host;
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  } else if (!sameOrigin) { return res.status(403).json({ error: 'Origem não permitida.' }); }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'Servidor sem chave de IA configurada.' });

  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body.image || '');
  if (!m) return res.status(400).json({ error: 'Foto inválida.' });
  if (m[2].length > 3.2e6) return res.status(413).json({ error: 'Foto grande demais.' });
  let prompt;
  if (body.color) {
    const hex = COLORS[body.color];
    if (!hex) return res.status(400).json({ error: 'Cor inválida.' });
    prompt = promptPaint(body.color, hex);
  } else prompt = PROMPT_CLEAN;

  const ip = ((req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress || 'x').trim();
  if (limited(ip)) return res.status(429).json({ error: 'Limite de simulações atingido.' });

  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-image';
  const attempts = [() => viaGenerateContent(model, key, prompt, m[2], m[1]), () => viaInteractions(model, key, prompt, m[2], m[1]), () => viaGenerateContent('gemini-2.5-flash-image', key, prompt, m[2], m[1])];
  let noImage = false, last = null;
  for (const run of attempts) {
    try {
      const r = await run(); last = r;
      if (r.ok && r.img) return res.status(200).json({ image: 'data:' + r.img.mime + ';base64,' + r.img.data });
      if (r.ok && !r.img) { noImage = true; break; }
      if (r.status === 429) return res.status(503).json({ error: 'Serviço de IA ocupado.' });
    } catch (e) { last = { status: 0, raw: String(e) }; }
  }
  console.error('Falha na IA', last && last.status, JSON.stringify(last && last.raw).slice(0, 500));
  if (noImage) return res.status(422).json({ error: 'A IA não retornou uma imagem.' });
  return res.status(502).json({ error: 'Falha no serviço de IA.' });
};
