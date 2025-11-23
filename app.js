const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const indexRouter = require('./routes/index');
const dataRouter = require('./routes/datoteke');
const commentsRouter = require('./routes/komentarji');
const labelsRouter = require('./routes/labele');

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/api', indexRouter);
app.use('/api/datoteke', dataRouter);
app.use('/api/komentarji', commentsRouter);
app.use('/api/labele', labelsRouter);

module.exports = app;
