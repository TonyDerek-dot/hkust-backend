import express from 'express';
import cors from 'cors';
import mongoose from "mongoose";
import dotenv from 'dotenv';
import userRouter from './routers/userRouter.js';
import multer from 'multer';
import path from 'path';
import archiver from 'archiver';
import fs from 'fs';

import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();
let registrationOpen = false;  // 默认为关闭状态

// 设置文件存储路径
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destPath = file.fieldname === 'file' 
      ? path.join('/var/www/uploads') 
      : path.join('/var/www/uploads/documents');
    cb(null, destPath);
  },
  filename: (req, file, cb) => {
    const decodedOriginalName = decodeURIComponent(file.originalname);
    cb(null, decodedOriginalName);
  }
});
  
const upload = multer({ storage: storage });

const app = express();

// app.use('/api/users', userRouter)// this is to initialize the users in database

app.get('/', (req, res)=>{
    res.send('Server is ready');
});

app.get('/api/registration/status', (req, res) => {
  res.json({ isOpen: registrationOpen });
});

app.post('/api/registration/toggle', (req, res) => {
  registrationOpen = req.body.isOpen;
  res.json({ isOpen: registrationOpen });
});

app.use(express.json());
app.use(express.urlencoded({extended:true}));

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
app.post('/api/upload', upload.fields([{ name: 'file' }, { name: 'resume' }]), (req, res) => {
  try {
    res.status(200).send({ message: "Files uploaded successfully" });
  } catch (error) {
    res.status(500).send({ error: "Failed to upload files" });
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