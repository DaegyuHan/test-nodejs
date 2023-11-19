// express 라이브러리 사용위함
const express = require('express')
const app = express()
const { MongoClient, ObjectId } = require('mongodb')
const methodOverride = require('method-override')
const bcrypt = require('bcrypt')
require('dotenv').config()

app.use(methodOverride('_method'))
app.use(express.static(__dirname + '/public')) // public 폴더 내의 파일을 사용할 수 있게 함 css,js,jpg 파일들(static 파일들)
app.set('view engine', 'ejs') // ejs setting
app.use(express.json())
app.use(express.urlencoded({ extended: true }))  // 유저가 데이터를 보냈을 때 꺼내쓸 수 있게 하는 코드

//
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// passport 라이브러리 세팅
const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')
const MongoStore = require('connect-mongo')

app.use(passport.initialize())
app.use(session({
  secret: '암호화에 쓸 비번',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60 * 60 * 1000 },
  store: MongoStore.create({
    mongoUrl: 'mongodb+srv://sparta:test@cluster0.edvfknb.mongodb.net/?retryWrites=true&w=majority',
    dbName: 'forum'
  })
}))
app.use(passport.session())
//

const { S3Client } = require('@aws-sdk/client-s3')
const multer = require('multer')
const multerS3 = require('multer-s3')
const s3 = new S3Client({
  region: 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.S3_KEY,
    secretAccessKey: process.env.S3_SECRET
  }
})

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'bigstarhan33',
    key: function (요청, file, cb) {
      cb(null, Date.now().toString()) //업로드시 파일명 변경가능
    }
  })
})



let connectDB = require('./database.js')

let db
connectDB.then((client) => {
  console.log('DB연결성공')
  db = client.db('forum')

  // 서버 띄우는 코드
  app.listen(process.env.PORT, () => {    //서버 띄울 포트 번호
    console.log('http://localhost:8080 에서 서버 실행 중')
  })
}).catch((err) => {
  console.log(err)
})
// mongoDB library 연결 코드





app.get('/', (요청, 응답) => {      //간단한 서버 기능, 누가 메인페이지 접속 시 응답함
  응답.sendFile(__dirname + '/index.html')
})

app.get('/news', (요청, 응답) => {
  응답.send('오늘 비 옴')
})

app.get('/shop', (요청, 응답) => {
  응답.send('쇼핑페이지임')
})

app.get('/list', async (요청, 응답) => {
  try {
    if (!요청.user || !요청.user.username) {
      // 사용자가 인증되지 않은 경우 또는 사용자의 username이 없는 경우
      return 응답.redirect('/login');
    }

    let result = await db.collection('post').find().toArray();
    let username = 요청.user.username;

    응답.render('list.ejs', { 글목록: result, 유저: username });
  } catch (error) {
    console.error(error);
    응답.status(500).send('Internal Server Error');
  }
});

app.get('/time', async (요청, 응답) => {
  let time = new Date()

  응답.render('time.ejs', { 시간: time })
})

app.get('/write', (요청, 응답) => {
  응답.render('write.ejs')
})

app.post('/add', async (요청, 응답) => {

  upload.single('img1')(요청, 응답, async (err) => {
    if (err) return 응답.send('업로드에러')
    try {
      if (요청.body.title == '') {
        응답.send('제목입력안했음')
      } else {
        await db.collection('post').insertOne(
          {
            title: 요청.body.title,
            content: 요청.body.content,
            img: 요청.file ? 요청.file.location : '',
            user: 요청.user._id,
            username: 요청.user.username
          }
        )
        응답.redirect('/list')
      }
    } catch (e) {
      console.log(e)
      응답.status(500).send('서버에러남')
    }
  })

})




app.get('/detail/:id', async (요청, 응답) => {
  let result1 = await db.collection('post').find().toArray();
  let result2 = await db.collection('comment').find({ parentId: new ObjectId(요청.params.id) }).toArray()

  try {
    let result = await db.collection('post').findOne({ _id: new ObjectId(요청.params.id) })
    if (result == null) {
      응답.status(404).send('이상한 url 입력함')
    }
    응답.render('detail.ejs', { 글목록: result1,  글: result, 댓글: result2 })
  } catch (e) {
    console.log(e)
    응답.status(404).send('이상한 url 입력함')
  }

})

app.get('/edit/:id', async (요청, 응답) => {
  let result = await db.collection('post').findOne({ _id: new ObjectId(요청.params.id)})
  console.log(result)
  응답.render('edit.ejs', { result: result })
})

app.put('/edit', async (요청, 응답) => {

  let result = await db.collection('post').updateOne({ _id: new ObjectId(요청.body.id) },
    {
      $set: {
        title: 요청.body.title,
        content: 요청.body.content
      }
    })

  응답.redirect('/list')

})


app.delete('/delete', async (요청, 응답) => {
  await db.collection('post').deleteOne({
    _id: new ObjectId(요청.query.docid),
    username: 요청.query.username
  })
  응답.send('삭제완료')
})



app.get('/list/:number', async (요청, 응답) => {
  let result = await db.collection('post').find().skip((요청.params.number - 1) * 10).limit(10).toArray()

  응답.render('list.ejs', { 글목록: result })
})


app.get('/list/next/:id', async (요청, 응답) => {
  let result = await db.collection('post').find({ _id: { $gt: new ObjectId(요청.params.id) } }).limit(10).toArray()

  응답.render('list.ejs', { 글목록: result })
})


passport.use(new LocalStrategy(async (입력한아이디, 입력한비번, cb) => {
  let result = await db.collection('user').findOne({ username: 입력한아이디 })
  if (!result) {
    return cb(null, false, { message: '아이디 DB에 없음' })
  }


  if (await bcrypt.compare(입력한비번, result.password)) {
    return cb(null, result)
  } else {
    return cb(null, false, { message: '비번불일치' });
  }
}))

// passport.authenticate('local')() 가 실행될 때 마다 아래 코드도 같이 실행됨 ( 세선만드는 코드 )

passport.serializeUser((user, done) => {
  console.log(user)
  process.nextTick(() => {
    done(null, { id: user._id, username: user.username })
  })
})

passport.deserializeUser(async (user, done) => {
  let result = await db.collection('user').findOne({ _id: new ObjectId(user.id) })
  delete result.password
  process.nextTick(() => {
    done(null, result)
  })
})

app.get('/login', async (요청, 응답) => {
  console.log(요청.user)
  응답.render('login.ejs')
})

app.post('/login', async (요청, 응답, next) => {
  passport.authenticate('local', (error, user, info) => {
    if (error) return 응답.status(500).json(error)
    if (!user) return 응답.status(401).json(info.message)
    요청.logIn(user, (err) => {
      if (err) return next(err)
      응답.redirect('/list')
    })


  })(요청, 응답, next)

})

app.get('/register', async (요청, 응답) => {
  응답.render('register.ejs')
})

app.post('/register', async (요청, 응답) => {

  let 해시 = await bcrypt.hash(요청.body.password, 10)

  await db.collection('user').insertOne({
    username: 요청.body.username,
    password: 해시
  })
  응답.redirect('/')
})

app.use('/shop', require('./routes/shop.js'))

app.get('/search', async (요청, 응답) => {
  let result = await db.collection('post')
    .find({
      $or: [
        { title: { $regex: 요청.query.val } },
        { content: { $regex: 요청.query.val } }
      ]
    }).toArray()
  응답.render('search.ejs', { 글목록: result })
})

app.post('/comment', async (요청, 응답) => {
  await db.collection('comment').insertOne({
    content: 요청.body.content,
    writerId: new ObjectId(요청.user._id),
    writer: 요청.user.username,
    parentId: new ObjectId(요청.body.parentId)
  })
  응답.redirect('back')
})


app.get("/logout", function (요청, 응답) {
  요청.logout(function (err) {
    if (err) {
      return next(err);
    }
    응답.redirect("/");
  });
});