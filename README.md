# Календарь звонков (продолжение)

[![hexlet-check](https://github.com/Hyper-glitch/ai-for-developers-project-387/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/Hyper-glitch/ai-for-developers-project-387/actions)

Откройте [календарь звонков на Railway](https://booking-calendar-production-28e04b8e.up.railway.app/). В разделе «Владельцу» можно создать тип встречи и посмотреть записи, в разделе «Записаться» — выбрать время.

Учебный проект Хекслета: https://ru.hexlet.io/programs/ai-for-developers
Как это должно работать: https://files.hexlet.app/a/2ipc5m

## Сценарий

Владелец календаря один и задан заранее, авторизации нет.

1. Владелец создаёт тип встречи: название, описание, длительность (например, «Знакомство», 30 минут).
2. Гость без регистрации открывает страницу записи и выбирает тип встречи из списка.
3. Гость видит календарь на ближайшие 14 дней со свободными слотами выбранной длительности.
4. Гость выбирает день и время, указывает имя и email, подтверждает запись.
5. Слот становится занятым для всех типов встреч: одно время нельзя забронировать дважды.
6. Владелец открывает список предстоящих встреч и видит новую запись.

Требования к приложению описаны в [разборе сценария](STEP-ONE-RESULT.md). В проекте 386 сохранены [исходная спецификация](https://github.com/Hyper-glitch/ai-for-developers-project-386/issues/15) и [карта решений со связанными обсуждениями](https://github.com/Hyper-glitch/ai-for-developers-project-386/issues/4). Архитектурные решения перенесены в [docs/adr](docs/adr).

## Стек

- Контракт: TypeSpec → OpenAPI → клиентский SDK (`@hey-api/openapi-ts`) и Pydantic-модели (`datamodel-code-generator`)
- Бекенд: Python 3.13, FastAPI, uv, ruff, mypy, pytest
- Фронтенд: TypeScript, React, Vite, Mantine, oxlint, prettier, vitest
- Окружение и задачи: mise, git-хуки: hk, CI: GitHub Actions

## Хранение данных

Бекенд работает в одном процессе с одним воркером. Типы встреч и бронирования хранятся в его памяти. Перезапуск очищает каталог и историю. У каждого воркера отдельная память, поэтому запуск нескольких воркеров допускает повторное бронирование одного слота.

## Запуск в Docker

```bash
docker build -t booking-calendar .
docker run --rm -e PORT=8087 -p 127.0.0.1:8087:8087 booking-calendar
```

Откройте [приложение](http://localhost:8087) или [список встреч владельца](http://localhost:8087/owner/bookings). Контейнер сам запускает API и раздаёт собранный фронтенд на порту `PORT`. Если переменная не задана, сервис слушает порт 8000.

## Деплой через Render MCP

1. В доверенном проекте Codex добавьте секцию из [шаблона](deploy/codex-config.toml) в `.codex/config.toml`. Если файла ещё нет, выполните `mkdir -p .codex && cp deploy/codex-config.toml .codex/config.toml`.
2. Из корня проекта выполните `codex mcp login render` и подтвердите доступ в браузере. Codex хранит данные OAuth вне репозитория. Откройте новую сессию в проекте и попросите агента показать рабочие пространства Render. [Подключение Render MCP](https://render.com/docs/mcp-server).
3. Выберите рабочее пространство и попросите агента создать веб-сервис из ветки с Dockerfile. Параметры сервиса заданы в [render.yaml](render.yaml) — Docker, тариф Free и проверка готовности по `/health`. Порт передаёт Render.

Для деплоя на Railway используйте секцию `mcp_servers.railway` из того же шаблона и выполните `codex mcp login railway`. После входа попросите агента развернуть сервис из корневого Dockerfile и назначить публичный домен. [Подключение Railway MCP](https://docs.railway.com/ai/mcp-server).

## OpenCode в GitHub Issues

В новом комментарии к issue напишите `/oc explain this issue`. Команды вызова (параметр `mentions`) — `/oc` и `/opencode`. Пишите команду в начале комментария, а запрос отделяйте пробелом. Ответ появится в обсуждении задачи, журнал запуска — в [Actions → OpenCode](https://github.com/Hyper-glitch/ai-for-developers-project-387/actions/workflows/opencode.yml).

Воркфлоу обрабатывает событие `issue_comment.created` в проекте 387 для авторов с ролью `OWNER`, `MEMBER` или `COLLABORATOR`. Комментарии ботов и обсуждения pull request пропускаются, включая PR из форков. Одновременно выполняется одна команда на репозиторий, до 10 минут. Если уже есть ожидающая команда, следующая заменяет её в очереди.

OpenCode использует модель `openai/gpt-6.2-sol` по подписке ChatGPT. Секрет репозитория `OPENCODE_AUTH_CONTENT` содержит данные отдельного входа OpenCode для этого воркфлоу. Если провайдер запросит повторную авторизацию, повторите вход через `opencode auth login --provider openai` в отдельном профиле и обновите секрет. Для доступа через OpenAI API можно задать секрет `OPENAI_API_KEY` вместо данных входа ChatGPT. Checkout читает репозиторий без сохранения учётных данных. OpenCode обменивает OIDC-токен на токен установленного GitHub App для ответа в issue. Параметр `share: false` отключает публикацию сессии OpenCode. [Настройка интеграции](https://opencode.ai/docs/github/) · [OpenCode GitHub App](https://github.com/apps/opencode-agent)

## Установка

Нужен только [mise](https://mise.jdx.dev/) — остальные инструменты он ставит сам в версиях из `mise.toml`.

```bash
git clone https://github.com/Hyper-glitch/ai-for-developers-project-387.git
cd ai-for-developers-project-387
mise trust
mise install   # инструменты + зависимости + git-хуки
```

## Использование

```bash
mise daemons start   # бекенд http://localhost:8000 (docs: /docs) и фронтенд http://localhost:5173
mise daemons stop
mise run check       # линтеры, проверка типов, тесты — то же, что в CI
mise run gen         # пересобрать OpenAPI и клиентов после правки typespec/main.tsp
```

Последним шагом `mise run check` запускает Chromium. Playwright поднимает чистый бекенд на порту 8100 и фронтенд на 5273. Оба порта должны быть свободны. Отдельно сценарий можно запустить командой `mise run test:e2e`.

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
