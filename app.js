const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');

const indexRouter = require('./routes/index');
const dataRouter = require('./routes/datoteke');
const commentsRouter = require('./routes/komentarji');
const labelsRouter = require('./routes/labele');

const app = express();

app.use(cors({
  origin: 'http://localhost:3001', // allow your frontend origin
  credentials: true               // allow cookies/auth if needed
}));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/api', indexRouter);
app.use('/api/datoteke', dataRouter);
app.use('/api/komentarji', commentsRouter);
app.use('/api/labele', labelsRouter);

module.exports = app;
