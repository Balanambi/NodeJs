//app.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const db = require('./db');
const feedService = require('./feedService');

const PORT = process.env.PORT || 3000;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
  });
} else {
  const app = express();
  const server = http.createServer(app);
  const io = socketIo(server);

  // Serve static files (e.g., React build)
  app.use(express.static('public'));

  // Connect to SQL Server database
  db.connect()
    .then(() => {
      console.log('Connected to SQL Server');
      // Emit feed status updates to connected clients
      feedService.startFeedStatusUpdates(io);
    })
    .catch(error => {
      console.error('Error connecting to SQL Server:', error.message);
    });

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}


//db.js

const sql = require('mssql');

const config = {
  user: 'your_username',
  password: 'your_password',
  server: 'your_server',
  database: 'your_database',
  options: {
    encrypt: true, // If you're using Azure, set to true
    trustServerCertificate: true, // If you're using a self-signed certificate, set to true
  },
};

async function connect() {
  try {
    await sql.connect(config);
  } catch (error) {
    throw error;
  }
}

module.exports = {
  connect,
};

//feedService.js

const sql = require('mssql');

async function getFeedStatus() {
  try {
    const result = await sql.query`SELECT * FROM Feeds`;
    return result.recordset;
  } catch (error) {
    throw error;
  }
}

function startFeedStatusUpdates(io) {
  setInterval(async () => {
    try {
      const feedStatus = await getFeedStatus();
      io.emit('feedStatusUpdate', feedStatus);
    } catch (error) {
      console.error('Error fetching feed status:', error.message);
    }
  }, 5000); // Update feed status every 5 seconds
}

function startFeedStatusUpdates_OnlyTriggerWhenClientRequired(io) {
  io.on('connection', async (socket) => {
    console.log('Client connected');
    
    const intervalId = setInterval(async () => {
      try {
        const feedStatus = await getFeedStatus();
        socket.emit('feedStatusUpdate', feedStatus);
      } catch (error) {
        console.error('Error fetching feed status:', error.message);
      }
    }, 5000); // Update feed status every 5 seconds

    socket.on('disconnect', () => {
      console.log('Client disconnected');
      clearInterval(intervalId);
    });
  });
}

function startFeedStatusUpdates(io) {
  io.on('connection', async (socket) => {
    console.log('Client connected');

    // Receive feedStatusUpdate event with pagination parameters
    socket.on('feedStatusUpdate', async (paginationParams) => {
      const { pageNumber, pageSize } = paginationParams;
      
      try {
        const feedStatus = await getFeedStatus(pageNumber, pageSize);
        socket.emit('feedStatusUpdate', feedStatus);
      } catch (error) {
        console.error('Error fetching feed status:', error.message);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
}

module.exports = {
  startFeedStatusUpdates,
};

//package.json

{
  "name": "feed-status-server",
  "version": "1.0.0",
  "description": "Node.js server to emit feed status updates using Socket.IO",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js"
  },
  "dependencies": {
    "express": "^4.17.1",
    "mssql": "^7.0.0",
    "socket.io": "^4.0.1"
  },
  "devDependencies": {
    "os": "^0.1.1"
  }
}

//test.js

const io = require('socket.io-client');

const socket = io.connect('http://localhost:3000'); // Replace with your server URL

socket.on('connect', () => {
  console.log('Connected to server');

  socket.on('feedStatusUpdate', feedStatus => {
    console.log('Received feed status update:', feedStatus);
    // Process feed status updates here
  });
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
