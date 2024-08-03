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
  const height = 800;
  const fontSize = 60;
  const lineHeight = fontSize * 1.2;
  const textColor = 'rgb(29,119,56)'; // Green color
  const backgroundColor = 'white';
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

  const maxWidth = width * 0.8; // 使用80%的宽度作为文本区域
  const wrappedText = wrapText(text, maxWidth);

  let svgPaths = '';
  let yOffset = -(wrappedText.length - 1) * lineHeight / 2; // 居中整个文本块

  wrappedText.forEach((line, index) => {
    const options = {
      x: 0,
      y: yOffset + index * lineHeight,
      fontSize: fontSize,
      anchor: 'center middle',
      attributes: { fill: textColor }
    };
    const linePath = textToSVG.getD(line, options);
    svgPaths += `<path d="${linePath}" />`;
  });

  const fullSvg = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${backgroundColor}"/>
    <g transform="translate(${width / 2}, ${height / 2})" fill="${textColor}">
      ${svgPaths}
    </g>
  </svg>
`;
  console.log('完整的SVG内容:', fullSvg);

  const svgPath = path.resolve(__dirname, './output/output.svg');
  fs.writeFileSync(svgPath, fullSvg);
  console.log('SVG文件已保存:', svgPath);

  try {
    console.log('开始Sharp处理');
    const image = await sharp(Buffer.from(fullSvg))
      .png()
      .withMetadata()
      .toBuffer();
    console.log('Sharp处理完成，生成的图片大小:', image.length, '字节');
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
