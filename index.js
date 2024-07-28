const express = require("express");
const xml2js = require('xml2js');

const app = express();
app.use(express.text({ type: 'text/xml' }));

// 解析XML的辅助函数
function parseXML(xml) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result.xml);
      }
    });
  });
}

// 微信消息处理
app.post('/', async (req, res) => {
  try {
    const message = await parseXML(req.body);
    
    if (message.MsgType === 'text') {
      let replyContent = '收到你的消息了';
      
      if (message.Content === '你好') {
        replyContent = '欢迎来到大字报';
      }
      
      const replyMessage = `
        <xml>
          <ToUserName><![CDATA[${message.FromUserName}]]></ToUserName>
          <FromUserName><![CDATA[${message.ToUserName}]]></FromUserName>
          <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
          <MsgType><![CDATA[text]]></MsgType>
          <Content><![CDATA[${replyContent}]]></Content>
        </xml>
      `;
      res.type('application/xml');
      res.send(replyMessage);
    } else {
      const replyMessage = `
        <xml>
          <ToUserName><![CDATA[${message.FromUserName}]]></ToUserName>
          <FromUserName><![CDATA[${message.ToUserName}]]></FromUserName>
          <CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
          <MsgType><![CDATA[text]]></MsgType>
          <Content><![CDATA[仅支持文本消息]]></Content>
        </xml>
      `;
      res.type('application/xml');
      res.send(replyMessage);
    }
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).send('Internal Server Error');
  }
});

const port = process.env.PORT || 80;

app.listen(port, () => {
  console.log("启动成功", port);
});