const sql = require('mssql');

// Configuration for connecting to SQL Server
const config = {
  user: 'your_username',
  password: 'your_password',
  server: 'your_server', // You can also use IP address
  database: 'your_database',
  options: {
    encrypt: true, // If you're using Azure, set to true
    trustServerCertificate: true, // If you're using a self-signed certificate, set to true
  },
};

// Function to connect to SQL Server
async function connectToDB() {
  try {
    await sql.connect(config);
    console.log('Connected to SQL Server');
  } catch (error) {
    console.error('Error connecting to SQL Server:', error.message);
  }
}

// Export the function to make the connection
module.exports = connectToDB;
