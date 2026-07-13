# LoboFlix

App web para organizar filmes, montar calendário inteligente, criar maratonas e gerar agenda com IA.

## Stack

- **Frontend:** React + Vite + TypeScript (design system LoboFlix)
- **Backend:** ASP.NET Core 8 Minimal API
- **Banco:** SQLite
- **APIs externas:** TMDb (filmes/streaming), OpenAI (opcional, IA)

## Estrutura

```
LoboFlix/
├── src/LoboFlix.Api/     # API .NET
├── web/                  # Frontend React
├── design-system/        # Handoff de design (referência)
└── Dockerfile            # Deploy único (API + web)
```

## Rodar localmente

### 1. Configurar secrets

Edite `src/LoboFlix.Api/appsettings.Development.json`:

```json
{
  "Tmdb": { "ApiKey": "SUA_CHAVE_TMDB" },
  "Jwt": { "Secret": "uma-string-longa-aleatoria" },
  "OpenAi": { "ApiKey": "" }
}
```

Obtenha a chave TMDb em: https://www.themoviedb.org/settings/api

### 2. Backend

```bash
cd src/LoboFlix.Api
dotnet run
```

API: http://localhost:5138  
Swagger: http://localhost:5138/swagger

### 3. Frontend (dev)

```bash
cd web
npm install
npm run dev
```

App: http://localhost:5173 (proxy `/api` → backend)

## Build produção (local)

```bash
cd web && npm run build
cd ../src/LoboFlix.Api && dotnet run
```

O Vite gera os arquivos estáticos em `src/LoboFlix.Api/wwwroot`.

## Deploy (Render)

1. Push para GitHub
2. Render → **New Web Service** → conecte o repo
3. Runtime: **Docker**
4. Variáveis de ambiente:

```
Jwt__Secret=sua-chave-jwt-longa
Tmdb__ApiKey=sua-chave-tmdb
OpenAi__ApiKey=sua-chave-openai-opcional
ConnectionStrings__Default=Data Source=/app/data/loboflix.db
```

5. Deploy automático a cada push em `main`

## Endpoints principais

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` | Criar conta |
| POST | `/api/auth/login` | Login |
| GET | `/api/movies/search?q=` | Buscar filme (TMDb) |
| GET | `/api/movies/{id}` | Detalhe do filme |
| GET/POST | `/api/library` | Biblioteca |
| GET | `/api/calendar/today` | Filme de hoje |
| GET/PUT | `/api/calendar/config` | Config de agenda |
| POST | `/api/calendar/generate` | Gerar calendário |
| POST | `/api/marathons` | Criar maratona |
| POST | `/api/marathons/{id}/apply` | Aplicar maratona |
| POST | `/api/ai/generate-calendar` | IA monta calendário |

## Telas web

- **Hoje** — filme do dia
- **Agenda** — calendário + config (dias, max 2h)
- **Biblioteca** — busca TMDb + lista
- **Perfil** — IA + maratonas

## Design system

Tokens em `web/src/theme/tokens.json` (copiado do handoff).  
Referência visual: `design-system/design_handoff_cineflow/Loboflix Design System.dc.html`
