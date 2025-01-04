// socket-manager.js
const logger = require('./logger');
const { Server } = require('socket.io');
const { DatabaseConnection, DatabaseOperations } = require('./db-service');

class SocketManager {
  constructor(httpServer, dbConfig) {
    this.io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.dbConnection = new DatabaseConnection(dbConfig);
    this.dbOperations = new DatabaseOperations(this.dbConnection);
    
    // Track active subscriptions
    this.activeSubscriptions = new Map();
    // Track query intervals
    this.queryIntervals = new Map();
  }

  initialize() {
    logger.info('Initializing Socket Manager');
    
    this.io.on('connection', (socket) => {
      const clientId = socket.id;
      logger.info('Client connected', { clientId });

      // Handle real-time query subscriptions
      socket.on('subscribeToQuery', async (data) => {
        const { queryId, query, parameters = [], interval = 5000 } = data;
        
        logger.info('New query subscription', { 
          clientId, 
          queryId, 
          interval,
          query: query.substring(0, 100) 
        });

        // Set up interval for this query
        const intervalId = setInterval(async () => {
          try {
            const results = await this.dbOperations.executeQuery(query, parameters);
            socket.emit(`queryUpdate:${queryId}`, { 
              queryId, 
              timestamp: new Date(),
              data: results 
            });
          } catch (err) {
            logger.error('Error in query subscription', err, { queryId });
            socket.emit(`queryError:${queryId}`, { 
              queryId,
              error: err.message 
            });
          }
        }, interval);

        // Store the subscription
        this.queryIntervals.set(queryId, intervalId);
        this.activeSubscriptions.set(queryId, { socket, query, parameters });

        // Execute immediately for initial data
        try {
          const results = await this.dbOperations.executeQuery(query, parameters);
          socket.emit(`queryUpdate:${queryId}`, { 
            queryId, 
            timestamp: new Date(),
            data: results 
          });
        } catch (err) {
          logger.error('Error in initial query execution', err, { queryId });
        }
      });

      // Handle stored procedure executions
      socket.on('executeStoredProcedure', async (data) => {
        const { requestId, procedureName, parameters = [] } = data;
        
        logger.info('Stored procedure execution request', { 
          clientId, 
          requestId, 
          procedureName 
        });

        try {
          const results = await this.dbOperations.executeStoredProcedure(
            procedureName, 
            parameters
          );
          socket.emit(`procedureResult:${requestId}`, { 
            requestId, 
            data: results 
          });
        } catch (err) {
          logger.error('Error executing stored procedure', err, { 
            requestId, 
            procedureName 
          });
          socket.emit(`procedureError:${requestId}`, { 
            requestId, 
            error: err.message 
          });
        }
      });

      // Handle query unsubscriptions
      socket.on('unsubscribeFromQuery', (queryId) => {
        this.clearQuerySubscription(queryId);
        logger.info('Query unsubscribed', { clientId, queryId });
      });

      // Cleanup on disconnect
      socket.on('disconnect', () => {
        this.cleanupClientSubscriptions(socket);
        logger.info('Client disconnected', { clientId });
      });
    });
  }

  clearQuerySubscription(queryId) {
    const intervalId = this.queryIntervals.get(queryId);
    if (intervalId) {
      clearInterval(intervalId);
      this.queryIntervals.delete(queryId);
      this.activeSubscriptions.delete(queryId);
    }
  }

  cleanupClientSubscriptions(socket) {
    for (const [queryId, subscription] of this.activeSubscriptions.entries()) {
      if (subscription.socket === socket) {
        this.clearQuerySubscription(queryId);
      }
    }
  }

  async close() {
    // Clear all intervals
    for (const intervalId of this.queryIntervals.values()) {
      clearInterval(intervalId);
    }
    
    // Close database connection
    await this.dbConnection.close();
    
    // Close socket server
    if (this.io) {
      this.io.close();
    }
    
    logger.info('Socket Manager closed');
  }
}

