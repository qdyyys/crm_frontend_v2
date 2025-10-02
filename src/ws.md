# WebSocket API для Telegram аккаунтов

## Описание

WebSocket API предоставляет возможность получения обновлений от Telegram аккаунтов в реальном времени, а также отправки команд для управления аккаунтами.

## Подключение

### URL для подключения

```
ws://5.101.83.2:8080/api/v1/panel/telegram/websocket/{telegram_account_id}?token={jwt_token}
```

### Параметры

- `telegram_account_id` - ID Telegram аккаунта (ObjectID из MongoDB)
- `token` - JWT токен для аутентификации

### Пример подключения (JavaScript)

```javascript
const telegramAccountId = "507f1f77bcf86cd799439011";
const token = "your_jwt_token_here";
const wsUrl = `ws://5.101.83.2:8080/api/v1/panel/telegram/websocket/${telegramAccountId}?token=${token}`;

const ws = new WebSocket(wsUrl);

ws.onopen = function (event) {
  console.log("WebSocket соединение установлено");
};

ws.onmessage = function (event) {
  const data = JSON.parse(event.data);
  console.log("Получено сообщение:", data);
};

ws.onclose = function (event) {
  console.log("WebSocket соединение закрыто");
};

ws.onerror = function (error) {
  console.log("Ошибка WebSocket:", error);
};
```

## Формат сообщений

### Структура сообщения

```json
{
    "type": "string",
    "message": "string",
    "data": object
}
```

### Поля

- `type` - тип сообщения (см. список типов ниже)
- `message` - текстовое описание сообщения
- `data` - объект с данными (зависит от типа сообщения)

## Входящие сообщения (от сервера)

### 1. Подключение установлено

```json
{
  "type": "connected",
  "message": "WebSocket соединение установлено",
  "data": {
    "telegram_account_id": "507f1f77bcf86cd799439011",
    "user_account_id": "507f1f77bcf86cd799439012"
  }
}
```

### 2. Успешное подключение к Telegram

```json
{
  "type": "telegram_connected",
  "message": "Успешно подключено к Telegram",
  "data": {
    "telegram_account_id": "507f1f77bcf86cd799439011"
  }
}
```

### 3. Новое сообщение

```json
{
  "type": "new_message",
  "message": "Новое сообщение от Telegram",
  "data": {
    "id": 123,
    "text": "Привет!",
    "date": "2024-01-15T10:30:00Z",
    "is_outgoing": false,
    "is_read": false,
    "is_new_dialog": true,
    "from_user": {
      "id": 123456789,
      "username": "user123",
      "first_name": "Иван",
      "last_name": "Иванов",
      "avatar": "http://5.101.83.2:8080/files/avatar/photo/123456789"
    },
    "reply_to": 122,
    "edited": "2024-01-15T10:31:00Z",
    "views": 10,
    "forwards": 2,
    "media": {
      "type": "photo",
      "file_id": "AgACAgIAAxkBAAIC...",
      "url": "http://5.101.83.2:8080/files/media/photo/AgACAgIAAxkBAAIC...",
      "caption": "Описание фото",
      "width": 1280,
      "height": 720,
      "size": 156789
    }
  }
}
```

### 4. Служебное сообщение

```json
{
  "type": "service_message",
  "message": "Служебное сообщение от Telegram",
  "data": {
    "id": 124,
    "text": "Пользователь присоединился к чату",
    "date": "2024-01-15T10:32:00Z",
    "is_outgoing": false,
    "is_read": false,
    "from_user": {
      "id": 123456789,
      "username": "user123",
      "first_name": "Иван",
      "last_name": "Иванов"
    }
  }
}
```

### 6. Удаление сообщений

```json
{
  "type": "delete_messages",
  "message": "Удаление сообщений от Telegram",
  "data": {
    "delete_messages": {
      "messages": [123, 124, 125],
      "pts": 1000,
      "pts_count": 3
    },
    "telegram_account_id": "507f1f77bcf86cd799439011"
  }
}
```

### 7. Обновление прочтения исходящих сообщений

```json
{
  "type": "read_history_outbox",
  "message": "Обновление прочтения исходящих сообщений",
  "data": {
    "peer": {
      "user_id": 123456789
    },
    "max_id": 125,
    "pts": 1001,
    "pts_count": 1,
    "telegram_account_id": "507f1f77bcf86cd799439011"
  }
}
```

### 8. Сырые обновления

```json
{
  "type": "raw_update",
  "message": "Новое обновление от Telegram: *tg.UpdateUserStatus",
  "data": {
    "update": {
      "user_id": 123456789,
      "status": {
        "was_online": 1705315200
      }
    },
    "update_type": "*tg.UpdateUserStatus",
    "telegram_account_id": "507f1f77bcf86cd799439011"
  }
}
```

### 9. Ошибки и предупреждения

#### Ошибка

```json
{
  "type": "error",
  "message": "Ошибка создания клиента: invalid session",
  "data": {
    "telegram_account_id": "507f1f77bcf86cd799439011"
  }
}
```

#### Предупреждение

```json
{
  "type": "warning",
  "message": "Соединение может быть нестабильным",
  "data": {
    "telegram_account_id": "507f1f77bcf86cd799439011"
  }
}
```

#### Ошибка соединения

```json
{
  "type": "connection_error",
  "message": "Потеряно соединение с Telegram",
  "data": {
    "telegram_account_id": "507f1f77bcf86cd799439011"
  }
}
```

## Исходящие сообщения (от клиента)

### Формат

Клиент может отправлять сообщения в формате JSON или простой текст.

### Структура JSON сообщения

```json
{
    "type": "string",
    "data": object
}
```

### Доступные типы сообщений

#### 1. get_chats - Получение списка чатов

```json
{
  "type": "get_chats"
}
```

**Ответ сервера:**

```json
{
  "type": "chats",
  "message": "Список чатов получен успешно",
  "data": {
    "chats": [
      {
        "id": 123456789,
        "type": "private",
        "title": "Иван Иванов",
        "username": "ivan123",
        "photo": "http://5.101.83.2:8080/files/avatar/photo/123456789",
        "last_message": {
          "id": 456,
          "text": "Привет!",
          "date": "2024-01-15T10:30:00Z",
          "from_user": {
            "id": 123456789,
            "first_name": "Иван",
            "last_name": "Иванов"
          }
        },
        "unread_count": 2
      }
    ],
    "total_count": 50,
    "next_offset_date": 1705315200,
    "next_offset_id": 456,
    "last_chat": 123456789
  }
}
```

#### 2. get_chats_next - Получение следующей порции чатов

```json
{
  "type": "get_chats_next",
  "data": {
    "next_offset_date": 1705315200,
    "next_offset_id": 456,
    "last_chat": 123456789
  }
}
```

#### 3. get_messages - Получение сообщений из чата

```json
{
  "type": "get_messages",
  "data": {
    "chat_id": 123456789,
    "offset_id": 456,
    "limit": 50
  }
}
```

**Параметры:**

- `chat_id` (обязательный) - ID чата
- `offset_id` (необязательный) - ID сообщения, с которого начать
- `limit` (необязательный) - количество сообщений (по умолчанию 100, максимум 100)

**Ответ сервера:**

```json
{
  "type": "messages",
  "message": "Сообщения получены успешно",
  "data": {
    "messages": [
      {
        "id": 123,
        "text": "Привет!",
        "date": "2024-01-15T10:30:00Z",
        "is_outgoing": false,
        "is_read": false,
        "from_user": {
          "id": 123456789,
          "username": "user123",
          "first_name": "Иван",
          "last_name": "Иванов"
        },
        "media": null
      }
    ],
    "total_count": 1500,
    "next_offset_id": 122
  }
}
```

#### 4. send_message - Отправка сообщения

```json
{
  "type": "send_message",
  "data": {
    "chat_id": 123456789,
    "text": "Привет из фронтенда!"
  }
}
```

**Параметры:**

- `chat_id` (обязательный) - ID чата
- `text` (обязательный) - текст сообщения

**Ответ сервера:**

```json
{
  "type": "message_sent",
  "message": "Сообщение успешно отправлено",
  "data": {
    "message_id": 789,
    "chat_id": 123456789,
    "text": "Привет из фронтенда!",
    "date": "2024-01-15T10:35:00Z",
    "is_outgoing": true
  }
}
```

#### 5. reply_message - Ответ на сообщение

```json
{
  "type": "reply_message",
  "data": {
    "chat_id": 123456789,
    "message": "Спасибо за сообщение!",
    "message_id": 456
  }
}
```

**Параметры:**

- `chat_id` (обязательный) - ID чата
- `message` (обязательный) - текст ответа
- `message_id` (обязательный) - ID сообщения, на которое отвечаем

#### 6. send_photo - Отправка фотографии

```json
{
  "type": "send_photo",
  "data": {
    "chat_id": 123456789,
    "photo": "base64_encoded_photo_data",
    "caption": "Описание фотографии"
  }
}
```

**Параметры:**

- `chat_id` (обязательный) - ID чата
- `photo` (обязательный) - фотография в base64
- `caption` (необязательный) - описание фотографии

#### 7. send_video - Отправка видео

```json
{
  "type": "send_video",
  "data": {
    "chat_id": 123456789,
    "video": "base64_encoded_video_data",
    "caption": "Описание видео"
  }
}
```

**Параметры:**

- `chat_id` (обязательный) - ID чата
- `video` (обязательный) - видео в base64
- `caption` (необязательный) - описание видео

#### 8. send_media_group - Отправка группы медиафайлов

```json
{
  "type": "send_media_group",
  "data": {
    "chat_id": 123456789,
    "media": [
      {
        "type": "photo",
        "media": "base64_encoded_photo_data",
        "caption": "Фото 1"
      },
      {
        "type": "photo",
        "media": "base64_encoded_photo_data",
        "caption": "Фото 2"
      }
    ]
  }
}
```

#### 9. get_account_info - Получение информации об аккаунте

```json
{
  "type": "get_account_info"
}
```

**Ответ сервера:**

```json
{
  "type": "account_info",
  "message": "Информация об аккаунте получена",
  "data": {
    "id": 123456789,
    "username": "myusername",
    "first_name": "Мое",
    "last_name": "Имя",
    "phone": "+7900123456",
    "photo": "http://5.101.83.2:8080/files/avatar/photo/123456789"
  }
}
```

#### 10. get_transcription - Получение транскрипции голосового сообщения

```json
{
  "type": "get_transcription",
  "data": {
    "chat_id": 123456789,
    "message_id": 456
  }
}
```

**Параметры:**

- `chat_id` (обязательный) - ID чата
- `message_id` (обязательный) - ID сообщения с голосом

#### 11. add_chat_to_second_line - Добавление чата во вторую линию

```json
{
  "type": "add_chat_to_second_line",
  "data": {
    "chat_id": "123456789"
  }
}
```

**Параметры:**

- `chat_id` (обязательный) - ID чата (может быть строкой или числом)

#### 12. set_status - Установка статуса чата

```json
{
  "type": "set_status",
  "data": {
    "chat_id": "123456789",
    "status": "active"
  }
}
```

**Параметры:**

- `chat_id` (обязательный) - ID чата
- `status` (обязательный) - статус чата

#### 13. set_channel_signature - Установка подписи канала

```json
{
  "type": "set_channel_signature",
  "data": {
    "chat_id": "123456789",
    "channel_signature": "Подпись канала"
  }
}
```

**Параметры:**

- `chat_id` (обязательный) - ID чата
- `channel_signature` (обязательный) - подпись канала

#### 14. set_note - Установка заметки

```json
{
  "type": "set_note",
  "data": {
    "note": "Моя заметка"
  }
}
```

**Параметры:**

- `note` (обязательный) - текст заметки

#### 15. get_note - Получение заметки

```json
{
  "type": "get_note"
}
```

**Ответ сервера:**

```json
{
  "type": "note",
  "message": "Заметка получена",
  "data": {
    "note": "Моя заметка"
  }
}
```

#### 16. ping - Проверка соединения

```json
{
  "type": "ping"
}
```

**Ответ сервера:**

```json
{
  "type": "pong",
  "message": "pong"
}
```

### Пример отправки простого текста

```javascript
ws.send("ping");
```

### Пример отправки JSON сообщения

```javascript
const message = {
  type: "send_message",
  data: {
    chat_id: 123456789,
    text: "Привет из фронтенда!",
  },
};

ws.send(JSON.stringify(message));
```

## Типы медиафайлов

### Фото

```json
{
  "type": "photo",
  "file_id": "AgACAgIAAxkBAAIC...",
  "url": "http://5.101.83.2:8080/files/media/photo/AgACAgIAAxkBAAIC...",
  "caption": "Описание фото",
  "width": 1280,
  "height": 720,
  "size": 156789
}
```

### Видео

```json
{
  "type": "video",
  "file_id": "BAACAgIAAxkBAAIC...",
  "url": "http://5.101.83.2:8080/files/media/video/BAACAgIAAxkBAAIC...",
  "caption": "Описание видео",
  "width": 1920,
  "height": 1080,
  "duration": 120,
  "size": 5242880
}
```

### Аудио

```json
{
  "type": "audio",
  "file_id": "CQACAgIAAxkBAAIC...",
  "url": "http://5.101.83.2:8080/files/media/audio/CQACAgIAAxkBAAIC...",
  "duration": 180,
  "title": "Название песни",
  "performer": "Исполнитель",
  "size": 3145728
}
```

### Голосовое сообщение

```json
{
  "type": "voice",
  "file_id": "AwACAgIAAxkBAAIC...",
  "url": "http://5.101.83.2:8080/files/media/voice/AwACAgIAAxkBAAIC...",
  "duration": 15,
  "size": 51200
}
```

### Документ

```json
{
  "type": "document",
  "file_id": "BQACAgIAAxkBAAIC...",
  "url": "http://5.101.83.2:8080/files/media/document/BQACAgIAAxkBAAIC...",
  "file_name": "document.pdf",
  "mime_type": "application/pdf",
  "size": 1048576
}
```

### Стикер

```json
{
  "type": "sticker",
  "file_id": "CAACAgIAAxkBAAIC...",
  "url": "http://5.101.83.2:8080/files/media/sticker/CAACAgIAAxkBAAIC...",
  "width": 512,
  "height": 512,
  "emoji": "😀",
  "size": 32768
}
```

## Информация о пользователе

### Структура объекта пользователя

```json
{
  "id": 123456789,
  "username": "user123",
  "first_name": "Иван",
  "last_name": "Иванов",
  "avatar": "http://5.101.83.2:8080/files/avatar/photo/123456789"
}
```

### Поля

- `id` - ID пользователя в Telegram
- `username` - имя пользователя (может быть пустым)
- `first_name` - имя пользователя
- `last_name` - фамилия пользователя (может быть пустой)
- `avatar` - URL аватарки пользователя (может быть пустым)

## Обработка ошибок

### Коды ошибок HTTP

- `401` - Неавторизованный доступ (неверный токен)
- `403` - Доступ запрещен (нет доступа к аккаунту)
- `404` - Аккаунт не найден
- `500` - Внутренняя ошибка сервера

### Пример обработки ошибок

```javascript
ws.onerror = function (error) {
  console.error("WebSocket ошибка:", error);
};

ws.onclose = function (event) {
  console.log("WebSocket закрыт:", event.code, event.reason);

  switch (event.code) {
    case 1000:
      console.log("Нормальное закрытие");
      break;
    case 1001:
      console.log("Сервер недоступен");
      break;
    case 1006:
      console.log("Неожиданное закрытие");
      break;
    default:
      console.log("Неизвестная ошибка");
  }
};
```

## Переподключение

### Автоматическое переподключение

```javascript
function connectWebSocket() {
  const ws = new WebSocket(wsUrl);

  ws.onopen = function (event) {
    console.log("WebSocket подключен");
    reconnectAttempts = 0;
  };

  ws.onclose = function (event) {
    console.log("WebSocket закрыт");

    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      setTimeout(connectWebSocket, reconnectDelay);
    }
  };

  return ws;
}

let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 5000;

let ws = connectWebSocket();
```

## Примеры использования

### React Hook для WebSocket

```javascript
import { useEffect, useState, useRef } from "react";

function useWebSocket(telegramAccountId, token) {
  const [messages, setMessages] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const ws = useRef(null);

  useEffect(() => {
    const wsUrl = `ws://5.101.83.2:8080/api/v1/panel/telegram/websocket/${telegramAccountId}?token=${token}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setConnectionStatus("connected");
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "new_message") {
        setMessages((prev) => [...prev, data.data]);
      }
    };

    ws.current.onclose = () => {
      setConnectionStatus("disconnected");
    };

    return () => {
      ws.current?.close();
    };
  }, [telegramAccountId, token]);

  const sendMessage = (message) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  return { messages, connectionStatus, sendMessage };
}
```

### Vue.js Composable

```javascript
import { ref, onMounted, onUnmounted } from "vue";

export function useWebSocket(telegramAccountId, token) {
  const messages = ref([]);
  const connectionStatus = ref("disconnected");
  let ws = null;

  onMounted(() => {
    const wsUrl = `ws://5.101.83.2:8080/api/v1/panel/telegram/websocket/${telegramAccountId}?token=${token}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      connectionStatus.value = "connected";
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "new_message") {
        messages.value.push(data.data);
      }
    };

    ws.onclose = () => {
      connectionStatus.value = "disconnected";
    };
  });

  onUnmounted(() => {
    ws?.close();
  });

  const sendMessage = (message) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  };

  return { messages, connectionStatus, sendMessage };
}
```

## Лимиты и ограничения

- Максимальный размер сообщения: 10 МБ
- Таймаут чтения: 1000 секунд
- Таймаут записи: 5 секунд
- Период проверки соединения: 30 секунд
- Максимальное количество попыток переподключения: 5

## Безопасность

- Всегда используйте HTTPS/WSS в продакшене
- Не передавайте JWT токен в открытом виде
- Регулярно обновляйте токены
- Проверяйте права доступа к аккаунтам

## Отладка

### Логирование

```javascript
ws.onmessage = function (event) {
  const data = JSON.parse(event.data);
  console.log("Получено:", data.type, data.message);

  if (data.type === "error") {
    console.error("Ошибка WebSocket:", data.message);
  }
};
```

### Проверка состояния соединения

```javascript
function checkConnection() {
  switch (ws.readyState) {
    case WebSocket.CONNECTING:
      console.log("Подключение...");
      break;
    case WebSocket.OPEN:
      console.log("Соединение активно");
      break;
    case WebSocket.CLOSING:
      console.log("Закрытие соединения...");
      break;
    case WebSocket.CLOSED:
      console.log("Соединение закрыто");
      break;
  }
}
```
