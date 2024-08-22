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

let registrationOpen = false;  // 默认为关闭状态

// 配置multer，不再存储文件，而是直接处理
const storage = multer.memoryStorage(); // 使用内存存储文件
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({extended:true}));

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
app.post('/api/upload', upload.fields([{ name: 'file' }, { name: 'resume' }]), async (req, res) => {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    const githubApiUrl = 'https://api.github.com/repos/TonyDerek-dot/hkust-quant/contents/';

    if (!githubToken) {
      throw new Error('GitHub Token is missing');
    }

    for (const fieldName in req.files) {
      const file = req.files[fieldName][0];
      const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
      const rawFileName = `${timestamp}_${file.originalname}`;
      const encodedFileName = encodeURIComponent(rawFileName);  // 对文件名进行URI编码

      const fileContent = file.buffer.toString('base64');  // 将文件内容转换为Base64

      // GitHub API的详细信息
      const url = `${githubApiUrl}${encodedFileName}`;
      const data = {
        message: `Add ${rawFileName}`,
        content: fileContent,
        branch: 'main',
      };

      // 上传文件到GitHub
      const response = await axios.put(url, data, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`File uploaded successfully to GitHub: ${rawFileName}`, response.data);
    }

    res.status(200).send({ message: "Files uploaded successfully to GitHub" });
  } catch (error) {
    console.error("File upload to GitHub failed:", error);
    res.status(500).send({ error: "Failed to upload files to GitHub" });
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