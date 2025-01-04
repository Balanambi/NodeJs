// connection-pool.js
const logger = require('./logger');
const { DatabaseConnection } = require('./db-service');

class ConnectionPool {
  constructor(dbConfig, maxConnections = 10) {
    this.dbConfig = dbConfig;
    this.maxConnections = maxConnections;
    this.connections = [];
    this.activeConnections = new Map(); // Track which connections are in use
    this.waitingQueue = []; // Queue for waiting connection requests
  }

  async initialize() {
    logger.info('Initializing connection pool', { maxConnections: this.maxConnections });
    
    // Create initial connections
    try {
      const initialConnections = Math.min(2, this.maxConnections); // Start with 2 connections
      for (let i = 0; i < initialConnections; i++) {
        const connection = new DatabaseConnection(this.dbConfig);
        await connection.connect();
        this.connections.push(connection);
      }
      logger.info('Initial connections created', { count: initialConnections });
    } catch (err) {
      logger.error('Error initializing connection pool', err);
      throw err;
    }
  }

  async getConnection(timeout = 5000) {
    const startTime = Date.now();
    
    // Find first available connection
    const availableConnection = this.connections.find(
      conn => !this.activeConnections.has(conn)
    );

    if (availableConnection) {
      this.activeConnections.set(availableConnection, Date.now());
      logger.info('Assigned existing connection', { 
        activeConnections: this.activeConnections.size 
      });
      return availableConnection;
    }

    // If we can create new connection
    if (this.connections.length < this.maxConnections) {
      try {
        const newConnection = new DatabaseConnection(this.dbConfig);
        await newConnection.connect();
        this.connections.push(newConnection);
        this.activeConnections.set(newConnection, Date.now());
        logger.info('Created and assigned new connection', {
          totalConnections: this.connections.length
        });
        return newConnection;
      } catch (err) {
        logger.error('Error creating new connection', err);
        throw err;
      }
    }

    // Wait for available connection
    return new Promise((resolve, reject) => {
      const waitingRequest = {
        resolve,
        reject,
        startTime
      };

      this.waitingQueue.push(waitingRequest);
      
      // Set timeout
      setTimeout(() => {
        const index = this.waitingQueue.indexOf(waitingRequest);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
          reject(new Error('Connection request timeout'));
        }
      }, timeout);
    });
  }

  releaseConnection(connection) {
    if (this.activeConnections.has(connection)) {
      this.activeConnections.delete(connection);
      
      // Check waiting queue
      if (this.waitingQueue.length > 0) {
        const waitingRequest = this.waitingQueue.shift();
        this.activeConnections.set(connection, Date.now());
        waitingRequest.resolve(connection);
      }
      
      logger.info('Connection released', { 
        activeConnections: this.activeConnections.size,
        waitingRequests: this.waitingQueue.length
      });
    }
  }

  async closeAll() {
    logger.info('Closing all connections');
    
    const closePromises = this.connections.map(async (connection) => {
      try {
        await connection.close();
      } catch (err) {
        logger.error('Error closing connection', err);
      }
    });

    await Promise.all(closePromises);
    this.connections = [];
    this.activeConnections.clear();
    this.waitingQueue.forEach(request => {
      request.reject(new Error('Connection pool is closing'));
    });
    this.waitingQueue = [];
    
    logger.info('All connections closed');
  }
