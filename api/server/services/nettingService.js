var query = require('../utils/query.js');
var invoke = require('../utils/invoke-transaction.js');
var helper = require('../utils/helper.js');
var async = require('async');
var logger = helper.getLogger('nettingService');
var chaincodeName = helper.chainCodeMapping.bilateral;
var bankService = require('../services/bankService.js');
var fundService = require('../services/fundService.js');
var request = require('request');
var config = require('../config.json');
const requestingBank = helper.whoami()
var intervalID;
var counter = 0;

//==================== CRON JOBS ====================
var autoResolveToggle = function () {
	if(helper.regulators.includes(requestingBank)){
		//regulator
		request.get(config.nettingurl,function(err,res,body){
			if(res.statusCode === 200 ){
				var body = JSON.parse(body);
				logger.debug("%j" , body.status);
				if(body.status === "ACHIEVED"){
					logger.debug("\x1b[35mAuto-Joining-Netting-Cycle\x1b[0m as %s", requestingBank )
					request.post(
						config.settleNettingUrl,
						function (error, response, body) {
							if (!error && response.statusCode == 200) {
								logger.debug("Settling the Cycle: %j", body);
							}
						}
					);
				} else if (body.status === "EXPIRED" || body.status === "INVALID"){
					invoke.invokeChaincode(helper.getAllpeers(), helper.multilateralChannels[1] , helper.chainCodeMapping['netting'] , "failOngoingMLNetting", [], requestingBank, helper.bankOrgMapping[requestingBank])
					.then(function(message){
						logger.debug(message);
						//expire/fail - unfreeze
						var channelList = bankService.getListOfChannelsFromNettingCycle(body);
						bankService.unfreezeTransactionsByList(channelList, function(response){
							// res.status(500).send(err);
						});
					})
				}
			}
		});
		logger.debug('\x1b[35mRegulator polling, %s\x1b[0m', ++counter);
	}
}

//normal banks
var autoParticipate = function () {
	request.get(config.nettingurl,function(err,res,body){
		if(res.statusCode === 200 ){
			var body = JSON.parse(body);
			logger.debug("%j" , body.status);
			if(body.status === "ONGOING"){
				logger.debug("\x1b[35mAuto-Joining-Netting-Cycle\x1b[0m as %s", requestingBank )
				request.post(
					config.joinNettingUrl,
					{ json: { sender: requestingBank } },
					function (error, response, body) {
						if (!error && response.statusCode == 200) {
							logger.debug("Successfully joined Netting Cycle: %j", body)
						}
					}
				);
			} else {
				callToggle();
			}
		}
	  });
	var req = {};
	logger.debug('\x1b[41mpolling, %s\x1b[0m', ++counter);
	return true;
}

function callToggle(flag){
	var options = {  
		url: config.toggleNettingUrl,
		headers: {
			'flag': flag
		}
	};
	
	request.get(options, function (error, response, body) {
	  if (error) throw new Error(error);
		logger.debug(body);
	});
}

function intervalManager(flag, autoParticipate, time) {
	counter = 0;
	if(flag)
		intervalID =  setInterval(autoParticipate, time);
  	else
		clearInterval(intervalID); 
 }
//==================== CRON JOBS END ====================


// called from /api/netting/status
// getting netting cycle
function getNettingStatus(req,res,callback){
	// http://localhost:8080/channels/nettingchannel/chaincodes/nettingchannel_cc?username=CHASSGSG&orgname=org4&peer=peer0&fcn=getNettingCycle&args=%5B%22%22%5D
	var bankName = requestingBank;
	var args = [];
	var fcn = "queryOngoingMLNetting";
	var orgname = helper.getOrg(bankName)
	var channel = helper.multilateralChannels[1];
	var chaincodeName = helper.chainCodeMapping['netting'];
	query.queryChaincode("peer0", channel, chaincodeName, args, fcn, bankName, orgname)
	.then(function(message) {
		callback(JSON.parse(message));
	})
}

// used during netting
function queryNettableQueue(req,res,callback){
	var bankName =  helper.whoami()
	var direction = req.params.direction;
	var response = {};
	var channels = [];
	var chaincodeName = helper.chainCodeMapping['bilateral'];
	var orgname = helper.getOrg(bankName)
	var peers = helper.ORGS[orgname].orgPeers;
	var args = [];
	var fcn;
	if(direction == 'incoming'){
		fcn = "getNettableIncomingQueue";
		args = [bankName];
	}else {
		fcn = "getNettableOutgoingQueue";
		args = [bankName];
	}

	var total = 0;
	async.forEach(helper.channelList(bankName), function(channel,functioncallback) {
		if( helper.multilateralChannels.includes(channel)){
			functioncallback();
		} else {
			query.queryChaincode("peer0", channel, chaincodeName, args, fcn, bankName, orgname)
			.then(function(message) {
				message = JSON.parse(message);
				for(var i = 0; i < message.length; i++) {
					total += message[i].amount;
				};
				var placeHolder = {};
				placeHolder[channel] = message
				// logger.debug(channels);
				channels.push(placeHolder);
				functioncallback();
			})
		}
	},function(err){
		// logger.debug('iterating done');
		response.total = total;
		response.channels = channels;
		callback(response);
	  });
}

// called from /api/netting
// main function to create/participate into a netting cycle
function runNetting (req,res){
	var nettableQueue = {}
	var calculatabletotal = 0;
	var reqoutgoing = req;
	var reqincoming = req;
	var response = {};
	var sender = requestingBank
	var orgname = helper.getOrg(sender);
	var chaincodeName = helper.chainCodeMapping['netting'];
	var channel = helper.multilateralChannels[1];
	var peers = helper.getAllpeers();
	var args = [];
	var participant; //check if user is participating or initiating flag
	
	// 1. queryMLNettingCycle
	// 2. query incoming queue
	// 3. query outgoing queue
	// 4. get account balance
	// 5. get non-nettable transactions ( if participant )
	// 6. get nettable transactions 
	// 7. total incomming + balance
	// 8. participant netting, remove incomming transactions that is inside the non-nettable list
	// 9. minus outgoing from top to bottom 1 by 1.
	// 10. all nettable (able to minus transactions) will be placed in []nettable queue
	// 11. all not-nettable transactions will be placed in []notnettable queue
	// 12. get calculatabletotal (incoming queue total - out going queue total)
	// 13. send fcn to inititiate

    logger.debug("start runNetting")
	async.waterfall([
		function(callback){
			// 1. queryMLNettingCycle
			getNettingStatus(req,res,function(response){
				if(response.status == "ACHIEVED"){
					callToggle(false);
					logger.error({error: "status is "+response.status});
					return callback({error: "status is "+response.status});
				} else if (response.status == "ONGOING"){
					participant = true;
					// callToggle(true);
					callback(null, response.cycleID );
				} else if( helper.regulators.includes(sender) && (response.status == "EXPIRED" || response.status == "FAILED") ) {
					invoke.invokeChaincode(helper.getAllpeers(), helper.multilateralChannels[1] , helper.chainCodeMapping['netting'] , "failOngoingMLNetting", [], requestingBank, helper.bankOrgMapping[requestingBank])
					.then(function(message){
						logger.debug(message);
						//expire/fail - unfreeze
						var channelList = bankService.getListOfChannelsFromNettingCycle(response);
						bankService.unfreezeTransactionsByList(channelList, function(response){
						// res.status(500).send(err);
						});
					});
				} else
					{ //Create Cycle
					callToggle(true);
					callback(null, "" );
				}
			});
		},
		function(cycleID, callback) {
			async.parallel({
				// 2. query incoming queue
				incomming: function(callbackOfAsyncParallel) {
					reqincoming.params.direction = "incoming";
					queryNettableQueue(reqincoming,res,function(response){
						logger.debug("incommingQueue %j",response);
						callbackOfAsyncParallel(null,response);
					})
				},
				// 3. query outgoing queue
				outgoing: function(callbackOfAsyncParallel) {
					reqoutgoing.params.direction = "outgoing";
					queryNettableQueue(reqoutgoing,res,function(response){
						logger.debug("outgoingQueue %j",response);
						callbackOfAsyncParallel(null,response);
					})
				},
				// 4. get account balance
				totalbal: function(callbackOfAsyncParallel) {
					bankService.getAccDetails(req,res,function(response){
						logger.debug("totalbal: %s",response.balance);
						callbackOfAsyncParallel(null,response.balance);
					})
				},
				// 5. get non-nettable transactions ( if participant )
				nonNettableList: function(callbackOfAsyncParallel) {
					if(participant){
						getNonNettableTxList(req,res,function(response){
							logger.debug("nonNettableList: %s",response);
							callbackOfAsyncParallel(null,response);
						})
					} else {
						callbackOfAsyncParallel(null,[]);
					}
				}
			}, function(err, results) {
				// 6. get nettable transactions 
				nettableQueue.currentbal = results.totalbal;
				nettableQueue.incoming = results.incomming;
				nettableQueue.outgoing = results.outgoing;
				nettableQueue.nonNettableList = results.nonNettableList;
				callback(null,cycleID,nettableQueue);
			})
		},
		function(cycleID, nettableQueue, callback) {
			response.participant = participant;
			
			async.waterfall([
				function(functionCallback) {
					// 7. total incomming + balance
					var outgoingarray = helper.collapseAndSort(nettableQueue.outgoing);
					var incomming = helper.collapseAndSort(nettableQueue.incoming);
					functionCallback(null, outgoingarray ,incomming );
				},
				function(outgoingarray ,incomming, functionCallback) {
					// 8. participant remove incomming and place in non nettable first
					var nonnettableincomming = [];
					var totalbal;
					splitTransactions(nettableQueue.incoming,nettableQueue.nonNettableList,function(result){
						nettableQueue.incoming.total = result.total;
						totalbal = nettableQueue.currentbal + nettableQueue.incoming.total;
						nonnettableincomming = result.nonnettable;
						incomming = result.NettableArray;
					});
					functionCallback(null, outgoingarray ,incomming, totalbal ,  nonnettableincomming );
				}
			], function (err, outgoingarray ,incomming,totalbal, nonnettableincomming) {
				// result now equals 'done'
				var balance = totalbal;
				var nettable = [];
				var nonnettable = outgoingarray.slice();
				response.outgoingarray = outgoingarray;
				Array.prototype.push.apply(nettable,incomming);
				// 9. minus outgoing from top to bottom 1 by 1.		
				async.forEachSeries(outgoingarray , function(element,loopcallback) {
					balance -= element.amount;
					if(balance >= 0){
						// 10. all nettable (able to minus transactions) will be placed in []nettable queue
						nettable.push(element);
						nonnettable.splice(0,1);
					}else {
						balance += element.amount;
						return loopcallback({ data: 'hi'}); // stop
					}
					loopcallback();
				},function(result){
					// 11. all not-nettable transactions will be placed in []notnettable queue
					response.nettable = nettable;
					response.nonnettable = nonnettable.concat(nonnettableincomming);
					// 12. get calculatabletotal (incoming queue total - out going queue total)
					calculatabletotal = calcNettingBalance(nettable,sender)
					logger.debug("creating input format for fcn")
					
					args.push(cycleID.toString());
					args.push(sender);
					args.push(JSON.stringify(singleOutRefIDArray(response.nettable)));
					args.push(JSON.stringify(singleOutRefIDArray(response.nonnettable)));
					args.push(calculatabletotal);
					response.args = args;
					response.orgname = orgname;
					response.peers = peers;
					callback(null, response);
					
				  });
			});
		}
	], function (err, result) {
        // 13. send fcn to inititiate
		if(err == null ){ 
			invoke.invokeChaincode(peers, channel , chaincodeName , "conductMLNetting", helper.stringify( args ), sender, orgname)
			.then(function(message){
				res.send(result);
			})
		} else {
			res.send(err);
		}

	});

}

// =========================================== Regulator Functions ===========================================

// called from /api/netting/settle
// settle the netting when the cycle = "settled"
function settleLSM(req,res,callback){
	var sender = requestingBank
	// 1. queryMLNettingCycle
	// 2. read-every-account in the list
	// 3. if net-value is negative and total-bal is less than this net-value, fail it straight away
	// 4. deduct/add all bi-channels
	// 5. settle all transactions
	// 6. settle netting cycle
	var response = {};
	var inputPayload = req.body;
	var orgname = helper.getOrg(sender)
	var args = [];
	var peers = helper.getAllpeers();

	async.waterfall([
		function(callback) {
            // 1. queryMLNettingCycle
            logger.info("1. queryMLNettingCycle")
			req.params.requestingBank = req.body.sender;
			getNettingStatus(req,res,function(response){
				callback(null, response );
			});
			return false;
		},
		function(netstatus , callback) {
			var netting = {};
			var keys = Object.keys(netstatus.bankRequests);
			var last = keys[keys.length-1];
			logger.info(netstatus.status)
			response.netting = netting;
			//Check Netting Cycle.
			if (netstatus.status === "EXPIRED" || netstatus.status === "INVALID"){
				invoke.invokeChaincode(helper.getAllpeers(), helper.multilateralChannels[1] , helper.chainCodeMapping['netting'] , "failOngoingMLNetting", [], requestingBank, helper.bankOrgMapping[requestingBank])
				.then(function(message){
					logger.debug(message);
					//expire/fail - unfreeze
					var channelList = bankService.getListOfChannelsFromNettingCycle(netstatus);
					bankService.unfreezeTransactionsByList(channelList, function(response){
						callback({"status":200, error: "Netting Cycle Status: "+ netstatus.status + " detected. Failed the Cycle." });
					});
				});
			} else if(netstatus.status !== "ACHIEVED"){
				callback({"status":403, error: "Netting Cycle Status is not ACHIEVED" });
			} else {
				// 2. read-every-account in the list
				logger.info("2. read-every-account in the list")
				async.each(netstatus.bankRequests, function(key,functioncallback) {
					var value = key.bankID;
					req.params.requestingBank = value;
					bankService.getAccDetails(req,res,function(result){
						response[value] = result.channels;
						response.netting[value] = netstatus.bankRequests[value].netValue;
						logger.debug("netstatus: %s, value: %s == result: %s, value %s", netstatus.bankRequests[value].bankID , netstatus.bankRequests[value].netValue , result.channels[0].accountID , result.balance );
						// 3. if net-value is negative and total-bal is less than this net-value, fail it straight away
						logger.info("3. if net-value is negative and total-bal is less than this net-value, fail it straight away.")
						if(helper.regulators.includes(value)){ //regulators should not have a bank account.
							functioncallback({error: "Regulator found in participation", "account": value });
						}
						if( netstatus.bankRequests[value].netValue < 0 && (result.balance < netstatus.bankRequests[value].netValue * -1 )){
							functioncallback({error: "Cycle Failed! accounts does not meet the criteria(s)", account: result.channels[0].accountID });
						}
						functioncallback();
					},helper.whoami());	
				},function(err){
					if (err){
						//need to unfreeze
						logger.error(err);
						args = [ ];
						var chaincodeName = helper.chainCodeMapping['netting'];
						var channel = helper.multilateralChannels[1];
						invoke.invokeChaincode(peers, channel , chaincodeName , "failOngoingMLNetting", helper.stringify( args ), sender, orgname)
						.then(function(message){
							logger.debug(message);
							//expire/fail - unfreeze
							var channelList = bankService.getListOfChannelsFromNettingCycle(netstatus);
							bankService.unfreezeTransactionsByList(channelList, function(response){
								res.status(500).send(err);
							});
						});
						callback(err);
					} else {
						callback(err, netstatus, response) ;
					}
				});
			}
		},
		function(netstatus, lstr, callback) {
			var x = {};
			// 4. deduct/add all bi-channels.
			logger.info("4. deduct/add all bi-channels");
			async.eachOfSeries(lstr.netting, function(item,key,functioncallback){
				logger.debug("key: %s , item: %s" , key, item);
				if (item < 0) {
					logger.debug("nettingSubtract %j", key);
					var tempchannel = helper.sort(lstr[key],"amount");
					x.redeem = tempchannel;
					item = Math.abs(item); //4.2 bug fix. item is negative. key.amount will always be more than item.
					logger.debug("redeem payload: %j , total negative value: %s",x.redeem, item);
					async.eachSeries(tempchannel, function(key, loopcallback){
						//redeem
						if(key.amount >= item){
							var tempreq = {
								"bankName" : key.accountID ,
								"channel" : key.channel ,
								"amount": Math.abs(item),
								"currency": key.currency
							}
							var treq = {};
							treq.body = tempreq;
							logger.debug(treq.body);
							fundService.nettingSubtract(treq,res,function(response){
								if(response.status != 200){									
									callback(response)
								}
								loopcallback("done")
							})
						} else {
							item -= Math.abs(key.amount);
							var tempreq = {
								"bankName" : key.accountID ,
								"channel" : key.channel ,
								"amount": Math.abs(key.amount),
								"currency": key.currency
							}
							var treq = {};
							treq.body = tempreq;
							logger.debug(treq.body);
							fundService.nettingSubtract(treq,res,function(response){
								if(response.status != 200){
									callback(response)
								}
								loopcallback();
							})
						}
					}, function(err){
						//do not throw the err
						logger.info(err);
						functioncallback();
					})
				} else if (item > 0) {
					logger.debug("nettingAdd %j",key);
					var tempchannel = helper.sort(lstr[key],"amount",true)
					x.pledge = tempchannel;
					logger.debug(x.pledge);
					//pledge all into first channel
					var tempreq = {
						"bankName" : tempchannel[0].accountID ,
						"channel" : tempchannel[0].channel ,
						"amount": item,
						"currency": tempchannel[0].currency
					}
					var treq = {};
					treq.body = tempreq;
					logger.debug(treq.body);
					fundService.nettingAdd(treq,res,function(response){
						if(response.status != 200){
							callback(response)
						}
						functioncallback();
					});
				} else { // item == 0
					functioncallback(); // do nothing
				}
			}, function(err){
				callback(null, netstatus, lstr, x );
			})
		},
		function(netstatus, lstr, transactions, callback) {
			logger.info("5. settling all transactions")
			// 5. settle all transactions
			var listofchannels = [];
			var transactionBanksList = {};

      async.forEach(netstatus.bankRequests, function(bankRequest, bankReqCallback){
        bankRequest.nettableList.forEach(function(tx){
        	if (transactionBanksList[tx]) {
						transactionBanksList[tx].push(bankRequest.bankID);
        	} else {
        		transactionBanksList[tx] = [];
        		transactionBanksList[tx].push(bankRequest.bankID);
        	}
        });
      });
      logger.debug("Transaction-banks list: %s", transactionBanksList);

			var channelTxList = {};

			async.forEachOf(transactionBanksList, function(txBanks, tx, txCallback){
				async.forEachOf(helper.channelBankMapping, function(channelBanks, channel, chCallback) {
					if (channelBanks.includes(txBanks[0]) && channelBanks.includes(txBanks[1])) {
						if (channelTxList[channel]) {
							channelTxList[channel].push(tx);
	        	} else {
	        		channelTxList[channel] = [];
	        		channelTxList[channel].push(tx);
	        	}
					}
				});
			});
			logger.debug("Channel-transactions list: %s", channelTxList);

			async.forEachOfSeries(channelTxList, function(item,channel,eachseriescallback){
				var tempsettlemlreq = {
						"bankName": helper.whoami(),
						"channel": channel,
						"transactionList": helper.stringify(item)}
				var tempreq = req;
				tempreq.body = tempsettlemlreq;
				logger.debug(tempsettlemlreq);

				settleMLNettingInstructions(tempreq,res,function(msg){
					logger.debug("settleMLNettingInstructions: %j", msg);
					eachseriescallback();
				})
			}, function(message){
				logger.debug("---settleMLNettingInstructions.completed---")
				callback(null, netstatus, lstr, transactions)
			});

		}
	], function (err, netstatus, lstr, transactions) {
		if(err){
			logger.warn(err)
			res.status(err.status)
			callback(err);
		} else {
			// result now equals 'done'
			args = [ ];
			var result = {};
			var chaincodeName = helper.chainCodeMapping['netting'];
			var channel = helper.multilateralChannels[1];
			invoke.invokeChaincode(peers, channel , chaincodeName , "settleOngoingMLNetting", helper.stringify( args ), sender, orgname)
			.then(function(message){
				logger.debug("settleOngoingMLNetting: %s", message)
				result.requester = sender;
				result.nettingresponse = message;
				result.cycleobtained = netstatus;
				// result.accounts = lstr;
				// result.transactions = transactions;
				logger.debug(result)
				callback(result);
			})
		}
	});
	
}


// -- Private helper methods --

function splitTransactions(NettableArray,excludeArray,callback){
	// NOT GENERIC USAGE
	// if  incoming txid == non nettablelist txid
	// move trx to [] nonnettable
	// cut from incoming
	// minus incoming.total value

	var response = {};
	response.excludeArray = excludeArray;
	response.total = NettableArray.total;
	NettableArray = helper.collapseAndSort(NettableArray);
	

	var nonnettable = []
	var original = NettableArray.slice();

	if(NettableArray.length <= 0 || excludeArray == null){
		response.nonnettable = nonnettable;
		response.NettableArray = NettableArray;
		response.original = original;
		callback(response);
	} else {
		var i=NettableArray.length;
		while (i--) {
			if(excludeArray.indexOf(NettableArray[i].refID)!=-1){
				nonnettable.push(NettableArray[i]);
				response.total -= NettableArray[i].amount;
				NettableArray.splice(i,1);
			}
		}
		response.nonnettable = nonnettable;
		response.NettableArray = NettableArray;
		response.original = original;
		callback(response);
	}

}

function settleMLNettingInstructions(req, res, callback){	
	var response = {};
	var inputPayload = req.body;
	var bankName = inputPayload.bankName;
	var channel = inputPayload.channel;
	var chaincodeName = helper.chainCodeMapping['bilateral'];
	var orgname = helper.bankOrgMapping[bankName];
	var peers =  helper.channelMapping[channel];
	var fcn = 'settleMLNettingInstructions';
	var args = helper.stringify ( [ JSON.stringify(inputPayload.transactionList) ] );
	callToggle(false);
	logger.debug("In settleMLNettingInstructions: %s", req.body);
	invoke.invokeChaincode(peers, channel, chaincodeName, fcn, helper.stringify(args), bankName, orgname)
	.then(function(message) {
		logger.debug(message);
		response.transactionid = message;
		callback(response);
	});
}

function getNonNettableTxList(req,res,callback){
	var inputPayload = req.body;
	var chaincodeName = helper.chainCodeMapping['netting'];
	var channel = helper.multilateralChannels[1];
	var orgname = helper.bankOrgMapping[requestingBank];
	var fcn = "getNonNettableTxList";
	var args = [];
	logger.debug("[peer0] channel: %s, chaincodeName: %s, args: %s, fcn: %s, sender: %s, orgname : %s" , channel, chaincodeName, args, fcn, requestingBank, orgname);
	query.queryChaincode("peer0", channel, chaincodeName, args, fcn, requestingBank, orgname)
	.then(function(response) {
		callback(JSON.parse(response));
	})
}

function calcNettingBalance (nettableArray,sender,callback){
	var balance = 0;
	for(var i = 0; i< nettableArray.length; i++){
		if(sender == nettableArray[i].sender){
			balance -= nettableArray[i].amount 
		} else {
			balance += nettableArray[i].amount
		}
	}
	return balance;
}

function singleOutRefIDArray (array){
	var responsearray = [];
	for(var x = 0; x < array.length; x++){
		responsearray.push(array[x].refID);
	}
	return responsearray;
}

exports.getNettingStatus = getNettingStatus;
exports.queryNettableQueue = queryNettableQueue;
exports.runNetting = runNetting;
exports.getNonNettableTxList = getNonNettableTxList;
exports.settleMLNettingInstructions = settleMLNettingInstructions;
exports.settleLSM = settleLSM;
exports.intervalManager = intervalManager;
exports.autoResolveToggle = autoResolveToggle;
exports.autoParticipate = autoParticipate;