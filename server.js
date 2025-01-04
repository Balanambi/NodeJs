// server.js
const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

const dbConfig = {
  server: 'your_server',
  database: 'your_database'
};

const socketManager = new SocketManager(server, dbConfig);
socketManager.initialize();

server.listen(3000, () => {
  console.log('Server running on port 3000');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await socketManager.close();
  server.close();
});
