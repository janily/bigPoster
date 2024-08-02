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
  const fontSize = 72;
  const textColor = 'rgb(29,119,56)'; // 红色

  const textToSVG = TextToSVG.loadSync('fonts/huiwen.ttf');

  if (!textToSVG) {
    console.error('TextToSVG加载失败');
    return null;
  }

  console.log('TextToSVG加载成功');

  const options = {
    x: 0,
    y: 0,
    fontSize: fontSize,
    anchor: 'top',
    attributes: { fill: textColor }
  };

  const svgText = textToSVG.getSVG(text, options);

  console.log('生成的SVG文本内容:', svgText);

  const fullSvg = `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="white"/>
    <g transform="translate(${width / 2}, ${height / 2})">${svgText}</g>
  </svg>
`;

  console.log('完整的SVG内容:', fullSvg);

  try {
    console.log('开始Sharp处理');
    const image = await sharp(Buffer.from(fullSvg))
      .png()
      .toBuffer();
    console.log('Sharp处理完成，生成的图片大小:', image.length, '字节');

    // 添加图片信息输出
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
