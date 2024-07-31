const express = require('express')
const bodyParser = require('body-parser')
const axios = require('axios');
const FormData = require('form-data'); 
const sharp = require('sharp');
const TextToSVG = require('text-to-svg');
const PORT = process.env.PORT || 80

const app = express()

app.use(bodyParser.raw())
app.use(bodyParser.json({}))
app.use(bodyParser.urlencoded({ extended: true }))

async function generateImage(text) {
  const width = 400;
  const height = 200;
  const fontSize = 24;
  const maxWidth = width - 40;

  const textToSVG = TextToSVG.loadSync('./fonts/huiwen.woff2');
  const attributes = { fill: 'green', 'font-family': 'sans-serif', 'font-size': fontSize, 'text-anchor': 'middle' };

  // 将文字分成多行
  const words = text.split('');
  let line = '';
  const lines = [];
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i];
    const testSVG = textToSVG.getSVG(testLine, attributes);
    const testBuffer = Buffer.from(testSVG);
    const { width: testWidth } = await sharp(testBuffer).metadata();

    if (testWidth > maxWidth && i > 0) {
      lines.push(line);
      line = words[i];
    } else {
      line = testLine;
    }
  }
  lines.push(line);

  const lineHeight = 30;
  const startY = (height - lineHeight * lines.length) / 2;

  const svgLines = lines.map((line, index) => {
    const y = startY + index * lineHeight + fontSize / 2;
    return textToSVG.getSVG(line, { ...attributes, y });
  });

  const svgText = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white" />
      ${svgLines.join('')}
    </svg>
  `;

  const svgBuffer = Buffer.from(svgText);

  const image = await sharp({
    create: {
      width: width,
      height: height,
      channels: 4,
      background: 'white'
    }
    })
    .composite([{ input: svgBuffer, top: 0, left: 0 }])
    .png()
    .toBuffer();

  return image;
}

async function uploadImageToWechat(imageBuffer) {
  const url = `https://api.weixin.qq.com/cgi-bin/media/upload?type=image`;

  const form = new FormData();

  // 将文件添加到 form 中
  form.append('media', imageBuffer, {
    filename: 'image.png',
    contentType: 'image/png'
  });


  try {
    const response = await axios.post(url, form, {
      headers: form.getHeaders()
    });
    return response.data.media_id;  // 返回 media_id
  } catch (err) {
    console.error('Error uploading image to WeChat:', err);
    return null;
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
