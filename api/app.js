'use strict';
var log4js = require('log4js');
var logger = log4js.getLogger('Ubin Fabric API');
logger.setLevel('DEBUG');
var express = require('express');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var http = require('http');
var util = require('util');
var app = express();
var responseTime = require('response-time');

var cors = require('cors');
var config = require('./server/config.json');

var host = process.env.HOST || config.host;
var port = process.env.PORT || config.port;

// Set configuration
app.options('*', cors());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(responseTime())
app.set('secret', 'thisismysecret');

// Start server
app.set('port', process.env.PORT || 8080);
app.disable('x-powered-by')
app.disable('etag')
app.use(session({ secret: 'thisismysecret',resave: true, saveUninitialized: true, cookie: { maxAge: 60000 }}))
var server = http.createServer(app).listen(port, function() {});
logger.info('****************** SERVER STARTED ************************');
logger.info('**************  http://' + host + ':' + port +
	'  ******************');
server.timeout = 240000;
var helper = require('./server/utils/helper.js'); //using process.argv[2]
console.log("user is : \x1b[35m%s\x1b[0m ", helper.whoami())

var bankRouter = require('./server/routers/bankRouter');
var fundRouter = require('./server/routers/fundRouter');
var nettingRouter = require('./server/routers/nettingRouter');
var fabricRouter = require('./server/routers/fabricRouter');
var queueRouter = require('./server/routers/queueRouter');

app.use('/api', bankRouter, queueRouter, fundRouter, nettingRouter, fabricRouter);

app.use(function (err, req, res, next) {
	logger.error(err)
	res.status(500).send("error")
  })

module.exports = app;




