# Portal Fiscal XML

Sistema web para processamento, visualizacao e alteracao de notas fiscais eletronicas brasileiras (NFCom, NF-e, NFC-e, NFS-e).

**Funciona 100% no navegador** - seus dados XML nunca saem do seu computador.

---

## Funcionalidades

| Funcionalidade | Descricao |
|---|---|
| **Nota Unica** | Visualize os detalhes de um XML individual (emitente, destinatario, itens, impostos, totais) |
| **Relatorio por cClass** | KPIs, grafico Top 12, tabela por cClass com drill-down (cClass > CFOP > notas) e exportacao CSV |
| **Relatorio por Imposto** | Analise por CST ICMS + CFOP, impostos retidos (IPI, PIS, COFINS) e exportacao CSV |
| **Relatorio CST** | Disponivel para NF-e e NFC-e - analise detalhada por CST ICMS com itens flat |
| **Alteracao em Lote** | 4 operacoes para modificar XMLs em massa: cClass/CFOP, descricao, remover CFOP por ICMS, remover CFOP por cClass |
| **Exportacao CSV** | Todos os relatorios exportam CSV com BOM UTF-8 e delimitador `;` (compativel Excel BR) |
| **BK — Documentos Fiscais** | Importacao segura de NF-e/eventos, classificacao CFOP, remessa x exportacao, historico, DANFE e Excel |

### BK — Documentos Fiscais (v1.34)

O menu **BK Documentos** centraliza NF-e de remessa, exportacao, venda interna,
outras saidas e devolucao. A importacao possui previa obrigatoria, filtro por
periodo, leitura recursiva de pasta autorizada pelo navegador, conferencia de
unidade emitente, prevencao de duplicidade e atualizacao posterior por eventos
de cancelamento. Os dados ficam no armazenamento local versionado do navegador;
nenhum XML e enviado para servicos externos.

O estado local e salvo em IndexedDB. Na configuracao, o usuario pode escolher
uma pasta para manter o espelho portatil `bk-documentos.json`, sincronizar XMLs
novos e transportar a base para outro computador. A pesquisa automatica ocorre
enquanto a pagina estiver aberta e autorizada no Chrome ou Edge.

> Esta distribuicao e estatica (GitHub Pages) e nao possui banco multiusuario.
> O estado BK foi isolado em `BKContext` para permitir a troca futura por uma
> API do sistema Fechamento sem alterar o parser nem as telas.

---

## Modulos Fiscais Suportados

- **NFCom** (Modelo 62) - Nota Fiscal de Comunicacao
- **NF-e** (Modelo 55) - Nota Fiscal Eletronica
- **NFC-e** (Modelo 65) - Nota Fiscal do Consumidor Eletronica
- **NFS-e** - Nota Fiscal de Servicos

---

## Como usar no GitHub Pages

### 1. Crie um repositorio no GitHub

Acesse https://github.com/new e crie um repositorio chamado `portal-fiscal-xml`.

### 2. Suba o codigo

Execute os comandos abaixo na pasta do projeto:

```bash
# Inicialize o git
git init

# Adicione todos os arquivos
git add .

# Faca o primeiro commit
git commit -m "Primeiro commit - Portal Fiscal XML"

# Conecte ao seu repositorio do GitHub (substitua SEU-USUARIO)
git remote add origin https://github.com/SEU-USUARIO/portal-fiscal-xml.git

# Envie para o GitHub
git push -u origin main
```

> Se a branch padrao for `master` em vez de `main`, use: `git push -u origin master`

### 3. Configure o GitHub Pages

1. No GitHub, va ate o repositorio > **Settings** > **Pages**
2. Em **Source**, selecione **GitHub Actions**
3. O workflow de deploy sera executado automaticamente

Ou alternativamente, use branch `gh-pages`:

1. Va em **Settings** > **Pages**
2. Em **Source**, selecione **Deploy from a branch**
3. Selecione a branch `gh-pages` e pasta `/ (root)`
4. Clique em **Save**

### 4. Acesse seu site

Apos o deploy (pode levar 1-2 minutos), acesse:

```
https://SEU-USUARIO.github.io/portal-fiscal-xml/
```

---

## Desenvolvimento Local

```bash
# Instale as dependencias
npm install

# Rode em modo desenvolvimento
npm run dev

# Faca o build de producao
npm run build

# Preview do build
npm run preview
```

---

## Tecnologias

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Recharts (graficos)
- JSZip (processamento ZIP)
- PapaParse (exportacao CSV)
- DOMParser (parse XML - nativo do navegador)

---

## Estrutura do Projeto

```
src/
  components/shared/   # Componentes reutilizaveis (Navbar, UploadDropzone, etc.)
  context/             # Contexto do modulo fiscal ativo
  pages/               # Paginas principais
  parsers/             # Parsers XML para cada tipo de nota fiscal
  types/               # Tipos TypeScript
public/
  (vazio - assets sao importados)
```

---

## Licenca

MIT
