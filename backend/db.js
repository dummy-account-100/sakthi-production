const sql = require("mssql");

require('dotenv').config();

const config = {
  user: process.env.DB_USER || "bubloo_SQLLogin_1",
  password: process.env.DB_PASSWORD || "y4kde2jber",
  server: process.env.DB_SERVER || "FormDb1.mssql.somee.com",
  database: process.env.DB_DATABASE || "FormDb1",
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

sql.connect(config)
  .then(() => console.log("✅ MSSQL Connected"))
  .catch(err => console.error("❌ DB Error:", err));

module.exports = sql;
