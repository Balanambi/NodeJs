// Example usage:
// index.js
const DatabaseConnection = require('./db-connection');
const DatabaseOperations = require('./db-operations');
const { TYPES } = require('tedious');

async function example() {
  const config = {
    server: 'your_server',
    database: 'your_database',
    // Add any additional configuration
  };

  const dbConnection = new DatabaseConnection(config);
  const dbOperations = new DatabaseOperations(dbConnection);

  try {
    // Example query execution
    const queryResults = await dbOperations.executeQuery(
      'SELECT * FROM Users WHERE DepartmentId = @deptId',
      [
        { name: 'deptId', type: TYPES.Int, value: 1 }
      ]
    );

    // Example stored procedure execution
    const spResults = await dbOperations.executeStoredProcedure(
      'GetUserDetails',
      [
        { name: 'userId', type: TYPES.Int, value: 123 },
        { name: 'includeInactive', type: TYPES.Bit, value: false }
      ]
    );

  } catch (err) {
    console.error('Error in database operations:', err);
  } finally {
    await dbConnection.close();
  }
}

module.exports = {
  DatabaseConnection,
  DatabaseOperations
};
