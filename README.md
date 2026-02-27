# NetScan Pro — Backend API

> Node.js / Express REST API for the Real-Time SIM Network Analyzer dashboard.

---

## 📁 Project Structure

```
netscan-backend/
│
├── server.js                    ← Entry point — starts the server
├── package.json                 ← Dependencies & npm scripts
├── .env.example                 ← Copy this to .env
├── README.md                    ← This file
│
├── config/
│   └── index.js                 ← Central config (reads .env)
│
├── models/
│   └── db.js                    ← In-memory DB: UserModel + HistoryModel
│
├── middleware/
│   ├── auth.js                  ← JWT protect() + generateToken()
│   ├── validate.js              ← Request validation rule sets
│   └── errorHandler.js          ← 404 handler + global error catcher
│
├── controllers/
│   ├── authController.js        ← register / login / getMe / logout / updateProfile
│   └── networkController.js     ← saveResult / getHistory / getStats / getEntry / clearHistory
│
└── routes/
    ├── auth.js                  ← /api/auth/*
    └── network.js               ← /api/network/*
```

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
cd netscan-backend
npm install
```

### 2. Create environment file
```bash
cp .env.example .env
```
Then open `.env` and change `JWT_SECRET` to something long and random.

### 3. Start the server
```bash
# Development (auto-restarts on changes)
npm run dev

# Production
npm start
```

Server starts on **http://localhost:5000**

---

## 🔌 All API Endpoints

### Base URL
```
http://localhost:5000/api
```

---

### 🟢 Public (no token needed)

#### `GET /api/health`
```json
{
  "success": true,
  "status": "OK",
  "uptime": "42s",
  "database": { "users": 2, "testRecords": 15 }
}
```

#### `POST /api/auth/register`
```json
// Request body
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "pass1234"
}

// Response 201
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1...",
  "user": { "id": "...", "name": "John Doe", "email": "...", "createdAt": "..." }
}
```

#### `POST /api/auth/login`
```json
// Request body
{ "email": "john@example.com", "password": "pass1234" }

// Response 200
{ "success": true, "token": "eyJ...", "user": { ... } }
```

---

### 🔒 Protected (require `Authorization: Bearer <token>`)

#### `GET /api/auth/me`
Returns the currently logged-in user object.

#### `POST /api/auth/logout`
Tells client to discard the token.

#### `PUT /api/auth/profile`
```json
{ "name": "New Name" }
```

---

#### `POST /api/network/save-result`
Called automatically by dashboard after each speed test.
```json
{
  "downloadSpeed": 45.2,
  "uploadSpeed":   18.7,
  "ping":          32,
  "jitter":        4,
  "packetLoss":    0.0,
  "networkScore":  88,
  "networkType":   "4g",
  "isp":           "Reliance Jio",
  "ip":            "1.2.3.4",
  "location":      "Mumbai, India"
}
```

#### `GET /api/network/history?page=1&limit=20`
```json
{
  "success": true,
  "data": [ { "id": "...", "downloadSpeed": 45.2, ... } ],
  "total": 42,
  "page": 1,
  "pages": 3,
  "limit": 20
}
```

#### `GET /api/network/history/:id`
Fetch a single test result by its UUID.

#### `GET /api/network/stats`
```json
{
  "success": true,
  "stats": {
    "totalTests": 42,
    "avgDownload": 38.5,
    "avgUpload":   15.2,
    "avgPing":     45,
    "avgScore":    78,
    "maxDownload": 95.1,
    "minPing":     12,
    "bestScore":   96,
    "testsLast7Days": 8,
    "lastTestedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### `DELETE /api/network/history`
Clears all test history for the logged-in user.
```json
{ "success": true, "deleted": 42 }
```

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Server port |
| `NODE_ENV` | `development` | `development` or `production` |
| `JWT_SECRET` | *(required)* | Secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | `7d` | Token expiry duration |
| `CORS_ORIGINS` | localhost:5500 | Comma-separated allowed origins |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX` | `200` | Max requests per window |
| `MAX_HISTORY_PER_USER` | `100` | Max stored tests per user |

---

## 🔗 Connecting the Dashboard

In `dashboard.html`, `API_BASE` is already set to:
```js
const API_BASE = 'http://localhost:5000/api';
```

Make sure your `.env` includes the origin where you open the HTML:
```
# If using VS Code Live Server:
CORS_ORIGINS=http://127.0.0.1:5500,http://localhost:5500

# If using a local server on port 3000:
CORS_ORIGINS=http://localhost:3000
```

---

## 📌 Notes

- **In-Memory DB**: All data is stored in RAM and **resets on server restart**. To persist data, replace `models/db.js` with a MongoDB or MySQL adapter (keep the same method signatures).
- **JWT Stateless**: Logout is client-side (delete token from localStorage). For production, add a Redis token blocklist.
- **Password Hashing**: bcryptjs with 12 salt rounds.
- **Security**: helmet + CORS + rate limiting + input validation on every route.
