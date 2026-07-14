# Сервер команд Starfall (пати, приглашения)

**Деплой:** Render (бесплатно) → `../infra/deploy-party-render.ru.md`

## Локально
```bash
npm install
npm run dev
```
→ http://localhost:8080/health

## API
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/health` | Проверка |
| GET | `/api/party/:CODE` | Получить команду |
| PUT | `/api/party/:CODE` | Сохранить команду |
| DELETE | `/api/party/:CODE` | Удалить |
| WS | `/ws?room=party:CODE` | Обновления в реальном времени |

## После деплоя на Render
```bash
npm run party:apply -- https://starfall-party.onrender.com
npm run sync:cloud
npm run dev
```
