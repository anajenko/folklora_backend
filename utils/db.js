const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'folklora_v1',
    waitForConnections: true, // če ni prostih povezav, čaka
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;