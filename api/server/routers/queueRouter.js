var express = require('express');
var queueService = require('../services/queueService.js');
var helper = require('../utils/helper.js');
var logger = helper.getLogger('queueRouter');
const queueRouter = express.Router();


queueRouter.get('/queue', function(req,res){
	queueService.getQueue(req,res,function(response){
		res.send(response);
	})
})

queueRouter.get('/queue/in', function(req,res){
	req.params.direction = "incoming"
	queueService.getQueue(req,res,function(response){
		res.send(response);
	})
})

queueRouter.get('/queue/out', function(req,res){
	req.params.direction = "outgoing"
	queueService.getQueue(req,res,function(response){
		res.send(response);
	})
})

queueRouter.put('/queue/cancel', function(req,res){
	queueService.cancelQueuedItem(req,res,function(response){
		res.send(response);
	})
})

queueRouter.put('/queue/status', function(req,res){
	queueService.holdQueuedItem(req,res,function(response){
		res.send(response);
	})
})

queueRouter.put('/queue/priority', function(req,res){
	queueService.proritizeQueuedItem(req,res,function(response){
		res.send(response);
	})
})

queueRouter.get('/queue/settle/:receiver', function(req,res){
	queueService.settleQueue(req,res,function(response){
		res.send(response);
	})
})

module.exports = queueRouter;
