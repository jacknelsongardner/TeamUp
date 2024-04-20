const express = require('express');
const path = require('path'); 
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files from 'public' directory
app.use(bodyParser.json()); // For parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); 

app.use(session({
    secret: 'your_secret_key', // This is a secret key to sign the session cookie.
    resave: false, // Avoids resaving session if unmodified.
    saveUninitialized: false, // Doesn't create a session until something is stored.
    cookie: { secure: false } // For development, set secure to true when using HTTPS.
}));

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

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return console.log(err);
        }
        res.redirect('/login.html');
    });
});

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

app.post('/manageapplications', async (req,res) => 
{
    
})

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
    const sql = `SELECT PASS_KEY, USERID FROM users WHERE USERID = ?`;
    db.get(sql, [email], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Server error.');
        }
        if (row) {
            bcrypt.compare(password, row.PASS_KEY, (err, result) => {
                if (result) {
                    req.session.userId = row.USERID; // Store the user's ID in the session
                    res.redirect('/userdash.html'); // Redirect to user dashboard
                } else {
                    res.send('Invalid email or password.');
                }
            });
        } else {
            res.send('Invalid email or password.');
        }
    });
});

app.post('/buycoins', (req, res) => {
    console.log('Received headers:', req.headers);
    console.log('Received body:', req.body);

    if (!req.session.userId) {
        return res.status(401).send("Not authorized. Please log in.");
    }

    if (!req.body.coins) {
        return res.status(400).send("No coins amount provided.");
    }

    const coinsToAdd = parseInt(req.body.coins);
    if (isNaN(coinsToAdd) || coinsToAdd <= 0) {
        return res.status(400).send("Coins amount must be a positive number.");
    }

    const updateSql = `UPDATE users SET NUM_TOKENS = NUM_TOKENS + ? WHERE USERID = ?`;
    db.run(updateSql, [coinsToAdd, req.session.userId], function(err) {
        if (err) {
            console.error('Error updating tokens:', err.message);
            return res.status(500).send("Failed to update coins.");
        } else {
            console.log(`Coins updated for USERID: ${req.session.userId} | Coins Added: ${coinsToAdd}`);
            res.send(`Coins updated successfully for ${req.session.userId}! Coins Added: ${coinsToAdd}`);
        }
    });
});

app.get('/getCoins', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send("Not authorized");
    }

    const sql = 'SELECT NUM_TOKENS FROM users WHERE USERID = ?';
    db.get(sql, [req.session.userId], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Error fetching coins');
        }
        if (row) {
            res.json({ coins: row.NUM_TOKENS });
        } else {
            res.status(404).send('User not found');
        }
    });
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});








