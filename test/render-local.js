// Teste local: gera artes de exemplo em test/saida/ sem precisar de deploy.
// Uso: npm test
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { renderPost } from '../lib/render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'saida');

// Duas "fotos" sintéticas: uma escura e uma bem clara (pior caso de legibilidade).
async function fotoFake(claro) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${claro ? '#f4efe6' : '#3d5a73'}"/>
      <stop offset="1" stop-color="${claro ? '#d9e7f0' : '#1b2733'}"/></linearGradient></defs>
    <rect width="1600" height="1000" fill="url(#g)"/>
    <circle cx="800" cy="420" r="260" fill="${claro ? '#ffffff' : '#6d8ba3'}"/>
    <rect x="0" y="760" width="1600" height="240" fill="${claro ? '#e8e2d4' : '#24313d'}"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

const fotos = { '/escura.jpg': await fotoFake(false), '/clara.jpg': await fotoFake(true) };
const server = http.createServer((req, res) => {
  const buf = fotos[req.url.split("?")[0]];
  if (!buf) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': 'image/jpeg' }).end(buf);
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const casos = [
  { nome: '1-curto-foto-escura', editoria: 'Política', titulo: 'Câmara aprova reforma tributária em 2º turno', foto: `${base}/escura.jpg` },
  { nome: '2-medio-foto-clara', editoria: 'Esporte', titulo: 'Seleção vence o Uruguai por 3 a 1 e garante vaga na final da Copa América', foto: `${base}/clara.jpg` },
  { nome: '3-longo-sem-foto', editoria: 'Economia', titulo: 'Banco Central mantém a taxa Selic em 10,5% ao ano pela terceira reunião seguida e sinaliza cautela diante da alta do dólar e da inflação de serviços' },
  { nome: '4-foto-quebrada', editoria: 'Tecnologia', titulo: 'Nova lei de proteção de dados entra em vigor nesta segunda-feira', foto: `${base}/nao-existe.jpg` },
  // Como chega do RSS do G1: descrição em HTML com <img>, editoria "Outros" (sem tarja)
  { nome: '5-html-rss-outros', editoria: 'outros', titulo: 'Onda de calor deve elevar temperaturas acima de 38 °C no fim de semana', foto: `<img src="${base}/clara.jpg?w=1&amp;h=2" /><br/>Texto da descrição do G1...` },
  { nome: '6-editoria-sem-acento', editoria: 'SAUDE', titulo: 'Ministério amplia vacinação contra a gripe para todas as idades' },
];

// Verificações rápidas das regras de entrada
const { normalizarEditoria, extrairUrlFoto } = await import('../lib/render.js');
const checks = [
  [normalizarEditoria('politica'), 'Política'],
  [normalizarEditoria('SAÚDE'), 'Saúde'],
  [normalizarEditoria('Outros'), ''],
  [normalizarEditoria(''), ''],
  [normalizarEditoria('Mundo'), 'Mundo'],
  [extrairUrlFoto('https://s2.glbimg.com/a.jpg'), 'https://s2.glbimg.com/a.jpg'],
  [extrairUrlFoto('<img src="https://s2.glbimg.com/a.jpg?x=1&amp;y=2" /> texto'), 'https://s2.glbimg.com/a.jpg?x=1&y=2'],
  [extrairUrlFoto('sem imagem aqui'), ''],
];
checks.forEach(([got, want], i) => {
  if (got !== want) throw new Error(`check ${i}: esperado "${want}", veio "${got}"`);
});
console.log(`${checks.length} verificações de entrada OK`);

await mkdir(OUT, { recursive: true });
for (const c of casos) {
  const t0 = Date.now();
  const { buffer, contentType } = await renderPost(c);
  const ext = contentType === 'image/png' ? 'png' : 'jpg';
  const file = path.join(OUT, `${c.nome}.${ext}`);
  await writeFile(file, buffer);
  const meta = await sharp(buffer).metadata();
  console.log(`${c.nome}: ${meta.width}x${meta.height} ${meta.format} ${(buffer.length / 1024).toFixed(0)} KB em ${Date.now() - t0} ms`);
}
server.close();
