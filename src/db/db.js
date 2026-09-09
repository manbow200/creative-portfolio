const fs = require('fs');
const path = require('path');
require('dotenv').config();

let dbInstance = null;
const dbType = process.env.DB_TYPE || 'sqlite';

class DatabaseAdapter {
  constructor() {
    this.type = dbType;
    this.connection = null;
    this.pool = null;
  }

  async connect() {
    if (this.type === 'mysql') {
      try {
        const mysql = require('mysql2/promise');
        this.pool = mysql.createPool({
          host: process.env.DB_HOST || 'localhost',
          user: process.env.DB_USER || 'root',
          password: process.env.DB_PASS || '',
          database: process.env.DB_NAME || 'portfolio_db',
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0
        });
        // Test connection
        const conn = await this.pool.getConnection();
        conn.release();
        console.log('Successfully connected to MySQL database.');
      } catch (error) {
        console.error('Failed to connect to MySQL database. Falling back to SQLite.', error.message);
        this.type = 'sqlite';
        await this.connectSQLite();
      }
    } else {
      await this.connectSQLite();
    }
  }

  async connectSQLite() {
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.resolve(__dirname, '../../database.sqlite');
    
    return new Promise((resolve, reject) => {
      this.connection = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Could not connect to SQLite database', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database at:', dbPath);
          // Enable foreign keys
          this.connection.run('PRAGMA foreign_keys = ON', (pragmaErr) => {
            if (pragmaErr) reject(pragmaErr);
            else resolve();
          });
        }
      });
    });
  }

  async query(sql, params = []) {
    if (!this.pool && !this.connection) {
      await this.connect();
    }

    if (this.type === 'mysql') {
      // mysql2 uses ? placeholders
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    } else {
      // sqlite3 uses ? placeholders as well
      return new Promise((resolve, reject) => {
        this.connection.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    }
  }

  async run(sql, params = []) {
    if (!this.pool && !this.connection) {
      await this.connect();
    }

    if (this.type === 'mysql') {
      const [result] = await this.pool.execute(sql, params);
      return {
        insertId: result.insertId,
        changes: result.affectedRows
      };
    } else {
      return new Promise((resolve, reject) => {
        this.connection.run(sql, params, function(err) {
          if (err) {
            if (err.code === 'SQLITE_READONLY' || (err.message && err.message.includes('readonly'))) {
              console.warn('SQLite write operation skipped (read-only filesystem on Vercel):', err.message);
              return resolve({ insertId: 0, changes: 0 });
            }
            reject(err);
          } else {
            resolve({
              insertId: this.lastID,
              changes: this.changes
            });
          }
        });
      });
    }
  }

  async exec(sql) {
    if (!this.pool && !this.connection) {
      await this.connect();
    }

    if (this.type === 'mysql') {
      // In MySQL, we execute multi-line schemas statement by statement or using connection.query if multiple statements are enabled
      // For simplicity, we split statements by semicolon if needed, or execute it directly.
      const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const statement of statements) {
        await this.pool.query(statement);
      }
    } else {
      return new Promise((resolve, reject) => {
        this.connection.exec(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  async close() {
    if (this.type === 'mysql' && this.pool) {
      await this.pool.end();
    } else if (this.connection) {
      return new Promise((resolve, reject) => {
        this.connection.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }
}

function getDatabase() {
  if (!dbInstance) {
    dbInstance = new DatabaseAdapter();
  }
  return dbInstance;
}

module.exports = getDatabase();
