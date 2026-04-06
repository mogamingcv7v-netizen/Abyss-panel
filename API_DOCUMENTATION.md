# ABYSS PANEL Backend API Documentation

This document provides a comprehensive overview of the RESTful API endpoints for the ABYSS PANEL backend, an enterprise SMS management system. The API is designed to support the frontend application, enabling functionalities such as user authentication, number range management, SMS traffic tracking, and administrative controls.

## 🌐 Base URL

All API endpoints are prefixed with `/api`.

## 🔐 Authentication

Authentication is handled using JSON Web Tokens (JWT). A valid token must be included in the `Authorization` header of all protected requests as `Bearer <token>`.

### Endpoints

| Method | Endpoint             | Description                                  | Access Level |
|--------|----------------------|----------------------------------------------|--------------|
| `POST` | `/api/auth/login`    | Authenticate user and receive JWT.           | Public       |
| `POST` | `/api/auth/register` | Register a new user (optional dev code).     | Public       |
| `GET`  | `/api/auth/me`       | Get current authenticated user's profile.    | Authenticated|
| `PUT`  | `/api/auth/profile`  | Update current user's profile.               | Authenticated|
| `PUT`  | `/api/auth/password` | Change current user's password.              | Authenticated|

## 👥 User Management

These endpoints are primarily for administrative users to manage system users.

### Endpoints

| Method   | Endpoint                     | Description                                    | Access Level          |
|----------|------------------------------|------------------------------------------------|-----------------------|
| `GET`    | `/api/users`                 | Get a list of all users.                       | Superadmin, Dev       |
| `GET`    | `/api/users/performance`     | Get user performance statistics.               | Superadmin, Dev       |
| `POST`   | `/api/users`                 | Create a new user.                             | Superadmin, Dev       |
| `GET`    | `/api/users/:id`             | Get details of a specific user.                | Superadmin, Dev       |
| `PUT`    | `/api/users/:id`             | Update a specific user's details.              | Superadmin, Dev       |
| `PATCH`  | `/api/users/:id/toggle`      | Toggle a user's active status.                 | Superadmin, Dev       |
| `DELETE` | `/api/users/:id`             | Delete a user and return their numbers to stock.| Superadmin, Dev       |

## 🗂️ Range Management

Endpoints for managing number ranges, including bulk uploads.

### Endpoints

| Method   | Endpoint                     | Description                                    | Access Level          |
|----------|------------------------------|------------------------------------------------|-----------------------|
| `GET`    | `/api/ranges`                | Get all number ranges.                         | Superadmin, Dev       |
| `GET`    | `/api/ranges/:id`            | Get details of a specific range.               | Superadmin, Dev       |
| `POST`   | `/api/ranges/upload`         | Upload a `.txt` file to create a new range.    | Superadmin, Dev       |
| `PUT`    | `/api/ranges/:id`            | Update a specific range.                       | Superadmin, Dev       |
| `DELETE` | `/api/ranges/:id`            | Delete a range and its associated numbers.     | Superadmin, Dev       |

## 🔢 Number Management

Endpoints for allocating and managing individual numbers.

### Endpoints

| Method   | Endpoint                     | Description                                    | Access Level          |
|----------|------------------------------|------------------------------------------------|-----------------------|
| `GET`    | `/api/numbers`               | Get a list of numbers (can be filtered).       | Authenticated         |
| `POST`   | `/api/numbers/allocate`      | Allocate numbers from a range to a user.       | Superadmin, Dev       |
| `GET`    | `/api/numbers/alloc-log`     | Get the allocation log.                        | Superadmin, Dev       |
| `PATCH`  | `/api/numbers/:id/unassign`  | Unassign a number, returning it to stock.      | Superadmin, Dev       |
| `DELETE` | `/api/numbers/:id`           | Delete a number permanently.                   | Superadmin, Dev       |

## 📈 Traffic & Analytics (CDR)

Endpoints for logging SMS traffic and retrieving analytical data.

### Endpoints

| Method   | Endpoint                         | Description                                    | Access Level          |
|----------|----------------------------------|------------------------------------------------|-----------------------|
| `POST`   | `/api/traffic`                   | Log an SMS traffic session.                    | Authenticated         |
| `GET`    | `/api/traffic`                   | Get SMS traffic records (CDR).                 | Authenticated         |
| `GET`    | `/api/traffic/stats/dashboard`   | Get dashboard statistics.                      | Authenticated         |
| `GET`    | `/api/traffic/stats/chart`       | Get chart data for traffic trends.             | Authenticated         |
| `GET`    | `/api/traffic/stats/hourly`      | Get hourly traffic heatmap data.               | Authenticated         |
| `GET`    | `/api/traffic/stats/numbers`     | Get top performing numbers.                    | Authenticated         |
| `GET`    | `/api/traffic/stats/cli`         | Get top CLIs (destination numbers).            | Superadmin, Dev       |
| `DELETE` | `/api/traffic/:id`               | Delete a specific traffic record.              | Superadmin, Dev       |
| `DELETE` | `/api/traffic/all`               | Clear all traffic records.                     | Superadmin            |

## 🎯 Targets

Endpoints for setting and managing user targets.

### Endpoints

| Method | Endpoint                     | Description                                    | Access Level          |
|--------|------------------------------|------------------------------------------------|-----------------------|
| `GET`  | `/api/targets`               | Get all user targets.                          | Superadmin, Dev       |
| `GET`  | `/api/targets/:user_id`      | Get targets for a specific user.               | Superadmin, Dev       |
| `PUT`  | `/api/targets/:user_id/:type`| Set daily or monthly target for a user.        | Superadmin, Dev       |

## ⚙️ Admin Features

Additional administrative functionalities.

### Endpoints

| Method   | Endpoint                     | Description                                    | Access Level          |
|----------|------------------------------|------------------------------------------------|-----------------------|
| `GET`    | `/api/admin/dev-codes`       | Get a list of developer invite codes.          | Superadmin            |
| `POST`   | `/api/admin/dev-codes`       | Generate a new developer invite code.          | Superadmin            |
| `DELETE` | `/api/admin/dev-codes/:id`   | Delete a developer invite code.                | Superadmin            |
| `GET`    | `/api/admin/system-info`     | Get system information and health metrics.     | Superadmin, Dev       |

## ✅ Health Check

| Method | Endpoint             | Description                                  | Access Level |
|--------|----------------------|----------------------------------------------|--------------|
| `GET`  | `/health`            | Check the health status of the API.          | Public       |
