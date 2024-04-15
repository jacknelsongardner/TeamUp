const express = require('express');
const path = require('path'); 
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files from 'public' directory

// Database setup and table creation
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Could not connect to database', err);
        return;
    }
    console.log('Connected to database');
    createTables();
});

function createTables() {
    const tableCreations = [
        `CREATE TABLE IF NOT EXISTS users (
            USERID TEXT PRIMARY KEY,
            PASS_KEY TEXT,
            NUM_TOKENS INTEGER,
            NAME TEXT
        );`,
        `CREATE TABLE IF NOT EXISTS job_postings (
            JOBID TEXT PRIMARY KEY,
            description TEXT,
            USERID TEXT,
            FOREIGN KEY (USERID) REFERENCES users(USERID)
        );`,
        `CREATE TABLE IF NOT EXISTS applications (
            APPID TEXT PRIMARY KEY,
            description TEXT,
            USERID TEXT,
            FOREIGN KEY (USERID) REFERENCES users(USERID)
        );`,
        `CREATE TABLE IF NOT EXISTS app_category (
            APP_CAT_ID TEXT PRIMARY KEY,
            APPID TEXT,
            FOREIGN KEY (APPID) REFERENCES applications(APPID)
        );`,
        `CREATE TABLE IF NOT EXISTS job_category (
            JOB_CAT_ID TEXT PRIMARY KEY,
            JOBID TEXT,
            FOREIGN KEY (JOBID) REFERENCES job_postings(JOBID)
        );`,
        `CREATE TABLE IF NOT EXISTS apply (
            JOBID TEXT,
            APPID TEXT,
            PRIMARY KEY (APPID, JOBID),
            FOREIGN KEY (APPID) REFERENCES applications(APPID),
            FOREIGN KEY (JOBID) REFERENCES job_postings(JOBID)
        );`,
        `CREATE TABLE IF NOT EXISTS recruited (
            JOBID TEXT,
            APPID TEXT,
            PRIMARY KEY (APPID, JOBID),
            FOREIGN KEY (APPID) REFERENCES applications(APPID),
            FOREIGN KEY (JOBID) REFERENCES job_postings(JOBID)
        );`,
        `CREATE TABLE IF NOT EXISTS contact (
            USERID TEXT,
            INFO TEXT,
            FOREIGN KEY (USERID) REFERENCES users(USERID)
        );`
    ];

    tableCreations.forEach((query) => {
        db.run(query, (err) => {
            if (err) {
                console.error('Error creating table', err);
            }
        });
    });
}

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
  });

  app.get('/manageteams', (req, res) => {
    res.sendFile(path.join(__dirname, 'manageteams.html'));
  });
  
  app.get('/manageapplications', (req, res) => {
    res.sendFile(path.join(__dirname, 'manageapplications.html'));
  });
  
  app.get('/buycoins', (req, res) => {
    res.sendFile(path.join(__dirname, 'buycoins.html'));
  });


app.post('/signup', async (req, res) => {
    const { email: USERID, password } = req.body; // Assuming form data uses 'email' but DB uses 'USERID'

    // Basic validation
    if (!USERID || !password || password.length < 6) {
        return res.status(400).send('Invalid input');
    }

    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user into database
        const sql = `INSERT INTO users (USERID, PASS_KEY, NUM_TOKENS, NAME) VALUES (?, ?, ?, ?)`;
        db.run(sql, [USERID, hashedPassword, 0, ''], function(err) {
            if (err) {
                console.error('Error inserting user into database', err.message);
                res.status(500).send('Could not register user. Might be a duplicate USERID.');
            } else {
                console.log(`A new row has been inserted with rowid ${this.lastID}`);
                res.redirect('/login.html'); // Redirect to login page upon successful signup
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const sql = `SELECT PASS_KEY FROM users WHERE USERID = ?`;
    db.get(sql, [email], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Server error.');
        }
        if (row) {
            bcrypt.compare(password, row.PASS_KEY, (err, result) => {
                if (result) {
                    // Passwords match
                    res.redirect('/userdash.html'); // Redirect to user dashboard
                } else {
                    // Passwords don't match
                    res.send('Invalid email or password.'); // Handle invalid login
                }
            });
        } else {
            // No user found with that email
            res.send('Invalid email or password.'); // Handle invalid login
        }
    });
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
