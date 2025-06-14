import express from "express";
import body_parser from "body-parser";
import pg from "pg";

const port = 3000;
const db_user = "admin";
const db_pass = "letmein";
const db_name = "mediadb";

const pool = new pg.Pool({
  user: db_user,
  password: db_pass,
  database: db_name,
});

const app = express();
app.use(body_parser.json());

app.get("/", async (_req, res) => {
  try {
    const pgres = await pool.query("SELECT NOW() as t");
    res.send(`Hello World! Time is ${pgres.rows[0].t}`);
  } catch (err) {
    res.json(err);
  }
});

app.listen(port, () => {
  console.log(`media server listening on port ${port}`);
});
