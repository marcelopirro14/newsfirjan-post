# Gerador de artes do agente de curadoria (newsfirjan)

Faz a arte 1080×1080 dos posts do agente a partir de três dados: a **Editoria** (vinda do Classificador), o **Título da arte** (vindo do Gerador de Copy) e a **foto** (vinda do RSS do G1). O visual é o mesmo aprovado no Canva: coral `#E4352B`, marinho `#0B1B2B` e fonte Poppins.

No Fluxo B, ele **ocupa o lugar do módulo "Canva (autofill)"**. O autofill do Canva pela API exige o plano Enterprise e um Brand Template publicado, e a conta atual não tem nenhum dos dois.

A imagem é gerada por código: **não usa a IA e não gasta tokens**. Cada arte é um link:

```
https://SEU-PROJETO.vercel.app/api/post?editoria=Política&titulo=Câmara aprova reforma&foto=https://.../foto.jpg
```

Esse link serve para a prévia no Telegram, para o Instagram e para o Facebook.

> **Restrição do curso:** o projeto previa usar só o Make, APIs de IA e integrações nativas. Este gerador é um **serviço próprio e gratuito, hospedado na Vercel**. Não é uma API paga de terceiros nem faz scraping, mas é código fora do Make. Confirme com o professor se vale como exceção. Se não valer, a alternativa é voltar ao Canva, o que exige conseguir o plano Enterprise.

---

## Parâmetros

| Parâmetro | Obrigatório | De onde vem no Make | Regras |
|---|---|---|---|
| `titulo` (ou `titulo_arte`) | sim | Gerador de Copy → `titulo_arte` | até 160 caracteres, ideal até 90. A fonte diminui sozinha. Número e unidade ficam na mesma linha ("38 °C"). |
| `editoria` | não | Classificador → `editoria` | aceita as editorias do classificador com ou sem acento (Política, Esporte, Economia, Cultura, Tecnologia, Saúde). **"Outros" não gera tarja.** Outro valor aparece como veio. |
| `foto` | não | RSS (G1) → Description ou URL da imagem | aceita **a URL da foto ou o HTML da descrição do G1**: o gerador extrai a primeira `<img>` sozinho. Sem foto, ou com o link falhando, o fundo fica marinho, sem erro. |
| `perfil` | não | fixo | padrão `@newsfirjan` |
| `formato` | não | fixo | `jpg` (padrão, único formato aceito pelo Instagram) ou `png` |
| `chave` | se ativada | fixo | senha contra uso por terceiros (veja o passo 1) |

Também aceita `POST` com JSON no corpo, com os mesmos nomes de campo.

---

## 1. Colocar no ar (grátis, cerca de 10 minutos)

1. Crie uma conta no **GitHub** (github.com) e outra na **Vercel** (vercel.com). Na Vercel, entre usando o GitHub.
2. No GitHub, clique em **New repository** com o nome `newsfirjan-post`. Depois clique em **uploading an existing file**, **abra a pasta `newsfirjan-post`**, selecione tudo que está dentro dela (as pastas `api`, `lib`, `test` e os arquivos) e arraste. Finalize com **Commit changes**.
   Confira a página inicial do repositório: ela precisa mostrar **`api`, `lib`, `test`, `package.json`, `package-lock.json` e `README.md` direto na raiz**, e `api` precisa conter `post.js`. Se aparecer uma pasta `newsfirjan-post` na raiz, ou `post.js` solto fora de `api`, apague e envie de novo.
3. Na Vercel, clique em **Add New → Project**, escolha o repositório e clique em **Deploy**.
4. Proteja o link: **Settings → Environment Variables** → `CHAVE_ACESSO` = uma senha sua → **Redeploy**.
5. Teste no navegador: `https://SEU-PROJETO.vercel.app/api/post?editoria=Política&titulo=Teste&chave=SUASENHA`

> O plano gratuito da Vercel (Hobby) é para uso **não comercial**, o que serve para o projeto do curso. Se o veículo passar a usar o gerador comercialmente, mude para o plano Pro ou hospede em Render ou Railway, com o mesmo código.

---

## 2. Onde entra no Fluxo B do Make

```
RSS (G1) → Sheets (Todas_Capturadas) → OpenAI (Classificador) → Router (score ≥ 7.5)
  → [Aprovadas] OpenAI (Gerador de Copy)
      → Tools: Set variable  url_arte          ← NOVO (substitui "Canva autofill")
      → HTTP: Make a request (valida a arte)   ← NOVO (fallback)
      → Sheets (Copy_Gerado + coluna url_arte)
      → Telegram: Send a Photo (prévia + botões) → aprovação humana → Router
          → [Aprovado] OpenAI (Adaptação por plataforma) → Router (distribuição)
              → Instagram: Create a Photo Post  (Photo URL = url_arte)
              → Facebook Pages: foto por URL      (url_arte)
              → X: HTTP Get a file (url_arte) → post com mídia
```

### 2.1 Gerador de Copy: pedir o título da arte
Acrescente ao prompt de sistema do Gerador de Copy:

```
Além da legenda, escreva o título da arte: uma manchete de no máximo 90 caracteres,
factual, sem emojis e sem hashtags, fiel ao texto da notícia.
Responda apenas com JSON válido:
{"titulo_arte": "...", "legenda": "..."}
```

Se o módulo da OpenAI devolver texto, adicione **JSON → Parse JSON** logo depois dele, para `titulo_arte` virar um campo mapeável.

### 2.2 Tools → Set variable (`url_arte`)
Variable value (cada item em MAIÚSCULAS é uma **bolha** mapeada. Não digite o nome do campo como texto: foi esse o bug do classificador):

```
https://SEU-PROJETO.vercel.app/api/post?editoria={{encodeURL(EDITORIA)}}&titulo={{encodeURL(TITULO_ARTE)}}&foto={{encodeURL(FOTO)}}&chave=SUASENHA
```

- `EDITORIA` = campo `editoria` do Classificador
- `TITULO_ARTE` = campo `titulo_arte` do Gerador de Copy
- `FOTO` = `Description` do módulo RSS (o gerador acha a `<img>` dentro dela). Se o módulo RSS mostrar um campo de imagem ou mídia com a URL direta, prefira esse.
- **Temas sensíveis** (crime, menores, saúde, conforme o critério de sensibilidade do classificador): tire o trecho `&foto=...`, e a arte sai só com texto sobre fundo marinho.

`encodeURL` é obrigatório em cada campo: sem ele, acentos e espaços quebram o link.

### 2.3 HTTP → Make a request (validação e fallback)
- URL: `{{url_arte}}` · Method: GET · **Evaluate all states as errors: Yes**
- Clique com o botão direito no módulo → **Add error handler** → **Google Sheets: Add a row** (aba de erros, ou `Rejeitados` com motivo "falha na arte") → **Ignore**.
- De quebra, isso deixa a arte já gerada em cache, e o Instagram recebe a imagem na hora.

### 2.4 Planilhas
Em `Copy_Gerado` e `Aguardando_Aprovacao`, crie a coluna **url_arte**. Assim dá para rastrear qual arte cada notícia recebeu.

### 2.5 Telegram (aprovação)
Use **Send a Photo** no lugar de Send a Text Message:
- Photo: `{{url_arte}}` (tipo URL)
- Caption: legenda + título + link da notícia
- Os botões de aprovar e recusar continuam como já planejado.

### 2.6 Publicação
- **Instagram for Business → Create a Photo Post:** Photo URL = `{{url_arte}}` · Caption = legenda adaptada
- **Facebook Pages:** post com foto por URL = `{{url_arte}}`
- **X:** o módulo pede o arquivo, não o link. Use **HTTP → Get a file** com `{{url_arte}}` e passe o arquivo baixado para o módulo do X que publica com mídia.

---

## Alterar o visual
Tudo fica em `lib/render.js`:
- cores: `CORES`
- tamanhos da manchete: `tamanhoTitulo`
- lista de editorias: `EDITORIAS`
- textos do rodapé: função `layout`

Para testar no computador (precisa do Node 20+): `npm install` e depois `npm test`. O teste gera 6 artes de exemplo em `test/saida/`.
