import express from "express";
import pg from "pg";
import multer from "multer";

import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789");

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

app.post(
  "/media/media-apis/upload-photo",
  upload.single("photo"), // expects field name "photo"
  async (req, res) => {
    try {
      const photo_id = nanoid();
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded." });
        return;
      }
      const filename = req.file.originalname;
      await pool.query("select add_photo($1,$2,$3)", [
        photo_id,
        filename,
        req.file.buffer,
      ]);
      res.status(201).json({ photo_id });
      return;
    } catch (error) {
      console.error(error);
      res.status(500).send("failed");
    }
  }
);

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
