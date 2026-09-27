// Endpoint da Vercel: GET /api/post?editoria=...&titulo=...&foto=...
// Devolve a arte 1080x1080 (JPEG por padrão). A própria URL serve como "link da imagem"
// para o módulo do Instagram no Make.
import { renderPost } from '../lib/render.js';

function erro(status, mensagem) {
  return new Response(JSON.stringify({ erro: mensagem }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function lerParametros(request) {
  const url = new URL(request.url);
  const q = Object.fromEntries(url.searchParams);
  if (request.method === 'POST') {
    try {
      Object.assign(q, await request.json());
    } catch {
      /* corpo vazio ou não-JSON: usa só a query string */
    }
  }
  return {
    editoria: q.editoria ?? q.Editoria,
    titulo: q.titulo ?? q['título'] ?? q.Titulo ?? q['Título'] ?? q.titulo_arte,
    foto: q.foto,
    perfil: q.perfil,
    formato: q.formato === 'png' ? 'png' : 'jpg',
    chave: q.chave,
  };
}

async function handler(request) {
  const p = await lerParametros(request);

  // Proteção opcional: se a variável CHAVE_ACESSO existir na Vercel, exige ?chave=...
  const chaveEsperada = process.env.CHAVE_ACESSO;
  if (chaveEsperada && p.chave !== chaveEsperada) return erro(401, 'Chave de acesso inválida.');

  if (!p.titulo || !String(p.titulo).trim()) return erro(400, 'Informe o parâmetro "titulo".');

  try {
    const { buffer, contentType } = await renderPost(p);
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        // Mesmos parâmetros = mesma imagem: pode ficar em cache.
        'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable',
      },
    });
  } catch (e) {
    console.error('[newsfirjan-post]', e);
    return erro(500, `Falha ao gerar a imagem: ${e.message}`);
  }
}

export const GET = handler;
export const POST = handler;
