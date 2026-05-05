const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'abhi',
    database: 'DBMS'
});

db.connect(err => {
    if (err) {
        console.error("Connection error:", err);
        process.exit(1);
    }
    
    db.query("SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'DBMS'", (err, results) => {
        if (err) throw err;
        console.log(JSON.stringify(results, null, 2));
        process.exit(0);
    });
});
