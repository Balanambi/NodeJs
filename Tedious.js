const { Connection, Request, TYPES } = require('tedious');
const EventEmitter = require('events');

class DatabaseService extends EventEmitter {
  constructor() {
    super();
    this.config = {
      server: 'your_server_name',
      authentication: {
        type: 'ntlm', // Windows Authentication
        options: {
          trustedConnection: true
          // userName: 'domain\\username',  // Optional: Use if running as different Windows user
          // password: 'password'           // Optional: Use if running as different Windows user
        }
      },
      options: {
        database: 'your_database_name',
        encrypt: true,
        trustServerCertificate: true,
        port: 1433,
        rowCollectionOnRequestCompletion: true,
        useUTC: true,
        connectionRetryInterval: 5000  // Retry connection every 5 seconds
      }
    };
    
    this.connection = null;
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
  }

  async connect() {
    if (this.isConnected) return;

    return new Promise((resolve, reject) => {
      this.connection = new Connection(this.config);

      this.connection.on('connect', (err) => {
        if (err) {
          console.error('Connection failed:', err);
          this.handleConnectionError(err);
          reject(err);
          return;
        }
        this.isConnected = true;
        this.connectionRetries = 0;
        console.log('Connected to database successfully!');
        this.emit('connected');
        resolve();
      });

      this.connection.on('error', this.handleConnectionError.bind(this));
      this.connection.connect();
    });
  }

  handleConnectionError(err) {
    console.error('Database connection error:', err);
    this.isConnected = false;
    this.emit('error', err);
    
    if (this.connectionRetries < this.maxRetries) {
      this.connectionRetries++;
      console.log(`Retrying connection (${this.connectionRetries}/${this.maxRetries})...`);
      setTimeout(() => this.connect(), this.config.options.connectionRetryInterval);
    }
  }

  async executeProcedure(procedureName, parameters = []) {
    if (!this.isConnected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      const results = [];
      const request = new Request(procedureName, (err, rowCount, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(results);
      });

      // Add parameters to the request
      parameters.forEach(param => {
        request.addParameter(
          param.name,
          param.type || TYPES.NVarChar,
          param.value
        );
      });

      request.on('row', (columns) => {
        const row = {};
        columns.forEach((column) => {
          row[column.metadata.colName] = column.value;
        });
        results.push(row);
        this.emit('data', { procedureName, row }); // Emit each row for real-time updates
      });

      this.connection.callProcedure(request);
    });
  }

  async executeQuery(query, parameters = []) {
    if (!this.isConnected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      const results = [];
      const request = new Request(query, (err, rowCount) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(results);
      });

      // Add parameters to prevent SQL injection
      parameters.forEach(param => {
        request.addParameter(
          param.name,
          param.type || TYPES.NVarChar,
          param.value
        );
      });

      request.on('row', (columns) => {
        const row = {};
        columns.forEach((column) => {
          row[column.metadata.colName] = column.value;
        });
        results.push(row);
        this.emit('data', { query, row }); // Emit each row for real-time updates
      });

      this.connection.execSql(request);
    });
  }

  close() {
    if (this.connection) {
      this.connection.close();
      this.isConnected = false;
    }
  }
}

// Example of integration with Socket.IO
const setupDatabaseWithSocket = (io) => {
  const db = new DatabaseService();
  
  // Handle socket connections
  io.on('connection', (socket) => {
    console.log('Client connected');

    // Example: Listen for dashboard data requests
    socket.on('getDashboardData', async () => {
      try {
        // Example stored procedure call with parameters
        const results = await db.executeProcedure('GetDashboardData', [
          { name: 'LastUpdateTime', type: TYPES.DateTime, value: new Date() }
        ]);
        socket.emit('dashboardData', results);
      } catch (err) {
        socket.emit('error', { message: 'Failed to fetch dashboard data' });
      }
    });
  });

  // Listen for real-time database updates
  db.on('data', (data) => {
    io.emit('databaseUpdate', data); // Broadcast updates to all connected clients
  });

  return db;
};

module.exports = {
  DatabaseService,
  setupDatabaseWithSocket
};
