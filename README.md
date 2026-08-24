# Календарь учителя

Локальное React-приложение с Firebase Authentication и Cloud Firestore.

## Настройка

1. Скопируйте `.env.local.example` в `.env.local` (файл уже создан локально).
2. Заполните Firebase Web App config в `.env.local`.
3. Установите зависимости и запустите проект:

```bash
npm install
npm run dev
```

Firebase Analytics не используется. В Firestore ожидаются коллекции `users`, `groups`, `lessons` и `payments`. Документ `users/{uid}` должен содержать `name`, `email`, `role` и `schoolId`.

Раздел «Оплаты» доступен ролям `owner` и `admin`. Для применения правил из репозитория опубликуйте `firestore.rules` через Firebase CLI или вставьте их в Firebase Console после проверки совместимости с действующими правилами проекта.

## Проверка

- Войдите email/password пользователя, созданного в Firebase Authentication.
- Убедитесь, что документ `users/{uid}` существует и имеет `role: "admin"`.
- Создайте группу через плюс в боковой панели — документ появится в `groups` с `schoolId` профиля.
- Создайте занятие кнопкой «Новое занятие» — документ появится в `lessons` с тем же `schoolId`.
- Перетащите карточку или измените её высоту в режиме недели — Firestore обновится автоматически.

## Команды

```bash
npm run dev
npm run build
npm run preview
npm run test
```
