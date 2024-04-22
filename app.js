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
        `CREATE TABLE IF NOT EXISTS admin (
            USERID TEXT PRIMARY KEY,
            PASS_KEY TEXT
        );`,
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
        `CREATE TABLE IF NOT EXISTS contact (
            USERID TEXT,
            APPID TEXT,
            INFO TEXT,
            FOREIGN KEY (USERID) REFERENCES users(USERID),
            FOREIGN KEY (APPID) REFERENCES users(USERID)
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
            PRIMARY KEY (JOB_CAT_ID, JOBID),
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
        
        'CREATE TABLE IF NOT EXISTS category (CAT_NAME TEXT PRIMARY KEY);',
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

app.get('/getusercontacts', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send("Not authorized");
    }

    const sql = 'SELECT USERID, INFO FROM contact WHERE USERID = ?';
    db.all(sql, [req.session.userId], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Error fetching contact information');
        }
        res.json({ contacts: rows });
    });
});

app.post('/applyjob', (req, res) => {
    const { JOBID } = req.body;
    const applicantUserId = req.session.userId;

    console.log('Received JOBID:', JOBID);
    console.log('Session User ID:', applicantUserId);

    if (!applicantUserId || !JOBID) {
        console.error('Invalid input: Missing JOBID or user session ID');
        return res.status(400).send('Invalid input');
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION', err => {
            if (err) {
                console.error('Error starting transaction:', err);
                return res.status(500).send('Error starting transaction');
            }

            const jobQuery = 'SELECT USERID, description FROM job_postings WHERE JOBID = ?';
            db.get(jobQuery, [JOBID], (err, job) => {
                if (err) {
                    console.error('Error executing job query:', err);
                    db.run('ROLLBACK');
                    return res.status(500).send('Server error during job query');
                }

                if (!job || !job.USERID) {
                    console.error('Job not found or missing critical data for JOBID:', JOBID);
                    db.run('ROLLBACK');
                    return res.status(404).send('Job not found');
                }

                console.log('Job details:', job);
                const jobOwnerUserId = job.USERID;
                const jobDescription = job.description || 'No description provided';

                const contactInfo = `Applicant: ${applicantUserId}, Job Title: ${jobDescription}`;
                console.log('Contact Info:', contactInfo);

                const insertContactSql = 'INSERT INTO contact (USERID, APPID, INFO) VALUES (?, ?, ?)';
                db.run(insertContactSql, [jobOwnerUserId, applicantUserId, contactInfo], err => {
                    if (err) {
                        console.error('Error inserting into contact table:', err);
                        db.run('ROLLBACK');
                        return res.status(500).send('Server error during contact info insertion');
                    }

                    db.run('COMMIT', err => {
                        if (err) {
                            console.error('Error committing transaction:', err);
                            return res.status(500).send('Error during commit');
                        }
                        console.log('Transaction committed and contact info added successfully');
                        res.send('Application successful and contact info added');
                    });
                });
            });
        });
    });
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
    const { USERID } = req.session.userId;
    const TEAM_ID = req.session.selectedRecruiting
    req.session.selectedCategory = "Employee"
    // Basic validation
    if (!USERID || !TEAM_ID) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        // Query the database to get team information for the user and team
        const sql = `SELECT * FROM teams WHERE CREATOR_ID = ? AND TEAM_ID = ?`;
        db.get(sql, [USERID, TEAM_ID], (err, row) => {
            if (err) {
                console.error('Error retrieving user team:', err);
                return res.status(500).json({ error: 'Server error' });
            }

            if (!row) {
                return res.status(404).json({ error: 'Team not found for the user' });
            }

            // Construct JSON object with user's team
            const team = { TEAM_ID: row.TEAM_ID, name: row.name };

            // Send the JSON object as response
            res.json({ team });
        });
    } catch (err) {
        console.error('Error retrieving user team:', err);
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

app.get('/getuserroles', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send("Not authorized");
    }

    const sql = 'SELECT JOBID, description FROM job_postings WHERE USERID = ?'; // Ensure you're fetching necessary fields
    db.all(sql, [req.session.userId], (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Error fetching jobs');
        }
        res.json({ applications: rows });
    });
});

app.get('/randomapplication', async (req, res) => {
    
    req.session.selectedRecruiting = ""
    
    const { categoryID } = req.query.selectedCategory;

    // Basic validation
    if (!categoryID) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        // Query the database to get a random application with the given category ID
        const sql = `
            SELECT a.APPID, a.description 
            FROM applications AS a 
            INNER JOIN app_category AS ac ON a.APPID = ac.APPID 
            WHERE ac.APP_CAT_ID = ? 
            ORDER BY RANDOM() 
            LIMIT 1
        `;
        db.get(sql, [categoryID], (err, row) => {
            if (err) {
                console.error('Error retrieving random application:', err);
                return res.status(500).json({ error: 'Server error' });
            }

            if (!row) {
                return res.status(404).json({ error: 'No application found with the given category ID' });
            }

            // Construct JSON object with the random application
            const application = { APPID: row.APPID, description: row.description };

            // Send the JSON object as response
            res.json({ application });
        });
    } catch (err) {
        console.error('Error retrieving random application:', err);
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





/*app.get('/checkMatch', (req, res) => {
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
});*/

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

                /*const insert = `INSERT INTO contact (USERID, INFO) VALUES (?, ?)`;
                
                db.all(insert, [USERID, USERID], (err, rows) => {
                    if (err) {
                        console.error('Error retrieving user teams:', err);
                        return res.status(500).json({ error: 'Server error' });
                }});
                */

                console.log(`A new row has been inserted with rowid ${this.lastID}`);
                res.redirect('/login.html'); // Redirect to login page upon successful signup
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.post('/signupadmin', async (req, res) => {
    const { email: USERID, password } = req.body; // Assuming form data uses 'email' but DB uses 'USERID'

    // Basic validation
    if (!USERID || !password || password.length < 6) {
        return res.status(400).send('Invalid input');
    }

    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user into database
        const sql = ` INSERT INTO admin (USERID, PASS_KEY) VALUES (?, ?)`;
        db.run(sql, [USERID, hashedPassword], function(err) {
            if (err) {
                console.error('Error inserting user into database', err.message);
                res.status(500).send('Could not register user. Might be a duplicate USERID.');
            } else {

                /*const insert = `INSERT INTO contact (USERID, INFO) VALUES (?, ?)`;
                
                db.all(insert, [USERID, USERID], (err, rows) => {
                    if (err) {
                        console.error('Error retrieving user teams:', err);
                        return res.status(500).json({ error: 'Server error' });
                }});
                */

                console.log(`A new row has been inserted with rowid ${this.lastID}`);
                res.redirect('/loginAdmin.html'); // Redirect to login page upon successful signup
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
                
                    /*const insert = `INSERT OR IGNORE INTO contact (USERID, INFO) VALUES (?, ?)`;
                    db.all(insert, [email, email], (err, rows) => {
                        if (err) {
                            console.error('Error retrieving user teams:', err);
                            return res.status(500).json({ error: 'Server error' });
                    }});*/
                
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

app.post('/loginadmin', (req, res) => {
    const { email, password } = req.body;
    const sql = `SELECT PASS_KEY, USERID FROM admin WHERE USERID = ?`;
    db.get(sql, [email], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Server error.');
        }
        if (row) {
            bcrypt.compare(password, row.PASS_KEY, (err, result) => {
                if (result) {
                    req.session.userId = row.USERID; // Store the user's ID in the session
                
                    /*const insert = `INSERT OR IGNORE INTO contact (USERID, INFO) VALUES (?, ?)`;
                    db.all(insert, [email, email], (err, rows) => {
                        if (err) {
                            console.error('Error retrieving user teams:', err);
                            return res.status(500).json({ error: 'Server error' });
                    }});*/
                
                    res.redirect('/manageAdmin.html'); // Redirect to user dashboard
                
                
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

app.post('/decrementCoins', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send("Not authorized");
    }

    const decrementAmount = 1; // Change this value based on your needs
    const sql = 'UPDATE users SET NUM_TOKENS = NUM_TOKENS - ? WHERE USERID = ? AND NUM_TOKENS >= ?';

    db.run(sql, [decrementAmount, req.session.userId, decrementAmount], function(err) {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Error updating coins');
        }
        if (this.changes > 0) {
            res.send('Coins decremented successfully');
        } else {
            res.status(400).send('Not enough coins or user not found');
        }
    });
});


// Get list of users
app.get('/getallusers', (req, res) => {
    db.all('SELECT * FROM users', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        console.log(rows);
        res.json(rows); // Assuming your users are returned directly as an array of objects
    });
});

// Get list of applications
app.get('/getallapplications', (req, res) => {
    db.all('SELECT * FROM applications', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        console.log(rows);

        res.json(rows); // Assuming your applications are returned directly as an array of objects
    });
});

// Get list of job_postings
app.get('/getalljobs', (req, res) => {
    db.all('SELECT * FROM job_postings', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        console.log(rows);

        res.json(rows); // Assuming your applications are returned directly as an array of objects
    });
});

// Define route for executing SQL commands
app.post('/execute-sql', (req, res) => {
    const { sql } = req.body;
    console.log(sql);
    if (!sql) {
      return res.status(400).json({ error: 'SQL command is required' });
    }
  
    // Execute the SQL command (Assuming db is your database connection)
    db.run(sql, function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'SQL command executed successfully', changes: this.changes });
    });
  });

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});








