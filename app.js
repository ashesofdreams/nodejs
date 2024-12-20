const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "*",
  })
);

app.post("/api/data", (req, res) => {
  const { LightweightName, Status, ErrorMsg } = req.body;
  const data = {
    LightweightName,
    Status,
    ErrorMsg,
  };
  res.json(data);
  //   res.send(`Hello, ${name}!`);
});
// 设置存储配置
const storage1 = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + "-" + Date.now());
  },
});
const storage2 = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
});
const upload = multer({ storage: storage1 });
const upload2 = multer({
  storage: storage2,
});

// 接口路由
app.post("/upload", upload.single("file"), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send("No file uploaded.");
  }
  res.send("File uploaded successfully.");
});
app.post("/upload/more", upload.array("files"), (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) {
    return res.status(400).send("No files uploaded.");
  }
  res.send("Files uploaded successfully.");
});
//分片
app.post("/upload/cut/", upload2.single("file"), (req, res) => {
  const index = parseInt(req.body.index);
  const total = parseInt(req.body.total);
  const filename = req.body.filename;
  const tempFilePath = path.join(
    __dirname,
    "uploads",
    `${filename}.part${index}`
  );
  fs.renameSync(req.file.path, tempFilePath);
  if (index === total - 1) {
    const finalFilePath = path.join(__dirname, "uploads", filename);
    const writeStream = fs.createWriteStream(finalFilePath);
    for (let i = 0; i < total; i++) {
      const chunkPath = path.join(__dirname, "uploads", `${filename}.part${i}`);
      const data = fs.readFileSync(chunkPath); // 读取 chunk 文件
      writeStream.write(data);
      fs.unlinkSync(chunkPath); // 逐一删除 chunk 文件
    }
    writeStream.end();
    res.json({ message: "Upload complete!" });
  } else {
    res.json({ message: "Chunk uploaded successfully!" });
  }
});
//sse
app.get("/sse", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let count = 0;
  const intervalId = setInterval(() => {
    res.write(
      `data: ${new Date().toLocaleTimeString()} - Message ${count}\n\n`
    );
    count++;
  }, 5000);

  req.on("close", () => {
    clearInterval(intervalId);
  });
});
//文件下载1
app.get("/download", (req, res) => {
  const filename = req.query.filename;
  const filePath = path.join(__dirname, "uploads", filename);

  fs.exists(filePath, (exists) => {
    if (!exists) {
      res.status(404).send("文件不存在");
      return;
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.status(416).send("范围请求无效");
        return;
      }

      const chunksize = 10 * 1024 * 1024; // 10MB
      const readStream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Content-Length": chunksize,
        "Content-Type": "application/octet-stream",
        "Accept-Ranges": "bytes",
      });

      readStream.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename=${filename}`,
        "Content-Length": fileSize,
      });

      fs.createReadStream(filePath).pipe(res);
    }
  });
});
const port = 3030;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
