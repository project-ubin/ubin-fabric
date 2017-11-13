var query = require('../utils/query.js');
var invoke = require('../utils/invoke-transaction.js');
var helper = require('../utils/helper.js');
var util = require('util');
var async = require('async');
var logger = helper.getLogger('queueService');
var config = require('../config.json');
var request = require('request');
var QueuedTransaction = require('../models/queuedtransaction.js')
var Transaction = require('../models/transaction.js')
var config = require('../config.json');
var fundService = require('./fundService.js');
var chaincodeName = helper.chainCodeMapping['bilateral'];
const requestingBank = helper.whoami()

//called from /queue & /queue/{in/out} 
//to get all queues or incoming/outgoing queue
function getQueue (req, res, callback){
    var bankName = requestingBank;
    var direction = req.params.direction;
    var response = {};
    var channels = [];
    var orgname = helper.getOrg(bankName) 
    var peers = helper.ORGS[orgname].orgPeers;
    var args = [];
    
    if(direction === 'incoming'){
        fcn = "getIncomingQueue";
        args = [bankName];
        var username = bankName;
        logger.debug(" chaincodename: %s, args: %s, fcn: %s, username: %s, orgname: %s", chaincodeName, args, fcn, username, orgname);
        async.forEach(helper.channelList(bankName), function(channelName,functioncallback) {
            if( helper.multilateralChannels.includes(channelName)){
                functioncallback();
            } else {
                query.queryChaincode("peer0", channelName, chaincodeName, args, fcn, username, orgname)
                .then(function(message) {
                    if( err = helper.checkError(message)) callback(err);
                    if(helper.IsJsonString(message)){     
                        message = JSON.parse(message);
                        async.each(message ,function(msg){
                            if(msg != null) channels.push(new QueuedTransaction(msg,channelName));
                        })
                    } else{
                        channels.push(message)
                    }     
                    functioncallback();
                });
            }
        },function(result){
            logger.debug('iterating done');
            response = channels;
            callback(response);
        });
    }else if(direction == 'outgoing'){
        fcn = "getOutgoingQueue";
        args = [bankName];
        var username = bankName;
        logger.debug(" chaincodename: %s, args: %s, fcn: %s, username: %s, orgname: %s", chaincodeName, args, fcn, username, orgname);
        async.forEach(helper.channelList(bankName), function(channelName,functioncallback) {
            if( helper.multilateralChannels.includes(channelName)){
                functioncallback();
            } else {
                query.queryChaincode("peer0", channelName, chaincodeName, args, fcn, username, orgname)
                .then(function(message) {
                    if( err = helper.checkError(message)) callback(err);
                    if(helper.IsJsonString(message)){     
                        message = JSON.parse(message);
                        async.each(message ,function(msg){
                            if(msg != null) channels.push(new QueuedTransaction(msg,channelName));
                        })
                    } else{
                        channels.push(message)
                    }
                    functioncallback();
                });
            }
        },function(result){
            response = channels;
            callback(response);
        });
    } else {    
        req.params.direction = "incoming";
        var results = [];
        getQueue(req,res,function(message){
            if(message[0] != null ) {
                async.forEach(message, function(elem,callback){
                    if(elem != null) results.push(elem);
                })
            }
            req.params.direction = "outgoing";
            getQueue(req,res,function(message){
                if(message[0] != null) {
                    async.forEach(message, function(elem, callback){
                        if(elem != null ) results.push(elem);
                    })
                }
                callback(results);
            })
        })
    }
}

//called from /queue/cancel 
//to cancel a queued item
function cancelQueuedItem (req, res, callback){
    var response = [];
    var inputPayload = req.body;
    logger.debug('input payload: %j' , inputPayload );
    if(inputPayload[0] == null){ res.status(402); callback("Go Away") }
    async.eachSeries(inputPayload, function(elem,callback){
        var transId	= elem.transId;
        var receiver = elem.receiver;
        var sender = requestingBank;
        var orgname = helper.getOrg(sender)
        var targetFundOrg = helper.getOrg(receiver);
        var channelName = helper.getChannel(sender,receiver)
        var peers = helper.getPeers(sender,receiver)
        var fcn = 'cancelQueue';
        var args = helper.stringify ( [  transId ] );
        logger.debug("peers: %s, channelName: %s, chaincodeName: %s, fcn: %s, args: %s , sender: %s, orgname: %s", peers, channelName, chaincodeName, fcn, args, sender, orgname );
        
        //Stringfy the array
        args = helper.stringify(args)
        invoke.invokeChaincode(peers, channelName , chaincodeName , fcn, args, sender, orgname)
            .then(function(message) {
            var placeholder = {};
            placeholder.status = util.format("%s",message.status);
            placeholder.transId = transId;
            placeholder.message = message.message;
            if( message.status != 200 && res.statusCode != 201 ){
                 res.status(message.status)
             } else {
                fundService.checkQueueAndSettle(sender,receiver,function(callback){}) //no need to wait for this function.
                res.status(201)
            }
            response.push(placeholder)
            callback();
        });   
    }, function(err){
        callback(response);
    })
}
        
//called from /queue/status 
//to put on hold a queued item
function holdQueuedItem (req, res, callback){
    var response = [];
    var inputPayload = req.body;
    logger.debug('input payload: %j' , inputPayload );
    if(inputPayload[0] == null){ res.status(402); callback("Go Away") }
    async.eachSeries(inputPayload, function(elem,callback){
        var transId	= elem.transId;
        var receiver = elem.receiver;
        var sender = requestingBank;
        var orgname = helper.getOrg(sender)
        var targetFundOrg = helper.getOrg(receiver);
        var channelName = helper.getChannel(sender,receiver)
        var peers = helper.getPeers(sender,receiver)
        var fcn = "toggleHoldResume";
        var args = [ transId ];
        logger.debug("peers: %s, channelName: %s, chaincodeName: %s, fcn: %s, args: %s , sender: %s, orgname: %s", peers, channelName, chaincodeName, fcn, args, sender, orgname );
        invoke.invokeChaincode(peers, channelName , chaincodeName , fcn, helper.stringify(args) , sender, orgname)
        .then(function(message) {
            var placeholder = {};
            placeholder.status = util.format("%s",message.status);
            placeholder.transId = transId;
            placeholder.message = message.message;
            if( message.status != 200 && res.statusCode != 201 ){
                 res.status(message.status)
             } else {
                fundService.checkQueueAndSettle(sender,receiver,function(callback){}) //no need to wait for this function.
                res.status(201)
            }
            response.push(placeholder)
            callback();
        });           
    }, function(err){
        callback(response);
    }) 
}

//called from /queue/priority 
//to prioritize a queued item
function proritizeQueuedItem (req, res, callback ){
    var response = [];
    var inputPayload = req.body;
    logger.debug('input payload: %j' , inputPayload );
    if(inputPayload[0] == null){ res.status(402); callback("Go Away") }
    async.eachSeries( inputPayload , function(elem,callback) {
        var sender = requestingBank;
        var transId	= elem.transId;
        var priority = elem.priority;
        var receiver = elem.receiver;
        var orgname = helper.getOrg(sender)
        var targetFundOrg = helper.getOrg(receiver);
        var channelName = helper.getChannel(sender,receiver)
        var peers = helper.getPeers(sender,receiver)
        var fcn = 'updatePriority';
        var args = [  transId , priority ];
        logger.debug("peers: %s, channelName: %s, chaincodeName: %s, fcn: %s, args: %s , sender: %s, orgname: %s", peers, channelName, chaincodeName, fcn, args, sender, orgname );
        args = helper.stringify(args);
        invoke.invokeChaincode(peers, channelName , chaincodeName , fcn, args, sender, orgname)
            .then(function(message) {
                var placeholder = {};
                placeholder.status = util.format("%s",message.status);
                placeholder.transId = transId;
                placeholder.message = message.message;
                if( message.status != 200 && res.statusCode != 201 ){
                    res.status(message.status)
                } else {
                    placeholder.message = "Success"
                    fundService.checkQueueAndSettle(sender,receiver,function(callback){}) //no need to wait for this function.
                    res.status(201)
                }
                response.push(placeholder)
                callback();
        });
    }, function(err){
        if(!err){
            callback(response);
        }
    });
}

//call from /queue/settle/:receiver
//to settle a queue if there is sufficient liquidity
function settleQueue (req,res,callback){
    var sender = requestingBank;
    var receiver = req.params.receiver;
    var response = {};
    var channels = [];
    var orgname = helper.getOrg(sender)
    var targetFundOrg = helper.getOrg(receiver);
    var channelName = helper.getChannel(sender,receiver)
    var peers = helper.getPeers(sender,receiver)
    var fcn = "checkQueueAndSettle";
    var args = helper.stringify([sender]);
    invoke.invokeChaincode(peers, channelName , chaincodeName , fcn , args , sender, orgname)
     .then(function(message){
         logger.debug("Response : " + message);
         response = message ;
         callback(response);
     })
}

exports.getQueue = getQueue;
exports.cancelQueuedItem = cancelQueuedItem;
exports.holdQueuedItem = holdQueuedItem;
exports.proritizeQueuedItem = proritizeQueuedItem;
exports.settleQueue = settleQueue;
