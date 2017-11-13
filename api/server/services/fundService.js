var invoke = require('../utils/invoke-transaction.js');
var helper = require('../utils/helper.js');
var async = require('async');
var config = require('../config.json');
var bankService = require('./bankService.js');
var fundService = require('./fundService.js');
var queueService = require('./queueService.js');
var logger = helper.getLogger('fundService');
var util = require('util');
const requestingBank = helper.whoami()

// called from /api/fund/transfer
// transfer funds between banks
function transferfunds (req,res,callback){
	var response = {}
    var inputPayload = req.body;
    logger.debug('input payload: %j' , inputPayload );
	var orgname = helper.getOrg(requestingBank) 
	var targetFundOrg = helper.getOrg(inputPayload.receiver)  
	var username = requestingBank;
    var fcn = 'fundTransfer';
    var chaincodeName = helper.chainCodeMapping['bilateral'];
	var channelName = helper.getChannel(requestingBank,inputPayload.receiver)
    var peers = helper.getPeers(requestingBank,inputPayload.receiver)
	var sender_acct = requestingBank;
	var receiver_acct = inputPayload.receiver;
	var urgency_num = inputPayload.priority;
	var amount = inputPayload.transactionAmount;
	var currency = config.default.currency == null ? inputPayload.currency : config.default.currency;
	var enqueue = config.default.enqueue == null ? inputPayload.enqueue : config.default.enqueue;
	var args = [  sender_acct , receiver_acct , urgency_num, amount, currency, enqueue ];
	args = helper.stringify(args);
	logger.debug("peers: %s, channelName: %s, chaincodeName: %s, fcn: %s, args: %s , username: %s, orgname: %s", peers, channelName, chaincodeName, fcn, args, username, orgname );
	args = helper.stringify(args);
	invoke.invokeChaincode(peers, channelName , chaincodeName , fcn, args, username, orgname)
	.then(function(message) {
		logger.debug(message);
        response = message;
        if( message.status != 200 ){
            res.status(message.status)
        } else {
            res.status(201)
            var payload = JSON.parse(message.payload);
            logger.debug(payload)
            response.msg = payload.msg
            response.transId = payload.refId
            delete response.payload;
        }   
        delete response.status;
        callback(response);
	});
}

// called from /api/fund/interbank/transfer
// transfer funds between channels ( same bank )
function moveOutFund(req,res,callback){
    var response = {};
    var inputPayload = req.body;
    var sender = requestingBank
    var fromChannel = inputPayload.fromChannel;
    var toChannel = inputPayload.toChannel;
    var amount = inputPayload.amount == null ? inputPayload.transactionAmount : inputPayload.amount;
    var currency = config.default.currency == null ? inputPayload.currency : config.default.currency;
    var peers = helper.getPeersFromChannel(fromChannel);
    var chaincodeName = helper.chainCodeMapping['bilateral'];
    var fcn = "moveOutFund";
    var args = helper.stringify( [  sender , toChannel, amount, currency ] )
    var orgname = helper.bankOrgMapping[sender];

    async.waterfall([
        // 1. moveoutfund  -bilateral channel
        function(callback) {
            logger.debug("peers: %s, channelName: %s, chaincodeName: %s, fcn: %s, args: %s , sender: %s, orgname: %s", peers, fromChannel, chaincodeName, fcn, args, sender, orgname );
            invoke.invokeChaincode(peers, fromChannel , chaincodeName , fcn, args, sender, orgname)
            .then(function(message) {
                if(message.payload == null){
                    callback(message)
                } else {
                    callback(null,message.payload)
                }
            });
        },
        // 2. In funding channel MLCC -> createTransientFund(refID, sourceChannel)
        //====fundingchannel====
        function(moveOutFundID, callback) {
            var fundingChannelName = helper.multilateralChannels[0]; 
            var ctfchaincodeName = helper.chainCodeMapping['funding'];
            var ctffcn = "createTransientFund";
            var ctfargs = [ moveOutFundID , fromChannel ] 
            logger.debug("peers: %s, channelName: %s, chaincodeName: %s, fcn: %s, args: %s , sender: %s, orgname: %s", peers, fundingChannelName, ctfchaincodeName , ctffcn, ctfargs, sender, orgname );
            invoke.invokeChaincode(peers, fundingChannelName , ctfchaincodeName , ctffcn, ctfargs, sender, orgname)
            .then(function(message) {
                if(message.payload == null){
                    callback(message)
                } else {
                    var result = JSON.parse(message.payload)
                    logger.debug(result)
                    callback(null, moveOutFundID, result);
                }
            });
        },
        // 3. In B1-B3 BLCC -> moveInFund(refID)
        function(moveOutFundID, createTransientFundPayload, callback) {
            var inFundPeers = helper.channelMapping[toChannel];
            var inFundFcn = "moveInFund";
            var args = helper.stringify( [  moveOutFundID ] )
            var orgname = helper.bankOrgMapping[sender];
            logger.debug("peers: %s, channelName: %s, chaincodeName: %s, fcn: %s, args: %s , sender: %s, orgname: %s", inFundPeers, toChannel, chaincodeName, inFundFcn, args, sender, orgname );
            invoke.invokeChaincode(inFundPeers, toChannel , chaincodeName , inFundFcn, args, sender, orgname)
            .then(function(message) {
                if(message.payload == null){
                    callback(message)
                } else {
                    var result = JSON.parse(message.payload)
                    logger.debug(result)
                    var counterparty = helper.getCounterparty(helper.bankOrgMapping[sender], toChannel)
                    checkQueueAndSettle(sender,counterparty,function(callback){}) //no need to wait for this function.
                    callback(null, moveOutFundID, createTransientFundPayload, result);
                }                
            });
        }
    ], function (err, moveOutFundID, createTransientFundPayload, moveInFundPayload) {
        response.moveOutFundID = moveOutFundID;
        response.createTransientFundPayload = createTransientFundPayload;
        response.moveInFundPayload = moveInFundPayload;
        // result now equals 'done'
        callback(response)
    });


}

// --- README for Fund Suggestions ---
// This function will suggest the movement of funds between the channels to get a good outcome
// options avaliable are:
// 1. showtransactions: true/false 
// -   This option enables to view the dedicated/targeted transaction id's that can me settled after the fund transaction.
// 2. strategy: "worst-fit"
// -   This Option enables to select between 2 strategies that are in the code on (1-Oct)
//     - (default) best-fit it will match the channel with the best amount of liquidity to solve the debt for example
//         Chl A : 300
//         Chl B : 200
//         Debt is Chl C: 200, the suggestion will suggest Chl B as it fits the amount just right
//     - worst-fit it will match the channel with the best amount of liquidity to solve the debt for example
//         Chl A : 300
//         Chl B : 200
//         Debt is Chl C: 200, the suggestion will suggest Chl A with the most liquidty
function getFundSuggestions (req,res,callback){
    var response = {};
    //header options:
    // showtransactions : true/false
    // strategy : "worst-fit"

    //logical steps:
    //1. [C] query all channel balance
    //2. [C][C]query incomming & outgoing queue
    //3. every channel balance ( + / - ) = position
    //4. use best-fit/worst-fit algorithm 
    
    async.waterfall([ //1. [C] query all channel balance
        function(callback) {
            logger.debug("1. [C] query all channel balance")
            bankService.getAccDetails(req,res,function(result){
                helper.sort(result.channels,"amount")
                callback(null, result );
            })
        }, //2. [C][C]query incomming & outgoing queue
        function(AccDetails, callback) {
            async.parallel({
                incoming: function(callbackOfAsyncParallel) {
                    req.params.direction = "incoming"
                    queueService.getQueue(req,res,function(result){
                        logger.debug("2. [C]query incomming queue. Results: %j" , result)
                        callbackOfAsyncParallel(null, result);
                    });
                },
                outgoing: function(callbackOfAsyncParallel) {
                    req.params.direction = "outgoing"
                    queueService.getQueue(req,res,function(result){
                        logger.debug("2. [C]query outgoing queue. Results: %j" , result)
                        callbackOfAsyncParallel(null, result);
                    })
                }
            }, function(err, results) {
                callback(null, AccDetails, results.incoming, results.outgoing );
            })
        }, //3. every channel balance ( + / - ) = position
        function ( AccDetails, incoming, outgoing, callback ) {
            var balArray = [];
            
            async.eachSeries(AccDetails.channels, function(accChl, callback){
                var position = accChl.amount
                async.forEach(incoming, function(elem, fecallback){
                    if(accChl.channel == elem.channel){
                        position += elem.transactionAmount;
                    }
                });
                async.forEach(outgoing, function(elem, fecallback){
                    if(accChl.channel == elem.channel){
                        position -= elem.transactionAmount;
                    }
                })
                accChl.position = position;
                callback()
            })
            logger.debug(AccDetails)
            callback(null, AccDetails, incoming, outgoing, AccDetails.channels );

        }, //4. Do suggestions sort by position (3.) and avaliable funds from (1.)
        function( AccDetails, incoming, outgoing, balArray, callback ){
            makeSuggestions(req, balArray,outgoing,function(message,balArray){
                mapToChannelAndTransactions(message,AccDetails,balArray);
                var suggestionArray = summarizeTransactionsPerChannel(message,outgoing)
                callback(null, AccDetails, incoming, outgoing, balArray, suggestionArray );
            })
        }
    ], function ( err, AccDetails, incoming, outgoing, balArray, suggestionArray ) {
        response.getAccDetails = AccDetails;
        response.incoming = incoming;
        response.outgoing = outgoing;
        response.balArray = balArray;
        response.suggestionArray = suggestionArray;
        var suggestionArrayFiltered = [];
        var showTrans = req.headers.showtransactions == null ? false : true 
        if(showTrans){
            callback(response.suggestionArray)
        } else {
            var _ = require('lodash');
            suggestionArray.forEach(function(element){
                suggestionArrayFiltered.push(_.omit(element, ['Trx'] ))
            }) ; 
            callback(suggestionArrayFiltered)
        }
    });


	
}

function makeSuggestions(req, balArray, outgoing, callback){
    var negativeBucket = [];
    var positiveBucket = [];

     //positive bucket
     async.forEachSeries(balArray, function(element,callback){
         if(element.amount > 0 && element.position > 0 ){
            positiveBucket.push(element.amount)
             callback()
         } else (
             callback("end")
         )
     })

     //negative bucket
     var outgoingQ = outgoing;

     helper.sort(outgoingQ,"createTime")
     helper.sort(outgoingQ,"priority")

     async.forEachSeries(outgoingQ, function(element,callback){
        negativeBucket.push(element.transactionAmount)
         callback()
     })

     var visualizedFinalArray;


     if(req.headers.strategy == "worst-fit"){
         visualizedFinalArray = worstFitStrategy(positiveBucket,positiveBucket.length,negativeBucket,negativeBucket.length);
     } else { // default is "best-ft"
         visualizedFinalArray = bestFitStrategy(positiveBucket,positiveBucket.length,negativeBucket,negativeBucket.length);
     } 
    
     callback(visualizedFinalArray,outgoingQ)

}

// Method to allocate as per Best fit Algorithm
function bestFitStrategy(Accounts, noOfAccounts, queueditem, noOfitems ){
    var response = []
    var responseTemplate = {}
    // Stores block id of the block allocated to a queueditem
    var allocation = [];

    // Initially no block is assigned to any queueditem
    for (var i = 0; i < noOfitems; i++)
        allocation[i] = -1;

    // pick each Account and find suitable queue Transactions according to its size and assign to it
    for(var i = 0 ; i < noOfitems ; i++){
        // Find the best fit for the account
        var bestIdx = -1;
        for(var j = 0; j < noOfAccounts; j++ ){
            if(Accounts[j] >= queueditem[i]){
                if(bestIdx == -1)
                    bestIdx = j;
                else if (Accounts[bestIdx] > Accounts[j] ) 
                    bestIdx = j;
            }
        }

        // If we could find a Bank for the queueditem
        if (bestIdx != -1){
            // allocate queueditem j to p[i] process
            allocation[i] = bestIdx
            // Reduce available liquidity in this channel.
            Accounts[bestIdx] -= queueditem[i];
        }
    }

    for (var i = 0; i < noOfitems; i++)
    {
        
         if (allocation[i] != -1) {
             responseTemplate = { "fromAcc" : (allocation[i]), "toTrx": (i) , "amount": queueditem[i] }
         }
         else {
             responseTemplate = { "fromAcc" : "Not Allocated" , "toTrx": (i) , "amount": queueditem[i] }
         }
        

        if (queueditem[i] != 0 && responseTemplate.fromAcc != "Not Allocated" ){
            response.push(responseTemplate)
        } 

    }

    logger.debug(response)
    return response;

}

// Method to allocate as per worst fit Algorithm
function worstFitStrategy(Accounts, noOfAccounts, queueditem, noOfitems){
    var response = []
    var responseTemplate = {}
    // Stores block id of the block allocated to a queueditem
    var allocation = [];

    // Initially no block is assigned to any queueditem
    for (var i = 0; i < noOfitems; i++)
        allocation[i] = -1;

    // pick each Account and find suitable queue Transactions according to its size and assign to it
    for(var i = 0 ; i < noOfitems ; i++){
        // Find the best fit for the account
        var wstIdx = -1;
        for(var j = 0; j < noOfAccounts; j++ ){
            if(Accounts[j] >= queueditem[i]){
                if(wstIdx == -1)
                    wstIdx = j;
                else if (Accounts[wstIdx] < Accounts[j] ) 
                    wstIdx = j;
            }
        }

        // If we could find a Bank for the queueditem
        if (wstIdx != -1){
            // allocate queueditem j to p[i] process
            allocation[i] = wstIdx
            // Reduce available liquidity in this channel.
            Accounts[wstIdx] -= queueditem[i];
        }
    }

    for (var i = 0; i < noOfitems; i++)
    {
          if (allocation[i] != -1) {
              responseTemplate = { "fromAcc" : (allocation[i]), "toTrx": (i) , "amount": queueditem[i] }
          }
          else {
              responseTemplate = { "fromAcc" : "Not Allocated" , "toTrx": (i) , "amount": queueditem[i] }
          }


        if (queueditem[i] != 0 && responseTemplate.fromAcc != "Not Allocated" ){
            response.push(responseTemplate)
        } 

    }

    logger.debug()
    return response;
}

function mapToChannelAndTransactions(visualizedFinalArray,AccDetails,outgoing){
    logger.debug("maptochannel, %j, %j , %s",visualizedFinalArray, AccDetails, outgoing)
    for(var i = 0; i < visualizedFinalArray.length ; i++){
        visualizedFinalArray[i].fromAcc = AccDetails.channels[visualizedFinalArray[i].fromAcc].channel
        visualizedFinalArray[i].toTrx = outgoing[visualizedFinalArray[i].toTrx].transId
    }
    logger.debug(visualizedFinalArray)
    return visualizedFinalArray;
}

function summarizeTransactionsPerChannel(visualizedFinalArray,outgoing){
    var response = [];
    var responseTemplate = {};
    logger.debug("summarizeTransactionsPerChannel")
    logger.debug(visualizedFinalArray)
    logger.debug(outgoing)

    //Add ToChannel
    for(var i = 0; i < visualizedFinalArray.length; i++ ){
        async.each(outgoing, function(elem,callback){
            if(elem.transId == visualizedFinalArray[i].toTrx){
                visualizedFinalArray[i].toChl = elem.channel
            }
        })
    }

    //Summarize the Array
    logger.debug(visualizedFinalArray)
    //create a new array with the primarykey as tochannel.
    var fromChannelsArray = [];
    var toChannelsArray = [];
    var suggestionArray = [];
    var temp = []
    for(var i = 0; i < visualizedFinalArray.length ; i++){
        if ( !fromChannelsArray.includes(visualizedFinalArray[i].fromAcc) ) {
            if ( visualizedFinalArray[i].toChl == visualizedFinalArray[i].fromAcc){
                temp.push("trigger self-settlement " + visualizedFinalArray[i].toChl )
                response.note = temp
            } else if ( !toChannelsArray.includes(visualizedFinalArray[i].toChl) ) {
                //new record
                fromChannelsArray.push(visualizedFinalArray[i].fromAcc)
                toChannelsArray.push(visualizedFinalArray[i].toChl)
                responseTemplate = {
                    "fromChl": visualizedFinalArray[i].fromAcc,
                    "toChl": visualizedFinalArray[i].toChl,
                    "amount": visualizedFinalArray[i].amount,
                    "Trx": [ visualizedFinalArray[i].toTrx ]
                }
                response.push(responseTemplate)
            } else {
                //new record
                fromChannelsArray.push(visualizedFinalArray[i].fromAcc)
                responseTemplate = {
                    "fromChl": visualizedFinalArray[i].fromAcc,
                    "toChl": visualizedFinalArray[i].toChl,
                    "amount": visualizedFinalArray[i].amount,
                    "Trx": [ visualizedFinalArray[i].toTrx ]
                }
                response.push(responseTemplate)
            }

        } else if ( fromChannelsArray.includes(visualizedFinalArray[i].fromAcc) && toChannelsArray.includes(visualizedFinalArray[i].toChl) ) {
            for (var ind = 0; ind < response.length ; ind++){
                if(visualizedFinalArray[i].fromAcc == response[ind].fromChl && visualizedFinalArray[i].toChl == response[ind].toChl){
                    response[ind].Trx.push(visualizedFinalArray[i].toTrx);
                    response[ind].amount += visualizedFinalArray[i].amount;
                }
            }
        } else if ( fromChannelsArray.includes(visualizedFinalArray[i].fromAcc) && !toChannelsArray.includes(visualizedFinalArray[i].toChl) ) {
            toChannelsArray.push(visualizedFinalArray[i].toChl)
            responseTemplate = {
                "fromChl": visualizedFinalArray[i].fromAcc,
                "toChl": visualizedFinalArray[i].toChl,
                "amount": visualizedFinalArray[i].amount,
                "Trx": [ visualizedFinalArray[i].toTrx ]
            }
            response.push(responseTemplate)
        }

    }

    return response;
}
// --- End of Fund Suggestions ---

// =========================================== Regulator Functions ===========================================

//to add funds during netting
function nettingAdd (req, res, callback){
	var inputPayload = req.body;
	var channel = inputPayload.channel;
	var bankName = inputPayload.bankName;
	var chaincodeName = helper.chainCodeMapping['bilateral'];
	if (!helper.validateBankInChannel(bankName,channel)){
		res.status(400)
		callback({ error : util.format('%s / %s not found', bankName, channel ) });
	} else {
		var response = {};
		var amount = inputPayload.amount == null ? inputPayload.transactionAmount : inputPayload.amount;
		var currency = inputPayload.currency;
		var masUsername = helper.getRUsername();
        var masOrgName = helper.getOrg(masUsername);
        var peers = helper.getPeersFromChannel(channel);
		var args = [ bankName, currency, amount ];
		invoke.invokeChaincode(peers, channel , chaincodeName , "nettingAdd", helper.stringify(args), masUsername, masOrgName)
		.then(function(message) {
			response = message;
			logger.debug(message);
			if( message.status != 200 ){
				res.status(message.status)
			} 
			callback(response);
		});
	}
}

// to minus funds during netting
function nettingSubtract (req, res, callback){
	var inputPayload = req.body;
	var channel = inputPayload.channel;
	var bankName = inputPayload.bankName;
	var chaincodeName = helper.chainCodeMapping['bilateral'];
	if (!helper.validateBankInChannel(bankName,channel)){
		res.status(400)
		callback({ error : util.format('%s / %s not found', bankName, channel ) });
	} else {
		var response = {};
		var amount = inputPayload.amount == null ? inputPayload.transactionAmount : inputPayload.amount;
		var currency = inputPayload.currency;
		var masUsername = helper.getRUsername();
		var masOrgName = helper.getOrg(masUsername);
		var peers = helper.getPeersFromChannel(channel);
		var args = [ bankName, currency, amount ];
		invoke.invokeChaincode(peers, channel , chaincodeName , "nettingSubtract", helper.stringify(args), masUsername, masOrgName)
		.then(function(message) {
			response = message;
			logger.debug(message);
			if( message.status != 200 ){
				res.status(message.status)
			} 
			callback(response);
		});
	}
}

// called from /api/fund/pledge
// pledge fund to bank
function pledgeFund (req, res, callback){
	var inputPayload = req.body;
	var bankName = inputPayload.receiver;
	var channel = inputPayload.channel;
	var chaincodeName = helper.chainCodeMapping['bilateral'];
	if (!helper.validateBankInChannel(bankName,channel)){
		res.status(400)
		callback({ error : util.format('%s / %s not found', bankName, channel ) });
	} else {
		var response = {};
		var amount = inputPayload.amount == null ? inputPayload.transactionAmount : inputPayload.amount;
		var currency = config.default.currency == null ? inputPayload.currency : config.default.currency;
		var masUsername = helper.getRUsername();
		var masOrgName = helper.getOrg(masUsername);
		var peers = helper.getPeersFromChannel(channel);
		var fcn = 'pledgeFund';
        var args = [ bankName, currency, amount ];
        logger.warn("peers: %s, channel: %s, chaincodeName: %s, fcn: %s, args: %s, username: %s, orgname: %s", peers, channel , chaincodeName , fcn, helper.stringify(args), masUsername, masOrgName)
		invoke.invokeChaincode(peers, channel , chaincodeName , fcn, helper.stringify(args), masUsername, masOrgName)
		.then(function(message) {
			response = message;
			logger.debug(message);
			if( message.status != 200 ){
				res.status(message.status)
				delete response.status;
			} else {
				res.status(201)
				var counterparty = helper.getCounterparty(helper.bankOrgMapping[bankName], channel)
				fundService.checkQueueAndSettle(bankName,counterparty,function(callback){}) //no need to wait for this function.
			}
			callback(response);
		});
	}
}

// called from /api/fund/redeem
// redeem funds from bank
function redeemFund (req, res, callback){
	var inputPayload = req.body;
	var channel = inputPayload.channel;
	var bankName = inputPayload.sender;
	var chaincodeName = helper.chainCodeMapping['bilateral'];
	if (!helper.validateBankInChannel(bankName,channel)){
		res.status(400)
		callback({ error : util.format('%s / %s not found', bankName, channel ) });
	} else {
		var response = {};
		var amount = inputPayload.amount == null ? inputPayload.transactionAmount : inputPayload.amount;
        var currency = config.default.currency == null ? inputPayload.currency : config.default.currency;
		var peers = helper.getPeersFromChannel(channel);
		var masUsername = helper.getRUsername();
		var masOrgName = helper.getOrg(masUsername);
		var args = [ bankName, currency, amount ];
		invoke.invokeChaincode(peers, channel , chaincodeName , "redeemFund", helper.stringify(args), masUsername, masOrgName)
		.then(function(message) {
			response = message;
			logger.debug(message);
			if( message.status != 200 ){
				res.status(message.status)
				delete response.status;
			} else {
                res.status(201)
                response.channel = channel;
                response.transactionAmount = amount;
                response.sender = bankName;
            }
			callback(response);
		});
	}
}

// checking if there are enough liquidity to solve the queue, will be called again in several functions ( pledge )
function checkQueueAndSettle (sender,receiver,callback){
    logger.debug("checkQueueAndSettle, sender: %s , receiver: %s", sender,receiver)
    var response = {};
    var channels = [];
    var orgname = helper.getOrg(sender)
    var targetFundOrg = helper.getOrg(receiver)
		var channelName = channelName = helper.getChannel(sender,receiver)
		var chaincodeName = helper.chainCodeMapping['bilateral'];
    var peers = helper.getPeers(sender,receiver)
    var fcn = "checkQueueAndSettle";
    var args = helper.stringify([sender]);
    if(helper.regulators.includes(helper.whoami())){
     sender = helper.whoami();
     orgname = helper.getOrg(sender);
     } //to change sender to MAS and orgname as MAS.
    invoke.invokeChaincode(peers, channelName , chaincodeName , fcn , args , sender, orgname)
     .then(function(message){
         logger.debug("checkQueueAndSettle : %j", message);
         response = message ;
         callback(response);
     })
}

exports.moveOutFund = moveOutFund;
exports.checkQueueAndSettle = checkQueueAndSettle;
exports.transferfunds = transferfunds;
exports.pledgeFund = pledgeFund;
exports.redeemFund = redeemFund;
exports.nettingAdd = nettingAdd;
exports.nettingSubtract = nettingSubtract;
exports.getFundSuggestions = getFundSuggestions;
exports.bestFitStrategy = bestFitStrategy;
exports.worstFitStrategy = worstFitStrategy;