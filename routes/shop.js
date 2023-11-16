const router = require('express').Router()

let connectDB = require('./../database.js')

let db
connectDB.then((client) => {
  console.log('DB연결성공')
  db = client.db('forum')
}).catch((err) => {
  console.log(err)
})

router.get('/shirts', async (요청, 응답) => {
    응답.send('셔츠파는 페이지임')
})

router.get('/pants', async (요청, 응답) => {
    응답.send('바지파는 페이지임')
})

module.exports = router