var query = require('../utils/query.js');
var invoke = require('../utils/invoke-transaction.js');
var helper = require('../utils/helper.js');
var util = require('util');
var async = require('async');
var logger = helper.getLogger('bankService');
var config = require('../config.json');
var request = require('request');
var QueuedTransaction = require('../models/queuedtransaction.js')
var Transaction = require('../models/transaction.js')
var config = require('../config.json');
var fundService = require('./fundService.js');
var nettingService = require('./nettingService.js');
var chaincodeName = helper.chainCodeMapping['bilateral'];
const requestingBank = helper.whoami()


//called from /bank/transactions 
//to get transaction history of the bank
function getTransactions (req, res, callback){
    var bankName = requestingBank;
	var response = {};
    var channels = [];
    var orgname = helper.getOrg(bankName);
	var fcn = "getTransactionHistory";
    var args = [bankName];
    var transactionList = [];
	
	async.forEach(helper.channelList(bankName), function(channelName,functioncallback) {
		if( helper.multilateralChannels.includes(channelName)){
			functioncallback();
		} else {
			logger.debug(channelName + ":" + chaincodeName + ":" + fcn + ":" + args);
			query.queryChaincode("peer0", channelName, chaincodeName, args, fcn, bankName, orgname)
			.then(function(message) {
        if( err = helper.checkError(message)) callback(err);
        message = JSON.parse(message);
        async.forEach(message, function(elem,feocallback){
          if( typeof elem === 'string' ) {
            feocallback()
          } else {
            async.forEach(elem, function(info, fecallback){
              if(info.refID != null){
                var trans = new Transaction(info, channelName)
                transactionList.push(trans);
                fecallback();
              } else {
                fecallback();
              }
            })
            feocallback();
          }
        })
        functioncallback();
			})
		}
	},function(err){
        var finalResponse = {};
        finalResponse = transactionList;
        helper.sort(finalResponse, "updatedTime")
		callback(finalResponse);
	});
}

//called from /bank/info 
//get Account Details
function getAccDetails (req, res, callback, regulator=null){
    var bankName = req.params.requestingBank == null ? requestingBank : req.params.requestingBank ;
	var response = {};
    var channels = [];
	var fcn = "readAccount";
	var orgname = helper.getOrg(bankName);
	var bankAccount = bankName;
	if (req.params.requestingBank) {
		bankAccount = req.params.requestingBank;
	}
	var args = [bankAccount];
	function updateResponse(balance, singleChannel){
		totalBalance += balance;
		channels.push(singleChannel);
	}
	var totalBalance = 0;
	response.totalBalance = totalBalance;
	async.forEach(helper.channelList(bankName), function(channelName,functioncallback) {
		if( helper.multilateralChannels.includes(channelName) || channelName.indexOf(helper.getName(bankName).toLowerCase()) == -1 ){
			functioncallback();
		} else {
            var tempBankName = regulator == null ? bankName : regulator ;
            var tempOrgName = regulator == null ? orgname : helper.bankOrgMapping[regulator] ;
            logger.debug(channelName + ":" + chaincodeName + ":" + fcn + ":" + args + "bankName: " + tempBankName + "Org: " + tempOrgName);
			query.queryChaincode("peer0", channelName, chaincodeName, args, fcn, tempBankName, tempOrgName)
			.then(function(message) {
                if( err = helper.checkError(message)) callback(err);
                message = JSON.parse(message);
                message.channel = channelName;
                message.counterparty = helper.getCounterparty(orgname, channelName);
                delete message.owner;
                logger.debug("Channels : %j" , channels);
                updateResponse(message.amount, message);
                functioncallback();
			})
		}
	},function(err){
        var finalResponse = {};
        finalResponse.bic = bankName;        
		finalResponse.balance = totalBalance;
        finalResponse.channels = channels;
        helper.sort(finalResponse.channels, "amount")
		callback(finalResponse)
	});
}

//called from /bank/counterparties 
//Not used as MAS
//get counterparty details 
function getCounterparties(req,res,callback){
	var bankName = requestingBank;
    var response = [];
    var orgname = helper.getOrg(bankName);
    var channels = helper.channelList(bankName);
    for(var i = 0; i < channels.length ; i++ ){
        if( !helper.multilateralChannels.includes(channels[i]) ){
            var placeholder = {};
            placeholder.channel = channels[i]
            placeholder.bic = helper.getCounterparty(orgname,channels[i])
            response.push(placeholder)
        }
    }
    callback(response);
}

// =========================================== Regulator Functions ===========================================


//called from /bank/balance/all
//get balance of all banks
function getAllBankBalances(req,res,callback){
	//list of all banks.
	var bankOrgs = helper.bankOrgMapping;
	var regulators = helper.regulators;
	var response = [];
	async.eachOfSeries(bankOrgs, function(org,bankName,seriesCallback){
		logger.debug("bankOrg: %s, bankName: %s ", org, bankName)
		//removing regulator account queries
		logger.warn(response)
		if (!regulators.includes(bankName) ) {
			req.params.requestingBank = bankName;
			getAccDetails(req,res,function(result){
				logger.debug("account: %s , totalbal: %s",bankName, result.balance);
				response.push(result)
				seriesCallback();
			},helper.whoami())
		} else {
			//if it is a regulator do nothing.
			seriesCallback();
		}
	}, function (results){
		callback(response);
	})
}

//unfreeze all accounts
function unfreezeTransactions (req, res, callback){
	var inputPayload = req.body;
	var masUsername = helper.getRUsername();
	var masOrgName = helper.bankOrgMapping[masUsername];

	req.params.requestingBank = helper.getRUsername();
	nettingService.getNettingStatus(req,res,function(response){
		var channelList = getListOfChannelsFromNettingCycle(response);
		unfreezeTransactionsByList(channelList, function(response){
			logger.debug(response)
			callback(response[0])
		});
	})
}

//called during netting
function getListOfChannelsFromNettingCycle(getNettingStatus){
	var channelList = [];
	var accountList = [];
	async.forEachOf(getNettingStatus.bankRequests , function(item,key,callback){
		accountList.push(key);
		async.forEach(accountList, function(account, callback){
			var bankOrg = helper.bankOrgMapping[account];
			var channels = helper.ORGS[bankOrg].channels;
			async.forEach(channels, function(channel, ecallback){
				if(!helper.multilateralChannels.includes(channel) && channelList.indexOf(channel) === -1)
					channelList.push(channel);
			})
		})
	}, function(err){});
	logger.debug(channelList)
	return channelList;
}

//called during netting
function unfreezeTransactionsByList(channelList, callback){
	var chaincodeName = helper.chainCodeMapping['bilateral'];
	var response = [];
	async.series([
		function(callback) {
			async.eachSeries(channelList, function (channel,callbackEachOf ){
				if( helper.multilateralChannels.includes(channel) ) { 
					callbackEachOf(); 
				} else {
					var masUsername = helper.getRUsername();
					var masOrgName = helper.bankOrgMapping[masUsername];
					var peers =  helper.channelMapping[channel];
					logger.debug("unfreezeTransactions: %s,%s,%s", peers, channel , chaincodeName)
					invoke.invokeChaincode(peers, channel , chaincodeName , "unfreezeAllTransactions", [], masUsername, masOrgName)
					.then(function(message) {
						logger.debug(message);
						response.push(message);
						callbackEachOf();
					});
				}
			}, function(err){
				logger.debug(response);
				callback(null,response);
			});
		}
	],
	function(err, results) {
		callback(results);
	});	
}





exports.getTransactions = getTransactions;
exports.getAccDetails = getAccDetails;
exports.getCounterparties = getCounterparties;
exports.unfreezeTransactions = unfreezeTransactions;
exports.getListOfChannelsFromNettingCycle = getListOfChannelsFromNettingCycle;
exports.unfreezeTransactionsByList = unfreezeTransactionsByList;
exports.getAllBankBalances = getAllBankBalances;
