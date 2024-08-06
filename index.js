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
  const width = 800;
  const minHeight = 800; // 最小高度
  const fontSize = 60;
  const authorFontSize = 30;
  const lineHeight = fontSize * 1.2;
  const textColor = 'rgb(29,119,56)'; // 绿色
  const backgroundColor = 'white';
  const padding = 100;
  const textToSVG = TextToSVG.loadSync('fonts/huiwen.ttf');
  if (!textToSVG) {
    console.error('TextToSVG加载失败');
    return null;
  }
  console.log('TextToSVG加载成功');

  function wrapText(text, maxWidth) {
    const words = text.split('');
    let lines = [];
    let currentLine = '';

    words.forEach(char => {
      const testLine = currentLine + char;
      const metrics = textToSVG.getMetrics(testLine, { fontSize });
      if (metrics.width > maxWidth && currentLine !== '') {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    });
    lines.push(currentLine);
    return lines;
  }

  let mainText = text;
  let authorName = '';
  const authorIndex = text.lastIndexOf('作者');
  if (authorIndex !== -1) {
    mainText = text.slice(0, authorIndex).trim();
    authorName = text.slice(authorIndex + 2).trim(); // 提取作者名
  }

  const maxWidth = width * 0.8; // 使用80%的宽度作为文本区域
  const wrappedText = wrapText(mainText, maxWidth);

  // 计算文本块的实际宽度和高度
  let textBlockWidth = 0;
  const textBlockHeight = wrappedText.length * lineHeight;
  wrappedText.forEach(line => {
    const metrics = textToSVG.getMetrics(line, { fontSize });
    textBlockWidth = Math.max(textBlockWidth, metrics.width);
  });

  // 计算所需的画布高度
  const requiredHeight = Math.max(minHeight, textBlockHeight + padding * 2 + (authorName ? authorFontSize + 20 : 0));

  let svgPaths = '';
  const xOffset = -textBlockWidth / 2; // 水平居中
  const yOffset = -textBlockHeight / 2 + fontSize / 2; // 垂直居中，考虑到字体基线

  wrappedText.forEach((line, index) => {
    const options = {
      x: xOffset,
      y: yOffset + index * lineHeight,
      fontSize: fontSize,
      anchor: 'left top',
      attributes: { fill: textColor }
    };
    const linePath = textToSVG.getD(line, options);
    svgPaths += `<path d="${linePath}" />`;
  });

  // 添加作者名到右下角（如果存在）
  let authorPath = '';
  if (authorName) {
    const authorOptions = {
      x: width - 100,  // 距离右边缘40像素
      y: requiredHeight - 40, // 距离底边40像素
      fontSize: authorFontSize,
      anchor: 'right bottom',
      attributes: { fill: textColor }
    };
    authorPath = textToSVG.getD(authorName, authorOptions);
  }

  const fullSvg = `
  <svg width="${width}" height="${requiredHeight}" viewBox="0 0 ${width} ${requiredHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${backgroundColor}"/>
    <g transform="translate(${width / 2}, ${(authorName ? (requiredHeight - 100) : (requiredHeight - 50)) / 2})" fill="${textColor}">
      ${svgPaths}
    </g>
    ${authorName ? `<path d="${authorPath}" fill="${textColor}" />` : ''}
  </svg>
`;

  try {
    console.log('开始Sharp处理');
    const image = await sharp(Buffer.from(fullSvg))
      .png()
      .withMetadata()
      .toBuffer();
    const metadata = await sharp(image).metadata();
    console.log('图片元数据:', metadata);
    return image;
  } catch (error) {
    console.error('Sharp处理SVG时出错:', error);
    return null;
  }
}

async function uploadImageToWechat(imageBuffer) {
  const url = `http://api.weixin.qq.com/cgi-bin/media/upload?type=image`;

  const form = new FormData();

  // 将文件添加到 form 中
  form.append('media', imageBuffer, {
    filename: 'image.png',
    contentType: 'image/png'
  });


  try {
    const response = await axios.post(url, form, {
      data: form.getBuffer(),
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
