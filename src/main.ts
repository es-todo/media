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
      console.log(`uploaded ${filename} as ${photo_id}`);
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
    const m = trans.match(/^r(.*)$/);
    if (m) {
      const r = parseFloat(m[1]);
      return (img) => img.rotate(r);
    }
  }
  {
    const m = trans.match(/^c(.+)x(.+)$/);
    if (m) {
      const w = parseFloat(m[1]);
      const h = parseFloat(m[2]);
      return (img) => img.resize({ width: w, height: h, fit: "cover" });
    }
  }
  {
    const m = trans.match(/^e(.+),(.+),(.+)x(.+)$/);
    if (m) {
      const left = parseFloat(m[1]);
      const top = parseFloat(m[2]);
      const width = parseFloat(m[3]);
      const height = parseFloat(m[4]);
      return (img) => {
        img.extract({ left, top, width, height });
      };
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
  console.log(`http://localhost/photos/${photo_desc}`);
  const file_and_ext = photo_desc.match(/^(.+)\.([^.]+)$/);
  if (!file_and_ext) {
    res.status(400).send("invalid photo");
    return;
  }
  const [_, file_and_trans_str, extension] = file_and_ext;
  const [photo_id, ...ops] = file_and_trans_str.split("_");
  if (!photo_id) {
    res.status(400).send("invalid photo");
    return;
  }
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
  const img = sharp(image_buffer).rotate();
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
