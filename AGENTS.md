# AGENTS.md

«Запись на звонок» — сервис бронирования встреч (упрощённый Cal.com). Требования и сценарий: `STEP-ONE-RESULT.md`.

## Команды

Окружение целиком управляется mise (`mise.toml`): версии Python, Node, uv, hk, pitchfork. Глобальные интерпретаторы не используются.

- `mise install` — поставить инструменты; хук `postinstall` запускает `mise run install` (uv sync, npm ci, git-хуки hk).
- `mise run check` — все проверки: актуальность сгенерированного кода, линтеры, типы и тесты, включая сквозной сценарий Playwright в Chromium последним шагом. Эту же команду запускает CI (`.github/workflows/ci.yml`). Должна быть зелёной перед пушем (её же запускает pre-push хук).
- `mise run gen` — пересобрать OpenAPI и клиентов после правки контракта.
- `mise run lint` / `mise run typecheck` / `mise run test` — по отдельности.
- `mise daemons start` / `status` / `logs api` / `stop` — бекенд (:8000) и фронтенд (:5173) в фоне.
- `mise run dev:backend` / `mise run dev:frontend` — те же серверы в текущем терминале.
- `mise run test:e2e` — отдельно проверить бронирование в Chromium.
- Один тест: `cd backend && uv run pytest tests/test_smoke.py::test_health_returns_ok`; `cd frontend && npx vitest run src/api/health.test.ts`.

## Устройство

- `typespec/main.tsp` — контракт API, единственный источник правды. Компилируется в `openapi/openapi.yaml`.
- Из `openapi/openapi.yaml` генерируются `backend/app/generated/models.py` (Pydantic) и `frontend/src/client/` (SDK hey-api). Все три результата генерации (OpenAPI, модели и SDK) коммитятся и руками не правятся; `mise run check` падает, если они расходятся с контрактом.
- `backend/` — FastAPI, uv, ruff, mypy (strict), pytest. Маршруты пишутся вручную по контракту (серверного генератора маршрутов нет), с моделями из `app/generated`; совпадение с контрактом проверяется тестами.
- `frontend/` — React + Vite + Mantine, oxlint, prettier, vitest. К API обращаться только через `src/api` (настраивает base URL из `VITE_API_URL`).

## Правила

- Изменение API: сначала `typespec/main.tsp`, затем `mise run gen`, затем код.
- TypeScript закреплён на 6.x: `@hey-api/openapi-ts` не работает с TypeScript 7.
- Коммиты — Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `ci:`; scope по желанию: `feat(backend): ...`). Формат проверяет commit-msg хук hk.
- В конце заголовка каждого коммита реализации укажите номер тикета, который он закрывает, например `feat: запись на свободный слот (#12)`.
- Файл `.github/workflows/hexlet-check.yml` не изменять и не удалять.

## Agent skills

Инженерные скиллы mattpocock/skills ставятся в `.claude/skills/` (в git не хранятся), список и версии — в `skills-lock.json`. Восстановить после клонирования: `npx skills@latest experimental_install`; обновить: `npx skills@latest update -p`. Работа идёт циклом: обсуждение → спецификация (`/to-spec`) → тикеты (`/to-tickets`) → реализация (`/implement-spec`). Перед работой над задачей прочитать её issue, связанные тикеты и решения из `docs/adr/`.

### Issue tracker

GitHub Issues в `Hyper-glitch/ai-for-developers-project-387`, работа через `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Стандартные пять меток: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: словарь в `GLOSSARY.md`, решения в `docs/adr/` в корне репозитория. See `docs/agents/domain.md`.

## Реализация и ревью PR

Перед реализацией прочитайте согласование в исходном issue и пройдите граф тикетов через `implement-spec`. Соберите результат в одной ветке, проведите общее ревью и заполните [шаблон PR](.github/pull_request_template.md). Сохраняйте журнал теста, который воспроизводит проблему на базе, и журнал того же теста на исправлении. В GitHub CI сверьте SHA прогона и браузерного артефакта с текущим head.

Проверяйте формат каждого нового коммита и заголовка PR по правилам выше. При squash заголовок PR становится заголовком итогового коммита. Правки по общим и построчным командам человека отправляйте в текущую ветку PR. Решение по замечаниям независимого ревьюера и решение о мерже фиксирует человек.
