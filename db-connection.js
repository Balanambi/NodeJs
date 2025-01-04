// db-connection.js
const { Connection } = require('tedious');
const logger = require('./logger');

class DatabaseConnection {
  constructor(config) {
    this.config = {
      server: config.server,
      authentication: {
        type: 'ntlm',
        options: {
          trustedConnection: true,
          ...config.authentication
        }
      },
      options: {
        database: config.database,
        encrypt: true,
        trustServerCertificate: true,
        port: 1433,
        connectionRetryInterval: 5000,
        ...config.options
      }
    };
    
    this.connection = null;
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
  }

  async connect() {
    if (this.isConnected) {
      logger.info('Database connection already established');
      return this.connection;
    }

    return new Promise((resolve, reject) => {
      try {
        logger.info('Attempting database connection', { 
          server: this.config.server, 
          database: this.config.options.database 
        });

        this.connection = new Connection(this.config);

        this.connection.on('connect', (err) => {
          if (err) {
            logger.error('Database connection failed', err, {
              server: this.config.server,
              attempt: this.connectionRetries + 1
            });
            this.handleConnectionError(err);
            reject(err);
            return;
          }

          this.isConnected = true;
          this.connectionRetries = 0;
          logger.info('Database connected successfully', {
            server: this.config.server,
            database: this.config.options.database
          });
          resolve(this.connection);
        });

        this.connection.on('error', this.handleConnectionError.bind(this));
        this.connection.connect();

      } catch (err) {
        logger.error('Unexpected error during connection attempt', err);
        reject(err);
      }
    });
  }

  handleConnectionError(err) {
    this.isConnected = false;
    
    if (this.connectionRetries < this.maxRetries) {
      this.connectionRetries++;
      logger.warn('Attempting database reconnection', {
        attempt: this.connectionRetries,
        maxRetries: this.maxRetries
      });
      
      setTimeout(() => this.connect(), this.config.options.connectionRetryInterval);
    } else {
      logger.error('Max connection retry attempts reached', err, {
        maxRetries: this.maxRetries
      });
    }
  }

  async close() {
    if (this.connection && this.isConnected) {
      logger.info('Closing database connection', {
        server: this.config.server,
        database: this.config.options.database
      });
      
      try {
        await new Promise((resolve) => {
          this.connection.on('end', () => {
            this.isConnected = false;
            resolve();
          });
          this.connection.close();
        });
        
        logger.info('Database connection closed successfully');
      } catch (err) {
        logger.error('Error closing database connection', err);
        throw err;
      }
    }
  }

  getConnection() {
    return this.connection;
  }

  isConnected() {
    return this.isConnected;
  }
}
