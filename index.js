const express = require('express')
const request = require('request')

const app = express()

app.use(express.json())

app.all('/', async (req, res) => {
  console.log('消息推送', req.body)
  // 从header中取appid，如果from-appid不存在，则不是资源复用场景，可以直接传空字符串，使用环境所属账号发起云调用
  const appid = req.headers['x-wx-from-appid'] || ''
  const { ToUserName, FromUserName, MsgType, Content, CreateTime } = req.body
  console.log('推送接收的账号', ToUserName, '创建时间', CreateTime)
  if (MsgType === 'text') {
    if (Content === '回复文字') { // 小程序、公众号可用
      await sendmess(appid, {
        touser: FromUserName,
        msgtype: 'text',
        text: {
          content: '这是回复的消息'
        }
      })
    }
    res.send('success')
  } else {
    res.send('success')
  }
})

app.listen(80, function () {
  console.log('服务启动成功！')
})

function sendmess (appid, mess) {
  return new Promise((resolve, reject) => {
    request({
      method: 'POST',
      url: `http://api.weixin.qq.com/cgi-bin/message/custom/send?from_appid=${appid}`,
      body: JSON.stringify(mess)
    }, function (error, response) {
      if (error) {
        console.log('接口返回错误', error)
        reject(error.toString())
      } else {
        console.log('接口返回内容', response.body)
        resolve(response.body)
      }
    })
  })
}