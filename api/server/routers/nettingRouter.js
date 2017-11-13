var express = require('express');
var nettingService = require('../services/nettingService.js');
var helper = require('../utils/helper.js');
var logger = helper.getLogger('nettingRouter');
const nettingRouter = express.Router();
var toggleFlag = false

nettingRouter.get('/netting/status', function(req,res){
	nettingService.getNettingStatus(req,res,function(response){
		res.send(response);
	})
})

nettingRouter.post('/netting', function(req,res){
	var input = helper.whoami()
	if(helper.regulators.includes(input)){
		res.status(500).send("error")
	} else {
		nettingService.runNetting(req,res,function(response){
			res.send(response);
		})
	}

})

nettingRouter.post('/netting/settle', function(req,res){
	nettingService.settleLSM(req,res,function(response){
		res.send(response);
	})
})

nettingRouter.get('/netting/toggle', function(req,res){
	var time = isNaN(req.headers.time) ? 30000 : req.headers.time;
	var flag = req.headers.flag == null ? null : JSON.parse(req.headers.flag.toLowerCase());
	var response = {};
	logger.debug("flag %s, toggleflag %s", flag, toggleFlag) 
	if(flag != toggleFlag){
		toggleFlag =! toggleFlag
		if(helper.regulators.includes(helper.whoami())){
			nettingService.intervalManager(toggleFlag,nettingService.autoResolveToggle,time);
		} else {
			nettingService.intervalManager(toggleFlag,nettingService.autoParticipate,time);
		}
		response = { "message" : "toggled ".concat(toggleFlag ? "ON. every "+time+" ms" : "OFF")}
	} else {
		response = { "message" : "already toggled ".concat(toggleFlag ? "ON" : "OFF")}
	}
	res.status(202).send(response)
})

module.exports = nettingRouter;
