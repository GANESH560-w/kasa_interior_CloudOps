const fs = require("fs");
const mysql = require("mysql2/promise");

let pool;

function getSslConfig() {
    const useSsl = String(process.env.DB_SSL || "").toLowerCase() === "true";
    if (!useSsl) {
        return undefined;
    }

    const caPath = process.env.DB_SSL_CA_PATH;
    const ssl = {
        rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "true").toLowerCase() !== "false"
    };

    if (caPath) {
        ssl.ca = fs.readFileSync(caPath, "utf8");
    }

    return ssl;
}

function getConfig() {
    return {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: getSslConfig(),
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };
}

function getPool() {
    if (!pool) {
        pool = mysql.createPool(getConfig());
    }
    return pool;
}

async function query(sql, params = []) {
    const [rows] = await getPool().execute(sql, params);
    return rows;
}

module.exports = {
    getPool,
    query
};
