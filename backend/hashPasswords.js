const sql = require("./db");
const bcrypt = require("bcrypt");

async function hashExistingPasswords() {
    try {
        // Connect to the database is handled by requiring db.js

        const result = await sql.query`SELECT id, password FROM DisaUsersTable`;
        const users = result.recordset;

        console.log(`Found ${users.length} users. Checking for plain text passwords...`);

        let updatedCount = 0;

        for (const user of users) {
            // Basic check: bcrypt hashes usually start with $2A$, $2B$, or $2Y$ and are 60 chars long.
            // If a password doesn't look like a bcrypt hash, we'll hash it.
            if (!user.password.startsWith("$2b$") && !user.password.startsWith("$2a$")) {
                console.log(`Hashing password for user ID: ${user.id}`);
                const hashedPassword = await bcrypt.hash(user.password, 10);

                await sql.query`
          UPDATE DisaUsersTable 
          SET password = ${hashedPassword} 
          WHERE id = ${user.id}
        `;
                updatedCount++;
            }
        }

        console.log(`Migration complete. Updated ${updatedCount} passwords.`);
        process.exit(0);

    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

// Ensure connection is established before running
setTimeout(hashExistingPasswords, 2000);
