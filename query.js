const sql = require('mssql');

// Function to run a query on SQL Server
async function runQuery(query) {
  try {
    // Execute the query
    const result = await sql.query(query);

    // Log the result
    console.log('Query result:', result.recordset);
  } catch (error) {
    // Handle errors
    console.error('Error running query:', error.message);
  }
}

// Export the function to run the query
module.exports = runQuery;
