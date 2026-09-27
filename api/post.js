// Endpoint da Vercel: GET /api/post?editoria=...&titulo=...&foto=...
// Devolve a arte 1080x1080 (JPEG por padrão). A própria URL serve como "link da imagem"
// para os módulos do Make (Telegram, Instagram, Facebook).

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
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

// O gerador é carregado sob demanda: se alguma dependência falhar ao carregar,
// a resposta mostra o motivo em vez de derrubar a função.
let renderPost;
async function carregarGerador() {
  if (!renderPost) ({ renderPost } = await import('../lib/render.js'));
  return renderPost;
}

async function handler(request) {
  const p = await lerParametros(request);

  // Proteção opcional: se a variável CHAVE_ACESSO existir na Vercel, exige ?chave=...
  const chaveEsperada = process.env.CHAVE_ACESSO;
  if (chaveEsperada && p.chave !== chaveEsperada) return json(401, { erro: 'Chave de acesso inválida.' });

  if (!p.titulo || !String(p.titulo).trim()) {
    return json(400, { erro: 'Informe o parâmetro "titulo".', exemplo: '/api/post?editoria=Política&titulo=Minha manchete' });
  }

  try {
    const gerar = await carregarGerador();
    const { buffer, contentType } = await gerar(p);
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
    return json(500, {
      erro: `Falha ao gerar a imagem: ${e.message}`,
      detalhe: String(e.stack || '').split('\n').slice(0, 4).join(' | '),
      node: process.version,
    });
  }
}

export async function GET(request) {
  return handler(request);
}

export async function POST(request) {
  return handler(request);
}
