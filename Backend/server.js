const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'abhi',
    database: 'DBMS'   // your existing DB name
});

db.connect(err => {
    if (err) throw err;
    console.log("Connected to MySQL database");
});

app.get('/api/schema', (req, res) => {
    // We fetch tables and columns dynamically. We avoid views for the sidebar menu as they are read-only (mostly), but for now we pull all base tables.
    const sql = `
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_KEY, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'DBMS' 
        ORDER BY TABLE_NAME, ORDINAL_POSITION
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).send(err);
        
        const schema = {};
        results.forEach(row => {
            if (!schema[row.TABLE_NAME]) {
                schema[row.TABLE_NAME] = [];
            }
            schema[row.TABLE_NAME].push({
                name: row.COLUMN_NAME,
                type: row.DATA_TYPE,
                isPrimaryKey: row.COLUMN_KEY === 'PRI',
                maxLength: row.CHARACTER_MAXIMUM_LENGTH,
                isNullable: row.IS_NULLABLE === 'YES',
                columnType: row.COLUMN_TYPE
            });
        });
        res.json(schema);
    });
});

app.get('/api/data/:table', (req, res) => {
    const table = req.params.table;
    db.query(`SELECT * FROM ??`, [table], (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result);
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send({ error: "Username and password required" });
    
    db.query("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, results) => {
        if (err) return res.status(500).send({ error: "Database error" });
        if (results.length === 0) return res.status(401).send({ error: "Invalid credentials" });
        
        // Return valid user without password
        const user = results[0];
        delete user.password;
        res.json(user);
    });
});

app.post('/api/data/:table', (req, res) => {
    const table = req.params.table;
    const body = req.body;
    
    // Extract keys and values from request body
    const keys = Object.keys(body);
    const values = Object.values(body);
    
    if (keys.length === 0) return res.status(400).send("No data provided");

    const placeholders = keys.map(() => '?').join(', ');
    
    // ?? escapes table/column names, ? escapes values
    const sql = `INSERT INTO ?? (${keys.map(() => '??').join(', ')}) VALUES (${placeholders})`;

    // Construct the query array: [tableName, col1, col2..., val1, val2...]
    db.query(sql, [table, ...keys, ...values], (err, result) => {
        if (err) return res.status(500).send({ error: err.message || err.sqlMessage || err });
        res.send({ message: "Inserted successfully", insertId: result.insertId });
    });
});

app.delete('/api/data/:table/:idField/:id', (req, res) => {
    const { table, idField, id } = req.params;
    db.query('DELETE FROM ?? WHERE ?? = ?', [table, idField, id], (err, result) => {
        if (err) return res.status(500).send(err);
        res.send({ message: "Deleted successfully" });
    });
});

// Backward compatibility for existing frontend
app.get('/products', (req, res) => {
    db.query("SELECT * FROM product", (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result);
    });
});

app.post('/products', (req, res) => {
    const { product_id, product_name, category, unit_price, reorder_level } = req.body;
    const sql = "INSERT INTO product VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [product_id, product_name, category, unit_price, reorder_level],
        (err, result) => {
            if (err) return res.status(500).send(err);
            res.send("Inserted successfully");
        });
});

app.listen(3000, () => console.log("Server running on port 3000"));