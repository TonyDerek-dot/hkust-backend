import express from 'express';
import cors from 'cors';
import mongoose from "mongoose";
import dotenv from 'dotenv';
import userRouter from './routers/userRouter.js';
import multer from 'multer';
import path from 'path';
import archiver from 'archiver';

dotenv.config();

// 设置文件存储路径
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, '/var/www/uploads');
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    }
  });
  
const upload = multer({ storage: storage });

const app = express();

// app.use('/api/users', userRouter)// this is to initialize the users in database

app.get('/', (req, res)=>{
    res.send('Server is ready');
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
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
      res.status(200).send({ message: "File uploaded successfully" });
  } catch (error) {
      res.status(500).send({ error: "Failed to upload file" });
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
    const zipFilename = 'files.zip';
    const output = fs.createWriteStream(path.join(__dirname, zipFilename));
    const archive = archiver('zip', {
      zlib: { level: 9 } // 设置压缩级别
    });
  
    output.on('close', () => {
      res.download(path.join(__dirname, zipFilename), zipFilename, (err) => {
        if (err) {
          console.error('Error downloading zip:', err);
          res.status(500).json({ error: 'Error downloading zip' });
        }
        fs.unlinkSync(path.join(__dirname, zipFilename)); // 下载后删除临时压缩文件
      });
    });
  
    archive.on('error', (err) => {
      console.error('Error creating zip:', err);
      res.status(500).json({ error: 'Error creating zip' });
    });
  
    archive.pipe(output);
  
    fs.readdir(uploadDir, (err, files) => {
      if (err) {
        console.error('Error reading files:', err);
        res.status(500).json({ error: 'Unable to read files' });
        return;
      }
  
      files.forEach((file) => {
        const filePath = path.join(uploadDir, file);
        archive.file(filePath, { name: file });
      });
  
      archive.finalize();
    });
  });

const port = process.env.PORT || 5000
app.listen(port, '0.0.0.0', ()=>{
    console.log(`Serve at http://localhost:${port}`);
});
