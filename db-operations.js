const { Request, TYPES } = require('tedious');
const logger = require('./logger');

class DatabaseOperations {
  constructor(dbConnection) {
    this.dbConnection = dbConnection;
  }

  async executeQuery(query, parameters = []) {
    const startTime = Date.now();
    const queryId = Math.random().toString(36).substring(7);

    logger.info('Executing query', {
      queryId,
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      parameterCount: parameters.length
    });

    try {
      if (!this.dbConnection.isConnected) {
        await this.dbConnection.connect();
      }

      const results = await new Promise((resolve, reject) => {
        const rows = [];
        const request = new Request(query, (err, rowCount) => {
          if (err) {
            logger.error('Query execution failed', err, { queryId });
            reject(err);
            return;
          }

          const executionTime = Date.now() - startTime;
          logger.info('Query executed successfully', {
            queryId,
            rowCount,
            executionTime: `${executionTime}ms`
          });
          resolve(rows);
        });

        // Add parameters
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
          rows.push(row);
        });

        this.dbConnection.getConnection().execSql(request);
      });

      return results;

    } catch (err) {
      logger.error('Error in executeQuery', err, {
        queryId,
        query: query.substring(0, 200) + (query.length > 200 ? '...' : '')
      });
      throw err;
    }
  }

  async executeStoredProcedure(procedureName, parameters = []) {
    const startTime = Date.now();
    const procId = Math.random().toString(36).substring(7);

    logger.info('Executing stored procedure', {
      procId,
      procedureName,
      parameterCount: parameters.length
    });

    try {
      if (!this.dbConnection.isConnected) {
        await this.dbConnection.connect();
      }

      const results = await new Promise((resolve, reject) => {
        const rows = [];
        const request = new Request(procedureName, (err, rowCount, rows) => {
          if (err) {
            logger.error('Stored procedure execution failed', err, { procId });
            reject(err);
            return;
          }

          const executionTime = Date.now() - startTime;
          logger.info('Stored procedure executed successfully', {
            procId,
            rowCount,
            executionTime: `${executionTime}ms`
          });
          resolve(rows);
        });

        // Add parameters
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
          rows.push(row);
        });

        this.dbConnection.getConnection().callProcedure(request);
      });

      return results;

    } catch (err) {
      logger.error('Error in executeStoredProcedure', err, {
        procId,
        procedureName
      });
      throw err;
    }
  }
}
