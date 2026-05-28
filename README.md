# Lexora IELTS Vocabulary Cards

雅思单词记忆卡片应用，包含 React 前端、Node API、PostgreSQL 数据库和 5227 条 IELTS/学术英语导向词库。

## Features

- 5227 个词条，含精选高频词和扩展学术词库
- PostgreSQL 持久化用户信息、复习进度和学习会话
- 翻面记忆卡片、搜索、等级筛选、复习反馈
- 桌面和移动端响应式界面
- 支持 Docker Compose 一键运行

## Local Run

先启动 PostgreSQL，或直接使用仓库自带 Compose：

```bash
docker compose up --build
```

访问：

```text
http://localhost:4174
```

如果你已经有 PostgreSQL：

```bash
npm install
npm run build
npm run db:migrate:postgres
npm run start
```

默认数据库连接：

```text
host=127.0.0.1
port=5432
user=codex
password=codex
database=codex_dev
```

## Development

```bash
npm install
npm run dev
```

开发地址：

```text
http://localhost:5173
```

## Build

```bash
npm run build
```

生产模式：

```bash
npm run start
```
