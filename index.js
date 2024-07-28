const express = require('express');
const { createCanvas, registerFont } = require('canvas');
const path = require('path');
const axios = require('axios');

const PORT = process.env.PORT || 80;
const app = express();

async function generateImage(text) {
  registerFont(path.join(__dirname, 'fonts', 'huiming.woff2'), { family: 'huiming' });

  const width = 400;
  const height = 200;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);

  ctx.font = '24px huiming';
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

  return canvas.toBuffer().toBuffer();
}

async function uploadImageToWechat(imageBuffer) {
  const form = new FormData();
  form.append('media', imageBuffer, {
    filename: 'image.png',
    contentType: 'image/png',
  });

  try {
    const response = await axios.post(
      'https://api.weixin.qq.com/cgi-bin/media/upload?type=image',
      form,
      { headers: form.getHeaders() }
    );

    return response.data.media_id;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}

app.all('/', async (req, res) => {
  console.log('消息推送', req.body);
  const { ToUserName, FromUserName, MsgType, Content, CreateTime } = req.body;

  if (MsgType === 'text') {
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
  } else {
    res.send('success');
  }
});

app.listen(PORT, function () {
  console.log(`运行成功，端口：${PORT}`);
});