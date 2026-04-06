# ABYSS PANEL BACKEND

Enterprise SMS Management System - Full Backend Implementation.

## 🚀 Features

- **Authentication**: JWT-based auth with role-based access control (RBAC).
- **User Management**: Admin tools for managing users and tracking performance.
- **Range Management**: Bulk upload number ranges via text files with auto-detection.
- **Number Allocation**: Exclusively assign numbers from stock to users.
- **Traffic Tracking**: Real-time SMS session recording and payout calculation.
- **Analytics**: Dashboard statistics, 30-day trends, and hourly heatmaps.
- **Security**: Password hashing, rate limiting, and security headers.

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 14+
- **Auth**: JWT & BcryptJS
- **Validation**: Express Validator
- **Logging**: Winston

## 📋 Setup Guide

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+)

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in your database credentials and JWT secret.
```bash
cp .env.example .env
```

### 3. Installation
```bash
npm install
```

### 4. Database Setup
Run migrations to create the schema and seed the initial admin user.
```bash
# Run migrations
node migrations/migrate.js

# Seed admin user
node migrations/seed.js
```

### 5. Start the Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 🔐 Security Features

- **JWT Authentication**: Secure token-based access.
- **Bcrypt Hashing**: 12 rounds of salt for passwords.
- **Rate Limiting**: Protection against brute-force and DoS.
- **Helmet.js**: Security-related HTTP headers.
- **CORS**: Controlled cross-origin resource sharing.
- **SQL Injection Prevention**: Parameterized queries via `pg`.

## 📂 Project Structure

- `src/server.js`: Main entry point.
- `src/controllers/`: Business logic for each module.
- `src/routes/`: API endpoint definitions.
- `src/middleware/`: Auth, validation, and security middleware.
- `src/config/`: Database and logger configuration.
- `migrations/`: SQL schema and runner scripts.
- `uploads/`: Temporary storage for range file imports.

## 🌐 API Endpoints

Refer to `API_DOCUMENTATION.md` for a full list of available endpoints.
