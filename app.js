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
            APP_CAT_ID TEXT,
            APPID TEXT,
            PRIMARY KEY (APP_CAT_ID, APPID),
            FOREIGN KEY (APPID) REFERENCES applications(APPID),
            FOREIGN KEY (APP_CAT_ID) REFERENCES category(CAT_NAME)
        );`,

        `CREATE TABLE IF NOT EXISTS job_category (
            JOB_CAT_ID TEXT,
            JOBID TEXT,
            PRIMARY KEY (JOB_CAT_ID, APPID),
            FOREIGN KEY (JOBID) REFERENCES job_postings(JOBID),
            FOREIGN KEY (JOB_CAT_ID) REFERENCES category(CAT_NAME)
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
            PRIMARY KEY (USERID, INFO)
            FOREIGN KEY (USERID) REFERENCES users(USERID)
        );`,

        'CREATE TABLE IF NOT EXISTS category (CAT_NAME TEXT PRIMARY KEY);',

        "INSERT OR IGNORE INTO category (CAT_NAME) VALUES ('Admin'), ('Manager'), ('Employee'), ('Webdeveloper'), ('GameDeveloper');",

       `INSERT OR IGNORE INTO job_postings (JOBID, description, USERID) VALUES
            ('job4', 'Description for job 1', 'user1'),
            ('job2', 'Description for job 2', 'user2'),
            ('job3', 'Description for job 3', 'user3');`,

        `INSERT OR IGNORE INTO job_category (JOB_CAT_ID, JOBID) VALUES
            ('Employee', 'job4'),
            ('Employee', 'job2'),
            ('Employee', 'job3');
            `, ];

    tableCreations.forEach((query) => {
        db.run(query, (err) => {
            if (err) {
                console.error('Error creating table', err);
            }
        });
    });
}

app.post('/createapplication', async (req, res) => {
    const { APPID, description, category } = req.body;

    // Basic validation
    if (!APPID || !description || !category) {
        return res.status(400).send('Invalid input');
    }

    try {
        // Begin transaction
        //await.beginTransaction();

        // Insert application into 'applications' table
        const insertApplicationSql = ` INSERT INTO applications ( APPID, description, USERID) VALUES (?, ?, ?)`;
        const appId = APPID; // Function to generate unique ID for application
        
        //await db.run('DELETE FROM applications;', []);

        await db.run(insertApplicationSql, [appId, description, req.session.userId]);

        // Insert application into 'app_category' relation
        //await db.run('DELETE FROM app_category;', []);
        const insertAppCategorySql = `INSERT INTO app_category (APP_CAT_ID, APPID) VALUES (?, ?)`;
        await db.run(insertAppCategorySql, [category, appId]);

        // Commit transaction
        //await db.commit();

        console.log('Application added successfully');
        res.redirect('/manageapplications.html'); // Reload page
    } catch (err) {
        console.error('Error adding application:', err);
        //await db.rollback();
        res.status(500).send('Server error');
    }
});

app.post('/applyjob', async (req, res) => {
    console.log("applying for job");
    console.log(req);
    
    const { JOBID } = req.body;
    const USERID = req.session.userId;

    // Basic validation
    if (!USERID || !JOBID) {
        return res.status(400).send('Invalid input');
    }

    try {
        // Begin transaction

        // Generate unique IDs for application and job application relation
        const appId = req.session.selectedRecruiting; 
        const appJobId = JOBID; // Function to generate unique ID for job application relation

        // Insert application into 'applications' table
        const insertApplicationSql = `INSERT OR IGNORE INTO apply (APPID, JOBID) VALUES (?, ?)`;
        await db.run(insertApplicationSql, [appId, appJobId]);

        console.log('Application submitted successfully');
        res.redirect('/swipeapplication.html'); // Redirect to dashboard upon successful application submission

        req.session.selectedApplied = JOBID; 
    } catch (err) {
        console.error('Error submitting application:', err);
       
        res.status(500).send('Server error');
    }
});

app.post('/recruitapp', async (req, res) => {
    console.log("applying for job");
    console.log(req);
    
    const { JOBID } = req.body;
    const USERID = req.session.userId;

    // Basic validation
    if (!USERID || !JOBID) {
        return res.status(400).send('Invalid input');
    }

    try {
        // Begin transaction

        // Generate unique IDs for application and job application relation
        const appId = req.session.selectedRecruiting; 
        const appJobId = JOBID; // Function to generate unique ID for job application relation

        // Insert application into 'applications' table
        const insertApplicationSql = `INSERT OR IGNORE INTO recruit (APPID, JOBID) VALUES (?, ?)`;
        await db.run(insertApplicationSql, [ appJobId, appId]);

        console.log('Application submitted successfully');
        res.redirect('/swiperecruit.html'); // Redirect to dashboard upon successful application submission

        req.session.selectedApplied = JOBID; 
    } catch (err) {
        console.error('Error submitting application:', err);
       
        res.status(500).send('Server error');
    }
});


app.post('/createrole', async (req, res) => {
    const { APPID, description, category } = req.body;

    // Basic validation
    if (!APPID || !description || !category) {
        return res.status(400).send('Invalid input');
    }

    try {
        // Begin transaction
        //await.beginTransaction();

        // Insert application into 'applications' table
        const insertApplicationSql = ` INSERT INTO job_postings ( JOBID, description, USERID) VALUES (?, ?, ?)`;
        const appId = APPID; // Function to generate unique ID for application
        
        //await db.run('DELETE FROM applications;', []);

        await db.run(insertApplicationSql, [appId, description, req.session.userId]);

        // Insert application into 'app_category' relation
        //await db.run('DELETE FROM app_category;', []);
        const insertAppCategorySql = `INSERT INTO job_category (JOB_CAT_ID, JOBID) VALUES (?, ?)`;
        await db.run(insertAppCategorySql, [category, appId]);

        // Commit transaction
        //await db.commit();

        console.log('Application added successfully');
        res.redirect('/manageapplications.html'); // Reload page
    } catch (err) {
        console.error('Error adding application:', err);
        //await db.rollback();
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

app.get('/getuserroles', async (req, res) => {
    const USERID = req.session.userId;
    console.log("successfully loaded job_postings for" + USERID);
    try {
        // Query the database to get applications of the user
        const sql = `SELECT * FROM job_postings WHERE USERID = ?`;
        db.all(sql, [USERID], (err, rows) => {
            if (err) {
                console.error('Error retrieving applications:', err);
                return res.status(500).json({ error: 'Server error' });
            }

            // Construct JSON object with applications
            const applications = rows.map(row => ({ APPID: row.APPID, description: row.description }));

            // Send the JSON object as response
            res.json({ applications });
        });
    } catch (err) {
        console.error('Error retrieving applications:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
  });

app.get('/buycoins', (req, res) => {
res.sendFile(path.join(__dirname, 'buycoins.html'));
});

app.get('/getuserapplications', async (req, res) => {
    const USERID = req.session.userId;
    console.log("successfully loaded applications for" + USERID);
    try {
        // Query the database to get applications of the user
        const sql = `SELECT * FROM applications WHERE USERID = ?`;
        db.all(sql, [USERID], (err, rows) => {
            if (err) {
                console.error('Error retrieving applications:', err);
                return res.status(500).json({ error: 'Server error' });
            }

            // Construct JSON object with applications
            const applications = rows.map(row => ({ APPID: row.APPID, description: row.description }));

            // Send the JSON object as response
            res.json({ applications });
        });
    } catch (err) {
        console.error('Error retrieving applications:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/getuserteams', async (req, res) => {
    const { USERID } = req.query;

    // Basic validation
    if (!USERID) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        // Query the database to get teams created by the user
        const sql = `SELECT * FROM teams WHERE CREATOR_ID = ?`;
        db.all(sql, [USERID], (err, rows) => {
            if (err) {
                console.error('Error retrieving user teams:', err);
                return res.status(500).json({ error: 'Server error' });
            }

            // Construct JSON object with user's teams
            const teams = rows.map(row => ({ TEAM_ID: row.TEAM_ID, name: row.name }));

            // Send the JSON object as response
            res.json({ teams });
        });
    } catch (err) {
        console.error('Error retrieving user teams:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/team', async (req, res) => {
    const {  APPID } = req.query;
    console.log("loading application data")
    // Basic validation
    if ( !APPID) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        // Query the database to get applications for the user and team
        const sql = `
            SELECT a.JOBID, a.description, ac.JOB_CAT_ID 
            FROM applications AS a 
            LEFT JOIN job_category AS ac ON a.JOBID = ac.JOBID 
            WHERE a.JOBID = ? AND a.JOBID = ?
        `;
        db.all(sql, [req.session.userId, APPID], (err, rows) => {
            if (err) {
                console.error('Error retrieving team user applications:', err);
                return res.status(500).json({ error: 'Server error' });
            }

            // Construct JSON object with user's applications for the team
            const applications = rows.map(row => ({
                APPID: row.APPID,
                description: row.description,
                category: row.APP_CAT_ID
            } ));

            if (rows.length > 0) {
                req.session.selectedCategory = rows[0].APP_CAT_ID;
            }

            

            // Setting selected 
            req.session.selectedRecruiting = "APPID";

            // Send the JSON object as response
            res.json({ applications });

            
        });
    } catch (err) {
        console.error('Error retrieving team user applications:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/application', async (req, res) => {
    const {  APPID } = req.query;
    console.log("loading application data")
    // Basic validation
    if ( !APPID) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        // Query the database to get applications for the user and team
        const sql = `
            SELECT a.APPID, a.description, ac.APP_CAT_ID 
            FROM applications AS a 
            LEFT JOIN app_category AS ac ON a.APPID = ac.APPID 
            WHERE a.USERID = ? AND a.APPID = ?
        `;
        db.all(sql, [req.session.userId, APPID], (err, rows) => {
            if (err) {
                console.error('Error retrieving team user applications:', err);
                return res.status(500).json({ error: 'Server error' });
            }

            // Construct JSON object with user's applications for the team
            const applications = rows.map(row => ({
                APPID: row.APPID,
                description: row.description,
                category: row.APP_CAT_ID
            } ));

            if (rows.length > 0) {
                req.session.selectedCategory = rows[0].APP_CAT_ID;
            }

            

            // Setting selected 
            req.session.selectedRecruiting = "APPID";

            // Send the JSON object as response
            res.json({ applications });

            
        });
    } catch (err) {
        console.error('Error retrieving team user applications:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/randomapplication', async (req, res) => {
    // Set the selected category
    req.session.selectedCategory = "Employee"
    const selectedCategory = req.session.selectedCategory;

    try {
        // Query the database to get a random team
        const sql = `
            SELECT APPID, description
            FROM job_postings
            WHERE APPID IN (
                SELECT APPID
                FROM app_category
                WHERE APP_CAT_ID = ?
            )
            ORDER BY RANDOM()
            LIMIT 1;
        `;
        db.get(sql, [selectedCategory], (err, row) => {
            if (err) {
                console.error('Error retrieving random team:', err);
                return res.status(500).json({ error: 'Server error' });
            }

            if (!row) {
                return res.status(404).json({ error: 'No teams found' });
            }

            // Construct JSON object with the random team
            const team = { JOBID: row.JOBID, description: row.description, category: selectedCategory };
            
            console.log(row.JOBID);
            console.log(row.description)
            console.log(team);

            // Send the JSON object as response
            res.json({ team });
        });
    } catch (err) {
        console.error('Error retrieving random team:', err);
        res.status(500).json({ error: 'Server error' });
    }
});


app.get('/randomteam', async (req, res) => {
    // Set the selected category
    req.session.selectedCategory = "Employee"
    const selectedCategory = req.session.selectedCategory;

    try {
        // Query the database to get a random team
        const sql = `
            SELECT JOBID, description
            FROM job_postings
            WHERE JOBID IN (
                SELECT JOBID
                FROM job_category
                WHERE JOB_CAT_ID = ?
            )
            ORDER BY RANDOM()
            LIMIT 1;
        `;
        db.get(sql, [selectedCategory], (err, row) => {
            if (err) {
                console.error('Error retrieving random team:', err);
                return res.status(500).json({ error: 'Server error' });
            }

            if (!row) {
                return res.status(404).json({ error: 'No teams found' });
            }

            // Construct JSON object with the random team
            const team = { JOBID: row.JOBID, description: row.description, category: selectedCategory };
            
            console.log(row.JOBID);
            console.log(row.description)
            console.log(team);

            // Send the JSON object as response
            res.json({ team });
        });
    } catch (err) {
        console.error('Error retrieving random team:', err);
        res.status(500).json({ error: 'Server error' });
    }
});





app.get('/checkMatch', (req, res) => {
    console.log("checking if both matched")

    const jobId = req.session.selectedApplied;
    const appId = req.params.selectedRecruiting;

    // SQL query to check if APPID and JOBID are both in apply table
    const applyQuery = `SELECT * FROM apply WHERE JOBID = ? AND APPID = ?`;

    // SQL query to check if APPID and JOBID are both in recruited table
    const recruitedQuery = `SELECT * FROM recruited WHERE JOBID = ? AND APPID = ?`;

    // Execute the queries
    db.all(applyQuery, [jobId, appId], (err, applyRows) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Internal server error');
            return;
        }

        db.all(recruitedQuery, [jobId, appId], (err, recruitedRows) => {
            if (err) {
                console.error(err.message);
                res.status(500).send('Internal server error');
                return;
            }

            // Check if both rows are found in apply and recruited tables
            if (applyRows.length > 0 && recruitedRows.length > 0) {
                // Assuming contact table structure: USERID TEXT, INFO TEXT
                const contactQuery = `
                    SELECT contact.INFO AS contactInfo
                    FROM contact
                    JOIN applications ON contact.USERID = applications.USERID
                    WHERE applications.APPID = ?;
                `;
                db.all(contactQuery, [appId], (err, contactRows) => {
                    if (err) {
                        console.error(err.message);
                        res.status(500).send('Internal server error');
                        return;
                    }

                    // Construct JSON response with contact info
                    const contactInfo = {
                        applied: contactRows[0].contactInfo, // Assuming only one contact is found for applied
                        recruited: contactRows[1].contactInfo // Assuming only one contact is found for recruited
                    };

                    res.json(contactInfo);
                });
            } else {
                const contactInfo = {
                    applied: 'Sorry, both are not matched...maybe next time!', // Assuming only one contact is found for applied
                    recruited: 'Sorry, both are not matched...maybe next time!' // Assuming only one contact is found for recruited
                };

                res.json(contactInfo);
            }
        });
    });
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
        const sql = ` INSERT INTO users (USERID, PASS_KEY, NUM_TOKENS, NAME) VALUES (?, ?, ?, ?)`;
        db.run(sql, [USERID, hashedPassword, 0, ''], function(err) {
            if (err) {
                console.error('Error inserting user into database', err.message);
                res.status(500).send('Could not register user. Might be a duplicate USERID.');
            } else {

                const insert = `INSERT INTO contact (USERID, INFO) VALUES (?, ?)`;
                
                db.all(insert, [USERID, USERID], (err, rows) => {
                    if (err) {
                        console.error('Error retrieving user teams:', err);
                        return res.status(500).json({ error: 'Server error' });
                }});


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
                
                    const insert = `INSERT OR IGNORE INTO contact (USERID, INFO) VALUES (?, ?)`;
                    db.all(insert, [email, email], (err, rows) => {
                        if (err) {
                            console.error('Error retrieving user teams:', err);
                            return res.status(500).json({ error: 'Server error' });
                    }});
                
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

app.post('/createrole', async (req, res) => {
    const { description, category } = req.body;
    const USERID = req.session.userId;  // Assuming USERID is stored in session after login

    // Basic validation
    if (!USERID || !description || !category) {
        return res.status(400).send('Invalid input');
    }

    try {
        const JOBID = uuidv4();  // Generate a unique ID for the job

        // Insert role into 'job_postings' table
        const insertRoleSql = `INSERT INTO job_postings (JOBID, description, USERID) VALUES (?, ?, ?)`;
        await db.run(insertRoleSql, [JOBID, description, USERID], function(err) {
            if (err) {
                console.error('Error creating role:', err);
                return res.status(500).send('Error creating role');
            }
            // Assuming JOB_CAT_ID is the same as category for simplicity
            const insertJobCategorySql = `INSERT INTO job_category (JOB_CAT_ID, JOBID) VALUES (?, ?)`;
            db.run(insertJobCategorySql, [category, JOBID], function(err) {
                if (err) {
                    console.error('Error assigning job category:', err);
                    return res.status(500).send('Error assigning job category');
                }
                res.send('Role created successfully');
            });
        });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).send('Server error');
    }
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



// Define the POST endpoint for decrementing coins
app.post('/decrement-coins', (req, res) => {
    const userId = req.body.user_id;
    if (!userId) {
        return res.status(400).json({ error: "User ID parameter is missing." });
    }

    // Define the decrement coins function
    const decrementCoins = () => {
        db.get("SELECT NUM_TOKENS FROM users WHERE USERID = ?", [userId], (err, row) => {
            if (err) {
                return res.status(500).json({ error: "Internal Server Error" });
            }
            if (row && row.NUM_TOKENS > 0) {
                db.run("UPDATE users SET NUM_TOKENS = NUM_TOKENS - 1 WHERE USERID = ?", [userId], (err) => {
                    if (err) {
                        return res.status(500).json({ error: "Internal Server Error" });
                    }
                    res.status(200).json({ message: "Coins decremented successfully." });
                });
            } else {
                res.status(404).json({ message: "Coins are already zero or user not found." });
            }
        });
    };

    decrementCoins();
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});






