const express = require('express')
const bodyParser = require('body-parser')
const { createCanvas } = require('canvas');
const axios = require('axios');
const FormData = require('form-data'); 
const fs = require('fs');

const PORT = process.env.PORT || 80

const app = express()

app.use(bodyParser.raw())
app.use(bodyParser.json({}))
app.use(bodyParser.urlencoded({ extended: true }))

async function generateImage(text) {
  const width = 400;
  const height = 200;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);

  ctx.font = '24px sans-serif'; // 你居然忘了字体，真是个小白
  ctx.fillStyle = 'green';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const words = text.split('');
  let line = '';
  const lines = [];
  const maxWidth = width - 40;
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && i > 0) {
      lines.push(line);
      line = words[i];
    } else {
      line = testLine;
    }
  }
  lines.push(line);

  const lineHeight = 30;
  const startY = (height - lineHeight * lines.length) / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, startY + index * lineHeight);
  });

  return canvas.toBuffer('image/png');
}

async function uploadImageToWechat(imageBuffer) {
  const url = `https://api.weixin.qq.com/cgi-bin/media/upload?type=image`;

  const form = new FormData();
  
  // 将 imageBuffer 写入临时文件
  const tempFilePath = 'temp_image.png';
  fs.writeFileSync(tempFilePath, imageBuffer);

  // 将文件添加到 form 中
  form.append('media', fs.createReadStream(tempFilePath), {
    filename: 'image.png',
    contentType: 'image/png'
  });

  try {
    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
      },
      maxBodyLength: Infinity, // 允许大文件上传
    });

    // 删除临时文件
    fs.unlinkSync(tempFilePath);

    if (response.data && response.data.media_id) {
      console.log('Upload successful:', response.data);
      return response.data.media_id;
    } else {
      console.error('Upload failed:', response.data);
      throw new Error('Failed to get media_id from WeChat API');
    }
  } catch (error) {
    console.error('Error uploading image:', error);
    // 确保在出错时也删除临时文件
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    throw error;
  }
}


app.all('/', async (req, res) => {
  console.log('消息推送', req.body)
  const { ToUserName, FromUserName, MsgType, Content, CreateTime } = req.body
  if (MsgType === 'text') {
    if (Content === '回复文字') {
      res.send({
        ToUserName: FromUserName,
        FromUserName: ToUserName,
        CreateTime: CreateTime,
        MsgType: 'text',
        Content: '请输入文字，生成大字报'
      })
    } else {
      try {
        const imageBuffer = await generateImage(Content);
        const mediaId = await uploadImageToWechat(imageBuffer);
        res.send({
          ToUserName: FromUserName,
          FromUserName: ToUserName,
          CreateTime: CreateTime,
          MsgType: 'image',
          Image: {
            MediaId: mediaId
          }
        });
      } catch (error) {
        console.error('Error processing image:', error);
        res.send({
          ToUserName: FromUserName,
          FromUserName: ToUserName,
          CreateTime: CreateTime,
          MsgType: 'text',
          Content: '抱歉，处理图片时出现错误。'
        });
      }
    }
  } else {
    res.send('success')
  }
})

app.listen(PORT, function () {
  console.log(`运行成功，端口：${PORT}`)
})
