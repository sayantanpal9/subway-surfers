# Mall Operations Optimiser

A full-stack inventory optimisation system that processes mall events in real time and intelligently decides whether online orders should be fulfilled from shelf inventory or warehouse inventory.

The system uses offline optimisation over the complete day's event sequence and then executes the precomputed decisions during real-time event processing.

## Features

- Real-time event processing
- Inventory and shelf management
- Walk-in and online order handling
- Offline dynamic programming optimisation
- Shelf-first and inventory-only baseline comparison
- Cost and revenue tracking
- Historical day summaries
- Live event feed
- Dashboard with inventory performance metrics
- MongoDB persistence
- Dockerised backend, frontend and MongoDB setup
- Vite API proxy for frontend-backend communication

## Tech Stack

### Frontend

- React
- Vite
- Axios
- CSS

### Backend

- Node.js
- Express
- MongoDB
- Mongoose

### Optimisation

- Dynamic Programming
- Per-item inventory optimisation

### Infrastructure

- Docker
- Docker Compose

## Project Structure

```text
.
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   └── index.js
│   ├── package.json
│   └── mall-task/
│
├── docker-compose.yml
├── .gitignore
└── README.md