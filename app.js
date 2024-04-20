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

app.post('/createapplication', async (req, res) => {
    const { USERID, description, category } = req.body;

    // Basic validation
    if (!USERID || !description || !category) {
        return res.status(400).send('Invalid input');
    }

    try {
        // Begin transaction
        await db.beginTransaction();

        // Insert application into 'applications' table
        const insertApplicationSql = `INSERT INTO applications (APPID, description, USERID) VALUES (?, ?, ?)`;
        const appId = generateUniqueId(); // Function to generate unique ID for application
        await db.run(insertApplicationSql, [appId, description, USERID]);

        // Insert application into 'app_category' relation
        const insertAppCategorySql = `INSERT INTO app_category (APP_CAT_ID, APPID) VALUES (?, ?)`;
        const appCatId = generateUniqueId(); // Function to generate unique ID for app_category
        await db.run(insertAppCategorySql, [appCatId, appId]);

        // Commit transaction
        await db.commit();

        console.log('Application added successfully');
        res.redirect('/login.html'); // Redirect to login page upon successful application creation
    } catch (err) {
        console.error('Error adding application:', err);
        await db.rollback();
        res.status(500).send('Server error');
    }
});

app.post('/applyjob', async (req, res) => {
    const { USERID, JOBID } = req.body;

    // Basic validation
    if (!USERID || !JOBID) {
        return res.status(400).send('Invalid input');
    }

    try {
        // Begin transaction
        await db.beginTransaction();

        // Generate unique IDs for application and job application relation
        const appId = generateUniqueId(); // Function to generate unique ID for application
        const appJobId = generateUniqueId(); // Function to generate unique ID for job application relation

        // Insert application into 'applications' table
        const insertApplicationSql = `INSERT INTO applications (APPID, USERID) VALUES (?, ?)`;
        await db.run(insertApplicationSql, [appId, USERID]);

        // Insert job application relation
        const insertJobApplicationSql = `INSERT INTO apply (APPID, JOBID) VALUES (?, ?)`;
        await db.run(insertJobApplicationSql, [appId, JOBID]);

        // Commit transaction
        await db.commit();

        console.log('Application submitted successfully');
        res.redirect('/dashboard.html'); // Redirect to dashboard upon successful application submission
    } catch (err) {
        console.error('Error submitting application:', err);
        await db.rollback();
        res.status(500).send('Server error');
    }
});

app.post('/recruitapp', async (req, res) => {
    const { APPID, JOBID } = req.body;

    // Basic validation
    if (!APPID || !JOBID) {
        return res.status(400).send('Invalid input');
    }

    try {
        // Begin transaction
        await db.beginTransaction();

        // Check if the applicant has already been recruited for the job
        const checkRecruitmentSql = `SELECT * FROM recruited WHERE APPID = ? AND JOBID = ?`;
        const existingRecruitment = await db.get(checkRecruitmentSql, [APPID, JOBID]);
        if (existingRecruitment) {
            return res.status(400).send('Applicant has already been recruited for this job');
        }

        // Insert recruitment into 'recruited' relation
        const insertRecruitmentSql = `INSERT INTO recruited (APPID, JOBID) VALUES (?, ?)`;
        await db.run(insertRecruitmentSql, [APPID, JOBID]);

        // Commit transaction
        await db.commit();

        console.log('Applicant recruited successfully');
        res.status(200).send('Applicant recruited successfully');
    } catch (err) {
        console.error('Error recruiting applicant:', err);
        await db.rollback();
        res.status(500).send('Server error');
    }
});


app.post('/createrole', async (req, res) => {
    const { USERID, description, category } = req.body;

    // Basic validation
    if (!USERID || !description || !category) {
        return res.status(400).send('Invalid input');
    }

    try {
        // Begin transaction
        await db.beginTransaction();

        // Insert role into 'job_postings' table
        const insertRoleSql = `INSERT INTO job_postings (JOBID, description, USERID) VALUES (?, ?, ?)`;
        const jobId = generateUniqueId(); // Function to generate unique ID for role
        await db.run(insertRoleSql, [jobId, description, USERID]);

        // Insert role into 'job_category' relation
        const insertJobCategorySql = `INSERT INTO job_category (JOB_CAT_ID, JOBID) VALUES (?, ?)`;
        const jobCatId = generateUniqueId(); // Function to generate unique ID for job_category
        await db.run(insertJobCategorySql, [jobCatId, jobId]);

        // Commit transaction
        await db.commit();

        console.log('Role created successfully');
        res.redirect('/login.html'); // Redirect to login page upon successful role creation
    } catch (err) {
        console.error('Error creating role:', err);
        await db.rollback();
        res.status(500).send('Server error');
    }
});

// Endpoint to delete an application
app.post('/deleteapplication', async (req, res) => {
    const { APPID } = req.body;

    // Basic validation
    if (!APPID) {
        return res.status(400).send('Invalid input');
    }

    try {
        // Begin transaction
        await db.beginTransaction();

        // Delete application from 'applications' table
        const deleteApplicationSql = `DELETE FROM applications WHERE APPID = ?`;
        await db.run(deleteApplicationSql, [APPID]);

        // Delete associated entries from 'apply' table
        const deleteApplySql = `DELETE FROM apply WHERE APPID = ?`;
        await db.run(deleteApplySql, [APPID]);

        // Commit transaction
        await db.commit();

        console.log('Application deleted successfully');
        res.status(200).send('Application deleted successfully');
    } catch (err) {
        console.error('Error deleting application:', err);
        await db.rollback();
        res.status(500).send('Server error');
    }
});

// Method to delete a role (job posting)
app.post('/deleterole', async (req, res) => {
    const { JOBID } = req.body;

    // Basic validation
    if (!JOBID) {
        return res.status(400).send('Invalid input');
    }

    try {
        // Begin transaction
        await db.beginTransaction();

        // Delete job posting from 'job_postings' table
        const deleteJobPostingSql = `DELETE FROM job_postings WHERE JOBID = ?`;
        await db.run(deleteJobPostingSql, [JOBID]);

        // Delete associated entries from 'apply' table
        const deleteApplySql = `DELETE FROM apply WHERE JOBID = ?`;
        await db.run(deleteApplySql, [JOBID]);

        // Commit transaction
        await db.commit();

        console.log('Role (job posting) deleted successfully');
        res.status(200).send('Role (job posting) deleted successfully');
    } catch (err) {
        console.error('Error deleting role (job posting):', err);
        await db.rollback();
        res.status(500).send('Server error');
    }
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

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});








