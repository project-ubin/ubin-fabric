var express = require('express');
var fundService = require('../services/fundService.js');
var helper = require('../utils/helper.js');
var logger = helper.getLogger('fundRouter');
const fundRouter = express.Router();

fundRouter.post('/fund/transfer', function(req,res){
	fundService.transferfunds(req,res,function(response){
		res.send(response);
	})
})

fundRouter.post('/fund/redeem', function(req,res){
	fundService.redeemFund(req,res,function(response){
		res.send(response);
	})
})

fundRouter.get('/fund/suggest', function(req,res){
	fundService.getFundSuggestions(req,res,function(response){
		res.send(response);
	})
})

fundRouter.post('/fund/pledge', function(req,res){
	fundService.pledgeFund(req,res,function(response){
		res.send(response);
	})
})

// ======== funding channel  =================
fundRouter.post('/fund/interchannel/transfer/', function(req,res){
	fundService.moveOutFund(req,res,function(response){
		res.send(response);
	})	
})


module.exports = fundRouter;
