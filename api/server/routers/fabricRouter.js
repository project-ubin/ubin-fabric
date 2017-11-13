var express = require('express');
var fabricService = require('../services/fabricService.js');
var helper = require('../utils/helper.js');
var logger = helper.getLogger('fabricRouter');
const fabricRouter = express.Router();
// Register and enroll user
fabricRouter.post('/users', function(req,res){
	fabricService.getUsers(req,res,function(response){
		res.send(response);
	})
})
// Create Channel
fabricRouter.post('/channels', function(req,res){
	fabricService.createChannel(req,res,function(response){
		res.send(response);
	})
})
// Join Channel
fabricRouter.post('/channels/:channelName/peers', function(req,res){
	fabricService.joinChannel(req,res,function(response){
		res.send(response);
	})
})
// Install chaincode on target peers
fabricRouter.post('/chaincodes', function(req,res){
	fabricService.installChaincode(req,res,function(response){
		res.send(response);
	})
})
// Instantiate chaincode on target peers
fabricRouter.post('/channels/:channelName/chaincodes', function(req,res){
	fabricService.instantiateChaincode(req,res,function(response){
		res.send(response);
	})
})
// Upgrade chaincode on target peers
fabricRouter.post('/channels/:channelName/chaincodes/upgrade', function(req,res){
	fabricService.upgradeChaincode(req,res,function(response){
		res.send(response);
	})
})
// Invoke transaction on chaincode on target peers
fabricRouter.post('/channels/:channelName/chaincodes/:chaincodeName', function(req,res){
	fabricService.invokeChaincode(req,res,function(response){
		res.send(response);
	})
})
// Query on chaincode on target peers
fabricRouter.get('/channels/:channelName/chaincodes/:chaincodeName', function(req,res){
	fabricService.queryByChaincode(req,res,function(response){
		res.send(response);
	})
})
//  Query Get Block by BlockNumber
fabricRouter.get('/channels/:channelName/blocks/:blockId', function(req,res){
	fabricService.queryBlockNumber(req,res,function(response){
		res.send(response);
	})
})
// Query Get Transaction by Transaction ID
fabricRouter.get('/channels/:channelName/transactions/:trxnId', function(req,res){
	fabricService.getTransactionByID(req,res,function(response){
		res.send(response);
	})
})
// Query Get Block by Hash
fabricRouter.get('/channels/:channelName/blocks', function(req,res){
	fabricService.getBlockByHash(req,res,function(response){
		res.send(response);
	})
})
//Query for Channel Information
fabricRouter.get('/channelinfo/:requestingBank/:channelname', function(req,res){
	fabricService.queryChannelInfo(req,res,function(response){
		res.send(response);
	})
})
// Query to fetch all Installed/instantiated chaincodes
fabricRouter.get('/chaincodes', function(req,res){
	fabricService.getAllChaincodes(req,res,function(response){
		res.send(response);
	})
})
// Query to fetch channels
fabricRouter.get('/channels/:requestingBank', function(req,res){
	fabricService.getChannels(req,res,function(response){
		res.send(response);
	})
})

// =============PING chaincodes=====================
fabricRouter.get('/ping', (req,res) => {
	fabricService.pingChaincode(req,res, (response) => {
		res.send(response);
	})
})
//Not Meant to be Exposed
fabricRouter.patch('/resetdata', (req,res) => {
	fabricService.resetAll(req,res,(response) => {
		res.send(response);
	})
})



module.exports = fabricRouter;
