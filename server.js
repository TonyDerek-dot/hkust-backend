import express from 'express';
import cors from 'cors';
import mongoose from "mongoose";
import dotenv from 'dotenv';
import userRouter from './routers/userRouter.js';
import multer from 'multer';
import path from 'path';
import archiver from 'archiver';
import fs from 'fs';
import axios from 'axios';

import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();
const app = express();

const filePath = '/home/admin/registration_status.txt';

// 定义存储路径和文件名
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
      if (file.fieldname.startsWith('resume')) {
          cb(null, '/var/www/uploads/documents');
      } else {
          cb(null, '/var/www/uploads');
      }
  },
  filename: (req, file, cb) => {
      const decodedFileName = decodeURIComponent(file.originalname); // 解码文件名
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, decodedFileName + '-' + uniqueSuffix);
  }
});

const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({extended:true}));

// app.use('/api/users', userRouter)// this is to initialize the users in database

app.get('/', (req, res)=>{
    res.send('Server is ready');
});

app.get('/api/registration/status', (req, res) => {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading status file:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    const isOpen = data.trim() === 'true';
    res.json({ isOpen });
  });
});

app.post('/api/registration/toggle', (req, res) => {
  const newStatus = req.body.isOpen ? 'true' : 'false';
  fs.writeFile(filePath, newStatus, (err) => {
    if (err) {
      console.error('Error writing status file:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.json({ isOpen: req.body.isOpen });
  });
});

// 从环境变量中读取 MongoDB 连接 URI
const uri = process.env.MONGODB_URI;
console.log(uri)

mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})

var corsOptions = {
  origin: '*', // 你的前端域名
  methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));

app.use('/api/users', userRouter);

// 处理文件上传的POST请求，路径包含 /api/ 前缀
app.post('/api/upload', upload.any(), async (req, res) => {
  try {
      console.log('Saved files:', req.files);
      res.status(200).send({ message: "Files uploaded successfully to local storage." });
  } catch (error) {
      console.error("Local file upload failed:", error);
      res.status(500).send({ error: "Failed to upload files to local storage" });
  }
});


const uploadDir = '/var/www/uploads';

app.get('/api/files', (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
      if (err) {
        return res.status(500).json({ error: 'Unable to scan directory' });
      }
      res.json(files);
    });
  });
  
  app.get('/api/files/download-all', (req, res) => {
    const zipFilename = '团队信息与简历.zip';
    const output = fs.createWriteStream(path.join(__dirname, zipFilename));
    const archive = archiver('zip', {
      zlib: { level: 9 } // 设置压缩级别
    });
  
    output.on('close', () => {
      res.download(path.join(__dirname, zipFilename), zipFilename, (err) => {
        if (err) {
          console.error('Error downloading zip:', err);
          res.status(500).json({ error: 'Error downloading zip' });
        } else {
          fs.unlinkSync(path.join(__dirname, zipFilename)); // 下载后删除临时压缩文件
        }
      });
    });
  
    archive.on('error', (err) => {
      console.error('Error creating zip:', err);
      res.status(500).json({ error: 'Error creating zip' });
    });
  
    archive.pipe(output);
  
    // 将整个 /var/www/uploads 目录添加到压缩包
    archive.directory('/var/www/uploads/', false);
  
    archive.finalize();
  });
  
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`Serve at http://localhost:${port}`);
  });