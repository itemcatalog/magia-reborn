# Magia Reborn: como colocar o site no ar (GitHub + Supabase)

O site fica hospedado no **GitHub Pages** (grátis). Os itens, as categorias e as fotos ficam no **Supabase** (grátis).
Quem visita só vê a vitrine. A administradora entra pelo link **"Área da administradora"**, no rodapé.

Arquivos importantes:
- `config.js`: onde você cola os dados do seu Supabase (passo 2).
- `1-criar-tabelas.sql` e `2-liberar-administradora.sql`: rodam uma vez no Supabase (passo 1).
- `.github/workflows/keepalive.yml`: rotina do GitHub que impede o Supabase de pausar (passo 4).

---

## Passo 1: criar o projeto no Supabase

1. Entre em **supabase.com**, crie uma conta e clique em **New project**. Escolha um nome, anote a senha do banco e, em região, escolha **South America (São Paulo)**.
2. Quando o projeto terminar de criar, abra **SQL Editor** (menu da esquerda), clique em **New query**, cole **todo** o conteúdo de `1-criar-tabelas.sql` e clique em **Run**. Deve aparecer "Success".
3. Abra **Authentication → Users → Add user → Create new user**. Digite o **e-mail e a senha da administradora** e marque **Auto Confirm User**. Guarde essa senha.
4. Volte ao **SQL Editor**, abra uma nova query com o conteúdo de `2-liberar-administradora.sql`, **troque o e-mail** pelo mesmo do passo anterior e clique em **Run**. O resultado deve mostrar `1`.
5. Recomendado: em **Authentication**, nas configurações de login (**Sign In / Providers**), desligue **"Allow new users to sign up"**. Assim ninguém consegue criar conta por conta própria. As regras do banco já impedem qualquer pessoa de alterar o catálogo, mas isso evita contas sobrando.

## Passo 2: copiar os dados do projeto para o `config.js`

1. No Supabase, abra **Project Settings → API** (ou **API Keys**).
2. Copie a **Project URL** (algo como `https://abcdefgh.supabase.co`).
3. Copie a chave **publishable** (começa com `sb_publishable_`). Se só aparecer a chave `anon`, ela também funciona, mas o Supabase vai desativá-la até o fim de 2026.
4. Abra o `config.js`, troque os dois textos `COLE_AQUI...` e salve.

> **Nunca** cole no site a chave `secret` nem a `service_role`. Elas dão acesso total ao banco.

## Passo 3: publicar no GitHub Pages

1. Em **github.com**, crie um repositório **público** (por exemplo, `magia-reborn`).
2. Envie **todos os arquivos desta pasta** para a raiz do repositório (**Add file → Upload files**). Inclua também a pasta oculta `.github`. Se ela não subir, veja o passo 4.
3. Vá em **Settings → Pages**. Em **Source**, escolha **Deploy from a branch**, a branch `main` e a pasta `/ (root)`, e clique em **Save**.
4. Em alguns minutos o site aparece em `https://SEU-USUARIO.github.io/magia-reborn/`.

## Passo 4: a rotina que mantém o Supabase acordado

O plano gratuito do Supabase pausa projetos com pouco uso. Esta rotina faz algumas consultas leves todos os dias.

1. No repositório, vá em **Settings → Secrets and variables → Actions → New repository secret** e crie dois segredos:
   - `SUPABASE_URL`: a Project URL do passo 2.
   - `SUPABASE_KEY`: a chave publishable (ou anon) do passo 2.
2. Abra a aba **Actions**. Se o GitHub pedir, clique em habilitar os workflows.
3. Se a pasta `.github` não subiu no passo 3, crie o arquivo na mão: **Add file → Create new file**, digite `.github/workflows/keepalive.yml` como nome e cole o conteúdo do arquivo `keepalive.yml` desta pasta.
4. Teste: aba **Actions → Manter Supabase ativo → Run workflow**. Em um minuto deve ficar com o ícone verde.

## Como a administradora usa o site

- No rodapé, toque em **Área da administradora**, entre com e-mail e senha e use **+ Adicionar item** e **Configurações** (categorias e número do WhatsApp).
- Para sair, toque em **Sair** no mesmo lugar do rodapé.
- Cada item pode ter sua própria mensagem de WhatsApp, com `{nome}`, `{preco}` e `{categoria}`.
- Quando a administradora apaga um item ou troca uma foto, a foto antiga é apagada do armazenamento.

## Cuidados

- **Rotina desligada pelo GitHub:** em repositórios públicos, o GitHub desliga rotinas agendadas depois de 60 dias sem atividade no repositório. A rotina grava um pequeno registro a cada 30 dias para evitar isso, mas isso não foi testado de ponta a ponta. Se um dia chegar um e-mail do GitHub avisando que o workflow foi desativado, entre em **Actions**, escolha o workflow e clique em **Enable workflow**.
- **Se o Supabase pausar:** entre em supabase.com, abra o projeto e clique em **Resume project**. Os dados voltam como estavam.
- **Esqueceu a senha:** em **Authentication → Users**, no Supabase, você redefine a senha da administradora.
- **Testar sem internet ou antes de configurar:** enquanto o `config.js` estiver com `COLE_AQUI`, abrir o `index.html` no computador funciona em *modo local*. Os dados ficam só naquele navegador e todo mundo vira administrador, então use apenas para ver o visual.
