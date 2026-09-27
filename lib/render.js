// Monta a arte 1080x1080 do post de notícia (layout aprovado no Canva).
// Fluxo: layout (satori) -> SVG -> PNG (resvg) -> JPEG opcional (sharp).
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { POPPINS_500, POPPINS_700 } from './fonts.js';

const SIZE = 1080;
const MARGIN = 72;

export const CORES = {
  coral: '#E4352B',
  marinho: '#0B1B2B',
  branco: '#FFFFFF',
};

let fontsCache;
async function loadFonts() {
  if (!fontsCache) {
    const medium = Buffer.from(POPPINS_500, 'base64');
    const bold = Buffer.from(POPPINS_700, 'base64');
    fontsCache = [
      { name: 'Poppins', data: medium, weight: 500, style: 'normal' },
      { name: 'Poppins', data: bold, weight: 700, style: 'normal' },
    ];
  }
  return fontsCache;
}

// Elemento no formato que o satori entende (equivalente a JSX, sem precisar de build).
function h(type, style, ...children) {
  const flat = children.flat().filter((c) => c !== null && c !== undefined && c !== false);
  const props = { style };
  if (flat.length === 1) props.children = flat[0];
  else if (flat.length > 1) props.children = flat;
  return { type, props };
}

function limpar(texto, max) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

// Editorias usadas pelo classificador do agente (handoff 22/09). Aceita variações
// de caixa e acento ("politica", "ECONOMIA") e devolve a forma oficial.
export const EDITORIAS = ['Política', 'Esporte', 'Economia', 'Cultura', 'Tecnologia', 'Saúde', 'Outros'];
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const EDITORIA_POR_CHAVE = Object.fromEntries(EDITORIAS.map((e) => [semAcento(e), e]));

// "Outros" (ou vazio) não vira tarja: um rótulo genérico não informa nada ao leitor.
export function normalizarEditoria(valor) {
  const t = limpar(valor, 28);
  if (!t) return '';
  const oficial = EDITORIA_POR_CHAVE[semAcento(t)];
  if (oficial === 'Outros') return '';
  return oficial ?? t;
}

// Aceita tanto a URL da foto quanto um trecho HTML com <img src="..."> (ex.: a
// descrição do item do RSS do G1), extraindo a primeira imagem.
export function extrairUrlFoto(valor) {
  const t = String(valor ?? '').trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t) && !/[<>"\s]/.test(t)) return t;
  const m = t.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i) || t.match(/https?:\/\/[^\s"'<>]+\.(?:jpe?g|png|webp)(?:\?[^\s"'<>]*)?/i);
  if (!m) return '';
  return (m[1] ?? m[0]).replace(/&amp;/g, '&');
}

// Manchetes mais longas ganham fonte menor para caber em até ~4 linhas.
export function tamanhoTitulo(titulo) {
  const n = titulo.length;
  if (n <= 45) return 72;
  if (n <= 70) return 64;
  if (n <= 100) return 56;
  if (n <= 130) return 50;
  return 44;
}

// Baixa a foto e converte para JPEG 1080x1080 (recorte central). Se falhar, segue sem foto.
async function prepararFoto(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'newsfirjan-post/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const input = Buffer.from(await res.arrayBuffer());
    const jpg = await sharp(input)
      .rotate()
      .resize(SIZE, SIZE, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 85 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpg.toString('base64')}`;
  } catch (err) {
    console.warn(`[newsfirjan-post] foto ignorada (${url}): ${err.message}`);
    return null;
  }
}

function layout({ editoria, titulo, fotoDataUri, perfil }) {
  const fontSize = tamanhoTitulo(titulo);

  return h(
    'div',
    {
      width: SIZE,
      height: SIZE,
      display: 'flex',
      position: 'relative',
      backgroundColor: CORES.marinho,
      fontFamily: 'Poppins',
      color: CORES.branco,
    },
    // Foto sangrada
    fotoDataUri &&
      h('img', {
        position: 'absolute',
        top: 0,
        left: 0,
        width: SIZE,
        height: SIZE,
        objectFit: 'cover',
      }),
    // Degradê marinho na metade de baixo (legibilidade do texto)
    h('div', {
      position: 'absolute',
      left: 0,
      top: 360,
      width: SIZE,
      height: SIZE - 360,
      display: 'flex',
      backgroundImage:
        'linear-gradient(to bottom, rgba(11,27,43,0) 0%, rgba(11,27,43,0.55) 35%, rgba(11,27,43,0.95) 100%)',
    }),
    // Sombra leve no topo, para o nome do perfil aparecer em fotos claras
    h('div', {
      position: 'absolute',
      left: 0,
      top: 0,
      width: SIZE,
      height: 200,
      display: 'flex',
      backgroundImage: 'linear-gradient(to bottom, rgba(11,27,43,0.6) 0%, rgba(11,27,43,0) 100%)',
    }),
    // Faixa coral na borda esquerda
    h('div', {
      position: 'absolute',
      left: 0,
      top: 0,
      width: 14,
      height: SIZE,
      backgroundColor: CORES.coral,
    }),
    // Nome do projeto (no lugar do logo)
    h(
      'div',
      {
        position: 'absolute',
        left: MARGIN,
        top: 56,
        fontSize: 36,
        fontWeight: 700,
        letterSpacing: -0.5,
      },
      perfil.replace(/^@/, '')
    ),
    // Bloco Editoria + Título, ancorado embaixo (cresce para cima)
    h(
      'div',
      {
        position: 'absolute',
        left: MARGIN,
        right: MARGIN,
        bottom: 150,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
      },
      editoria &&
        h(
          'div',
          {
            display: 'flex',
            backgroundColor: CORES.coral,
            padding: '8px 18px',
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 22,
          },
          editoria
        ),
      h(
        'div',
        {
          display: 'flex',
          fontSize,
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: -0.5,
        },
        titulo
      )
    ),
    // Linha do rodapé
    h('div', {
      position: 'absolute',
      left: MARGIN,
      top: 966,
      width: SIZE - MARGIN * 2,
      height: 2,
      backgroundColor: 'rgba(255,255,255,0.4)',
    }),
    // Rodapé
    h(
      'div',
      {
        position: 'absolute',
        left: MARGIN,
        right: MARGIN,
        top: 988,
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 22,
      },
      h('div', { fontWeight: 500, color: 'rgba(255,255,255,0.85)' }, perfil),
      h('div', { fontWeight: 700, color: CORES.coral, letterSpacing: 1 }, 'LEIA NA LEGENDA ›')
    )
  );
}

/**
 * Gera a arte.
 * @param {object} opts
 * @param {string} opts.editoria  uma das EDITORIAS; "Outros" não gera tarja
 * @param {string} opts.titulo    a manchete
 * @param {string} [opts.foto]    URL pública da foto, ou HTML com <img src> (ex.: descrição do RSS do G1). Opcional.
 * @param {string} [opts.perfil]  @ do rodapé (padrão @newsfirjan)
 * @param {'jpg'|'png'} [opts.formato] padrão jpg (o Instagram só aceita JPEG)
 * @returns {Promise<{buffer: Buffer, contentType: string}>}
 */
export async function renderPost({ editoria, titulo, foto, perfil = '@newsfirjan', formato = 'jpg' }) {
  // Espaço inquebrável entre número e unidade ("38 °C", "10 %", "3 mil") para não separar na quebra de linha.
  const tituloLimpo = limpar(titulo, 160).replace(/(\d)\s+(°|%|km\b|kg\b|mil\b|milhões\b|milhão\b|bilhões\b|bi\b|anos\b)/gi, '$1\u00a0$2');
  if (!tituloLimpo) throw new Error('O campo "titulo" é obrigatório.');
  const editoriaLimpa = normalizarEditoria(editoria);
  const perfilLimpo = limpar(perfil, 30) || '@newsfirjan';

  const [fonts, fotoDataUri] = await Promise.all([loadFonts(), prepararFoto(extrairUrlFoto(foto))]);

  const tree = layout({
    editoria: editoriaLimpa,
    titulo: tituloLimpo,
    fotoDataUri,
    perfil: perfilLimpo.startsWith('@') ? perfilLimpo : `@${perfilLimpo}`,
  });
  // o src da imagem vai em props (não em style)
  if (fotoDataUri) {
    const img = tree.props.children[0];
    img.props = { src: fotoDataUri, width: SIZE, height: SIZE, style: img.props.style };
  }

  const svg = await satori(tree, { width: SIZE, height: SIZE, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: SIZE } }).render().asPng();

  if (formato === 'png') return { buffer: png, contentType: 'image/png' };
  const jpg = await sharp(png).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  return { buffer: jpg, contentType: 'image/jpeg' };
}
