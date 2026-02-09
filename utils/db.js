const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'folklora_v1',
    waitForConnections: true, // Če ni prostih povezav, čaka
    connectionLimit: 10,       // Maksimalno število povezav
    queueLimit: 0              // Maksimalno število čakajočih zahtev
});

module.exports = pool;