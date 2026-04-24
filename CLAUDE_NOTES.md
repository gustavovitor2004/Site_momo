# Notas do Projeto — nosso espaço

## Site
- URL: https://nosso-espaco-theta.vercel.app
- Projeto Vercel: `nosso-espaco` (prj_qhJSLQQ2ZYx9m6cfzpRDJzyw5i6Q)
- Time Vercel: `Gustavo's projects` (team_K9cDPMPKd5eVLTDdrUvD5tYd)
- Repositório GitHub: https://github.com/gustavovitor2004/Site_momo
- Arquivo principal: `D:\importante\projetos_vs\Site_momo\index.html`

## Contas
- Email Vercel: pujin2004.vbg@gmail.com
- Email git configurado: pujin2004.vbg@gmail.com (IMPORTANTE: tem que bater com o Vercel)
- GitHub: gustavovitor2004

## Firebase (Realtime Database)
- Projeto: nosso-espaco-59510
- databaseURL: https://nosso-espaco-59510-default-rtdb.firebaseio.com
- Chave STORAGE_KEY: 'couple_app_data'
- SDK usado: firebase-app-compat + firebase-database-compat (v10.12.0)
- firebaseConfig embutido no index.html

## Estrutura completa do Firebase — defaultData
```js
{
  config: {
    name1, name2,         // nomes dos jogadores
    pass1, pass2,         // senhas (legado, login é sem senha)
    avatar1, avatar2,     // foto base64 comprimida 200px
    fontDisplay1/2,       // fonte de títulos por jogador
    fontBody1/2,          // fonte de corpo por jogador
    bg1, bg2              // imagem de fundo base64 1280px por jogador
  },
  cartas: [],             // { id, de, para, titulo, texto, cor, img, ts, lida }
  planos: [],             // { id, nome, desc, cat, feito, de, ts }
  datas: [],              // { id, nome, val, tipo }
  jogos: {
    lol: [],              // ver estrutura LoL abaixo
    mhw: [],              // { id, de, ts, arma, tipoCaca, armor, skills, notas }
    outros: []            // { id, de, ts, jogo, tipoNota, titulo, notas }
  },
  desculpas: [],          // { id, de, para, msg, promessa, amor, img, ts, lida }
  segredo1: { texto, ts },  // segredo pessoal do player1 (SÓ player1 vê)
  segredo2: { texto, ts },  // segredo pessoal do player2 (SÓ player2 vê)
}
```

### Estrutura LoL build (jogos.lol[])
```js
{
  id, de, ts, champ, champImg, role, itens, itensData, runas, runasData, notas,
  favorito: bool,   // ⭐ domina bem — borda dourada
  fixado: bool,     // 📌 precisa aprender — borda azul, vai ao topo
  detalhes: {
    guia: '',        // innerHTML do contenteditable
    runas: '',       // innerHTML do contenteditable
    mindset: '',     // innerHTML do contenteditable
    videos: [],      // [{ ytId, url, titulo }]
    bg: '',          // cor de fundo do painel detalhe (hex)
    fontGuia: '',    // font-family aplicada ao editor guia
    fontRunas: '',
    fontMindset: ''
  }
}
```

## Comando de deploy
```
cd "D:\importante\projetos_vs\Site_momo"
git add index.html
git commit -m "mensagem"
git push
vercel deploy --prod --yes
```

## Arquitetura — funções importantes no index.html

### Storage / Sync
- `loadData()` — lê do Firebase, aplica `normalizarDados()`
- `saveData(d)` — salva tudo no Firebase com compressão de imagens
- `toArray(val)` — converte objeto Firebase `{0:x, 1:y}` para array
- `normalizarDados(d)` — garante que arrays são arrays + inicializa segredo1/2
- `ativarSyncTempoReal()` — listener `.on('value')` que chama todos os renders
- `cachedData` — variável global com último snapshot do Firebase
- `db.ref(STORAGE_KEY + '/config').update({key: val})` — update cirúrgico de config
- `db.ref(STORAGE_KEY + '/segredo1').set(obj)` — update cirúrgico do segredo

### Login
- Login sem senha — dois cards clicáveis (player1 / player2)
- `setAvatarLogin(imgId, initId, src)` — mostra img ou inicial
- `initLoginScreen()` — lê cache localStorage PRIMEIRO (instantâneo), depois atualiza do Firebase e salva novo cache
- Cache login: `localStorage.getItem('login_cache')` → `{ name1, name2, avatar1, avatar2 }`
- `doLogin(player)` — seta currentUser, aplica fontes/bg/avatar, ativa sync
- `logout()` — limpa estado, reseta fonte CSS, chama initLoginScreen()

### Personalização
- `aplicarFontes(d)` / `aplicarBackground(d)` — aplica configurações do jogador atual
- `renderFontOpts(d)` — font picker com flex-wrap (todas as fontes visíveis, sem scroll)
- `setFont(tipo, val, btn)` — salva fonte no Firebase + atualiza cachedData imediatamente
- `.font-picker-wrap { flex-wrap: wrap }` — layout em grid, não scroll horizontal

### Edição de itens (editarItem / salvarEdicao)
- `editarItem(tipo, id)` — abre modal com campos pré-preenchidos
- `salvarEdicao(tipo, id)` — salva de volta via saveData
- Tipos suportados: `'carta'`, `'plano'`, `'data'`, `'desculpa'`, `'jogo-lol'`, `'jogo-mhw'`, `'jogo-outros'`
- IDs dos campos no modal: `ef-titulo`, `ef-texto`, `ef-nome`, `ef-desc`, `ef-cat`, `ef-val`, `ef-tipo`, `ef-msg`, `ef-promessa`, `ef-amor`, `ef-notas`, `ef-arma`, `ef-armor`, `ef-skills`, `ef-jogo`

### Desculpas
- `apoTarget` — sempre definido como `other` player em `doLogin` (sem seletor de alvo na UI)
- `abrirDesculpaById(id)` — abre modal ao clicar no card
- Cards têm `onclick="abrirDesculpaById(id)"` + `stopPropagation` nos botões internos

### Segredo pessoal
- `salvarSegredo()` — salva em `segredo1` ou `segredo2` baseado no currentUser
- `renderSegredo(d)` — lê apenas a chave do jogador atual; o outro nunca tem acesso
- Firebase path: `db.ref(STORAGE_KEY + '/segredo1').set(obj)` — update cirúrgico

### LoL — Filtro de lanes
- `lolLaneFiltro` — global, default `'all'`
- `toggleLaneFilter(btn)` — atualiza filtro e chama `renderJogos(cachedData)`
- Barra aparece só quando há builds; lanes: top, jungle, mid, adc, support

### LoL — Favorito / Fixado
- `toggleFavorito(id, e)` / `toggleFixado(id, e)` — toggle + salva via saveData (exclusivos entre si)
- Fixados ficam no topo da lista (sort: fixados → favoritos → resto)
- `verificarFixados(d)` — mostra `#lol-fixados-banner` com nomes dos fixados
- Banner aparece toda vez que `renderJogos` é chamado (inclusive ao entrar na aba)

### LoL — Guia detalhado do campeão
- `abrirDetalheChamp(id)` — abre overlay full-screen `#champ-detail-overlay`
- `closeDetalhe()` — fecha overlay, restaura `body.overflow`
- `switchDetalheTab(tab)` — alterna entre guia / runas / mindset / videos
- `setDetalheBg(color)` — muda background do overlay
- `aplicarFonteDetalhe(all)` — se `all=true` aplica ao editor todo; se `false` aplica ao texto selecionado via `surroundContents(span)`
- `salvarDetalheChamp()` — salva innerHTML dos editors + videos + bg + fontes em `entry.detalhes` via saveData
- `adicionarVideoYT()` / `renderVideoGrid()` — YouTube links com thumbnail `img.youtube.com/vi/{ID}/hqdefault.jpg`
- `getYTId(url)` — extrai ID de links youtu.be e youtube.com/watch, embed, shorts
- `currentDetalheId`, `currentDetalheTab`, `currentDetalheVideos` — estado do painel aberto
- Toolbar: seletor de fonte + "à seleção" + "texto todo" + B/I/U/lista
- Painel de vídeos esconde toolbar automaticamente

## Abas do site
1. ✉ cartas
2. ✦ planos
3. ◎ datas
4. ⌗ jogos (LoL, MHW, outros)
5. ♡ pedido de desculpas
6. 🔒 segredo
7. ⚙ config

## Fontes disponíveis
### Títulos (fontOptionsDisplay — 12 opções):
Cormorant Garamond, Playfair Display, Cinzel, Merriweather, IM Fell English,
Spectral, Crimson Pro, Libre Baskerville, Dancing Script, Satisfy, Gwendolyn, Italiana

### Corpo (fontOptionsBody — 12 opções):
DM Mono, Lato, Josefin Sans, Raleway, Nunito, Merriweather,
Spectral, Cinzel, Crimson Pro, Cormorant Garamond, Playfair Display, Libre Baskerville

### Toolbar de detalhe LoL (dd-font-sel — 12 opções):
DM Mono, Cormorant, Playfair, Merriweather, Cinzel, Dancing, Lato, Raleway, Crimson, Spectral, Josefin, Satisfy

## Animações CSS (keyframes definidos)
- `floatTitle`, `fadeUp`, `fadeIn`, `cardIn`, `modalSlideIn`, `overlayIn`, `sectionIn`, `focusGlow`, `pulseGold`, `shimmer`

## Histórico de mudanças (sessão atual)
13. Font picker usa flex-wrap (não scroll horizontal) — todas fontes visíveis
14. Clique em card de desculpa abre modal (abrirDesculpaById)
15. Botão "editar" em todas as abas (cartas/planos/datas/desculpas/jogos)
16. Avatar no login: cache localStorage instantâneo + atualização Firebase em background
17. Aba SEGREDO pessoal (segredo1/segredo2 — cada jogador vê só o próprio)
18. Desculpas: removido seletor de alvo — sempre vai para o outro jogador
19. LoL: filtro de lanes (top/jungle/mid/adc/support) com ícones oficiais
20. LoL: favorito (⭐) e fixado (📌) com sort automático e banner de notificação
21. LoL: guia detalhado por campeão — 4 abas (guia/runas/mindset/vídeos), editor contenteditable com formatação inline, font por seleção ou texto todo, YouTube thumbnails, background customizável
