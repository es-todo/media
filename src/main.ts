import express from "express";
import pg from "pg";
import multer from "multer";
import sharp from "sharp";

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

function make_single_trans(trans: string): (img: sharp.Sharp) => void {
  {
    const m = trans.match(/^r(\d+)$/);
    if (m) {
      return (img) => img.rotate(parseInt(m[1], 10));
    }
  }
  {
    const m = trans.match(/^c(\d+)x(\d+)$/);
    if (m) {
      const w = parseInt(m[1], 10);
      const h = parseInt(m[2], 10);
      return (img) => img.resize({ width: w, height: h, fit: "cover" });
    }
  }
  {
    const m = trans.match(/^e(\d+)x(\d+)-(\d+)x(\d+)$/);
    if (m) {
      const x1 = parseInt(m[1]);
      const y1 = parseInt(m[2]);
      const x2 = parseInt(m[3]);
      const y2 = parseInt(m[4]);
      const width = x2 - x1;
      const height = y2 - y1;
      return (img) => img.extract({ width, height, left: x1, top: y1 });
    }
  }
  throw new Error(`invalid transformer ${trans}`);
}

function make_trans(transs: string[]) {
  try {
    const fs = transs.map(make_single_trans);
    return {
      error: false as const,
      f: (img: sharp.Sharp) => {
        fs.forEach((f) => f(img));
      },
    };
  } catch (err: any) {
    return { error: true as const, message: err.message };
  }
}

const supported_extensions: Record<string, keyof sharp.FormatEnum> = {
  webp: "webp",
  jpeg: "jpeg",
  png: "png",
};

app.get("/photos/:photo_desc", async (req, res) => {
  const photo_desc = req.params.photo_desc;
  if (typeof photo_desc !== "string") {
    res.status(400).send("invalid request");
    return;
  }
  const parts = photo_desc.split(".");
  if (parts.length < 2) {
    res.status(400).send("invalid photo");
    return;
  }
  const [photo_id, ...ops] = parts;
  const [extension] = ops.splice(-1);
  const extension_type = supported_extensions[extension];
  if (!extension_type) {
    res.status(400).send(`unsupported type ${extension}`);
  }
  const transformation = make_trans(ops);
  if (transformation.error) {
    res.status(400).send(transformation.message);
    return;
  }
  const out = await pool.query("select data from photo where photo_id = $1", [
    photo_id,
  ]);
  if (out.rows.length === 0) {
    res.status(404).send("not found");
  }
  const image_buffer = out.rows[0].data;
  const img = sharp(image_buffer);
  transformation.f(img);
  img.toFormat(extension_type);
  res.type(extension_type);
  img.pipe(res);
  return;
});

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
