var invoke = require('../utils/invoke-transaction.js');
var helper = require('../utils/helper.js');
var channels = require('../utils/create-channel.js');
var join = require('../utils/join-channel.js');
var install = require('../utils/install-chaincode.js');
var instantiate = require('../utils/instantiate-chaincode.js');
var upgrade = require('../utils/upgrade-chaincode.js');
var invoke = require('../utils/invoke-transaction.js');
var query = require('../utils/query.js');
var async = require('async');
var logger = helper.getLogger('fabricService');

var pingCounter = 0;


// Register and enroll user
function getUsers (req, res) {
	var username = req.body.username;
	var orgName = req.body.orgName;
	logger.debug('End point : /users');
	logger.debug('User name : ' + username);
	logger.debug('Org name  : ' + orgName);
	if (!username) {
		res.json(getErrorMessage('\'username\''));
		return;
	}
	if (!orgName) {
		res.json(getErrorMessage('\'orgName\''));
		return;
	}
	helper.getRegisteredUsers(username, orgName, true).then(function(response) {
		if (response && typeof response !== 'string') {
			//response.token = token;
			res.json(response);
		} else {
			res.json({
				success: false,
				message: response
			});
		}
	});
}
// Create Channel
function createChannel (req, res) {
	logger.info('<<<<<<<<<<<<<<<<< C R E A T E  C H A N N E L >>>>>>>>>>>>>>>>>');
	logger.debug('End point : /channels');
	var channelName = req.body.channelName;
	var channelConfigPath = req.body.channelConfigPath;
	logger.debug('Channel name : ' + channelName);
	logger.debug('channelConfigPath : ' + channelConfigPath); //../artifacts/channel/mychannel.tx
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!channelConfigPath) {
		res.json(getErrorMessage('\'channelConfigPath\''));
		return;
	}

	channels.createChannel(channelName, channelConfigPath, req.body.username, req.body.orgname)
	.then(function(message) {
		res.send(message);
	});
}
// Join Channel
function joinChannel (req, res) {
	logger.info('<<<<<<<<<<<<<<<<< J O I N  C H A N N E L >>>>>>>>>>>>>>>>>');
	var channelName = req.params.channelName;
	var peers = req.body.peers;
	logger.debug('channelName : ' + channelName);
	logger.debug('peers : ' + peers);
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!peers || peers.length == 0) {
		res.json(getErrorMessage('\'peers\''));
		return;
	}

	join.joinChannel(channelName, peers, req.body.username, req.body.orgname)
	.then(function(message) {
		res.send(message);
	});
}
// Install chaincode on target peers
function installChaincode(req, res) {
	logger.debug('==================== INSTALL CHAINCODE ==================');
	var peers = req.body.peers;
	var chaincodeName = req.body.chaincodeName;
	var chaincodePath = req.body.chaincodePath;
	var chaincodeVersion = req.body.chaincodeVersion;
	logger.debug('peers : ' + peers); // target peers list
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('chaincodePath  : ' + chaincodePath);
	logger.debug('chaincodeVersion  : ' + chaincodeVersion);
	if (!peers || peers.length == 0) {
		res.json(getErrorMessage('\'peers\''));
		return;
	}
	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!chaincodePath) {
		res.json(getErrorMessage('\'chaincodePath\''));
		return;
	}
	if (!chaincodeVersion) {
		res.json(getErrorMessage('\'chaincodeVersion\''));
		return;
	}

	install.installChaincode(peers, chaincodeName, chaincodePath, chaincodeVersion, req.body.username, req.body.orgname)
	.then(function(message) {
		res.send(message);
	});
}
// Instantiate chaincode on target peers
function instantiateChaincode(req, res) {
	logger.debug('==================== INSTANTIATE CHAINCODE ==================');
	var chaincodeName = req.body.chaincodeName;
	var chaincodeVersion = req.body.chaincodeVersion;
	var channelName = req.params.channelName;
	var peers = req.body.peers;
	var functionName = req.body.functionName;
	var args = req.body.args;
	logger.debug('channelName  : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('chaincodeVersion  : ' + chaincodeVersion);
	logger.debug('functionName  : ' + functionName);
	logger.debug('args  : ' + args);
	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!chaincodeVersion) {
		res.json(getErrorMessage('\'chaincodeVersion\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!functionName) {
		res.json(getErrorMessage('\'functionName\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}
	instantiate.instantiateChaincode(peers, channelName, chaincodeName, chaincodeVersion, functionName, args, req.body.username, req.body.orgname)
	.then(function(message) {
		res.send(message);
	});
}
// Upgrade chaincode on target peers
function upgradeChaincode(req, res) {
	logger.debug('==================== UPGRADE CHAINCODE ==================');
	var chaincodeName = req.body.chaincodeName;
	var chaincodeVersion = req.body.chaincodeVersion;
	var channelName = req.params.channelName;
	var peers = req.body.peers;
	var functionName = req.body.functionName;
	var args = req.body.args;
	logger.debug('channelName  : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('chaincodeVersion  : ' + chaincodeVersion);
	logger.debug('functionName  : ' + functionName);
	logger.debug('args  : ' + args);
	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!chaincodeVersion) {
		res.json(getErrorMessage('\'chaincodeVersion\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!functionName) {
		res.json(getErrorMessage('\'functionName\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}
	upgrade.upgradeChaincode(peers, channelName, chaincodeName, chaincodeVersion, functionName, args, req.body.username, req.body.orgname)
	.then(function(message) {
		res.send(message);
	});
}
// Invoke transaction on chaincode on target peers
function invokeChaincode(req, res) {
	logger.debug('==================== INVOKE ON CHAINCODE ==================');
	var peers = req.body.peers;
	var chaincodeName = req.params.chaincodeName;
	var channelName = req.params.channelName;
	var fcn = req.body.fcn;
	var args = req.body.args;
	logger.debug('channelName  : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('fcn  : ' + fcn);
	logger.debug('args  : ' + args);
	if (!peers || peers.length == 0) {
		res.json(getErrorMessage('\'peers\''));
		return;
	}
	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!fcn) {
		res.json(getErrorMessage('\'fcn\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}

	invoke.invokeChaincode(peers, channelName, chaincodeName, fcn, args, req.body.username, req.body.orgname)
	.then(function(message) {
		res.send(message);
	});
}
// Query on chaincode on target peers
function queryByChaincode(req, res) {
	logger.debug('==================== QUERY BY CHAINCODE ==================');
	var channelName = req.params.channelName;
	var chaincodeName = req.params.chaincodeName;
	let args = req.query.args;
	let fcn = req.query.fcn;
	let peer = req.query.peer;

	logger.debug('channelName : ' + channelName);
	logger.debug('chaincodeName : ' + chaincodeName);
	logger.debug('fcn : ' + fcn);
	logger.debug('args : ' + args);

	if (!chaincodeName) {
		res.json(getErrorMessage('\'chaincodeName\''));
		return;
	}
	if (!channelName) {
		res.json(getErrorMessage('\'channelName\''));
		return;
	}
	if (!fcn) {
		res.json(getErrorMessage('\'fcn\''));
		return;
	}
	if (!args) {
		res.json(getErrorMessage('\'args\''));
		return;
	}
	args = args.replace(/'/g, '"');
	args = JSON.parse(args);
	logger.debug(args);

	query.queryChaincode(peer, channelName, chaincodeName, args, fcn, req.query.username, req.query.orgname)
	.then(function(message) {
		res.send(message);
	});
}
//  Query Get Block by BlockNumber
function queryBlockNumber(req, res) {
	logger.debug('==================== GET BLOCK BY NUMBER ==================');
	let blockId = req.params.blockId;
	let peer = req.query.peer;
	logger.debug('channelName : ' + req.params.channelName);
	logger.debug('BlockID : ' + blockId);
	logger.debug('Peer : ' + peer);
	if (!blockId) {
		res.json(getErrorMessage('\'blockId\''));
		return;
	}

	query.getBlockByNumber(peer, blockId, req.query.username, req.query.orgname, req.params.channelName)
		.then(function(message) {
			res.send(message);
		});
}
// Query Get Transaction by Transaction ID
function getTransactionByID(req, res) {
	logger.debug(
		'================ GET TRANSACTION BY TRANSACTION_ID ======================'
	);
	logger.debug('channelName : %s, TrxId: %s ' , req.params.channelName, req.params.trxnId);
	let trxnId = req.params.trxnId;
	let peer = req.query.peer;
	let channelName = req.params.channelName;
	if (!trxnId) {
		res.json(getErrorMessage('\'trxnId\''));
		return;
	}
	
	query.getTransactionByID(peer, trxnId, req.query.username, req.query.orgname, channelName)
		.then(function(message) {
			res.send(message);
		});
}
// Query Get Block by Hash
function getBlockByHash(req, res) {
	logger.debug('================ GET BLOCK BY HASH ======================');
	logger.debug('channelName : ' + req.params.channelName);
	let hash = req.query.hash;
	let peer = req.query.peer;
	if (!hash) {
		res.json(getErrorMessage('\'hash\''));
		return;
	}

	query.getBlockByHash(peer, hash, req.query.username, req.query.orgname, req.params.channelName).then(
		function(message) {
			res.send(message);
		});
}
//Query for Channel Information
function queryChannelInfo(req, res) {
	logger.debug( 
		'================ GET CHANNEL INFORMATION ======================');
	// logger.debug('peer: ' + req.query.peer);
	var bankName = req.params.requestingBank;
	var channelname = req.params.channelname;
	var orgname = helper.bankOrgMapping[bankName];
	// let peer = req.query.peer;
	logger.debug('bankName: ' + bankName);
	logger.debug('orgname: ' + orgname);
	logger.debug('channelname: '+ req.params.channelname);
	query.getChainInfo("peer0", bankName , orgname, channelname ).then(
		function(message) {
			res.send(message);
		});
}
// Query to fetch all Installed/instantiated chaincodes
function getAllChaincodes(req, res) {
	var peer = req.query.peer;
	var installType = req.query.type;
	//TODO: add Constnats
	if (installType === 'installed') {
		logger.debug(
			'================ GET INSTALLED CHAINCODES ======================');
	} else {
		logger.debug(
			'================ GET INSTANTIATED CHAINCODES ======================');
	}
	
	query.getInstalledChaincodes(peer, installType, req.query.username, req.query.orgname)
	.then(function(message) {
		res.send(message);
	});
}
// Query to fetch channels
function getChannels(req, res) {
	logger.debug('================ GET CHANNELS ======================');
	var bankName = req.params.requestingBank;
	var orgname = helper.bankOrgMapping[bankName];
	logger.debug('bankName: ' + bankName);
	logger.debug('orgname:  ' + orgname);
	
	query.getChannels("peer0", bankName , orgname )
	.then(function(
		message) {
		res.send(message);
	});
}

function getErrorMessage(field) {
	var response = {
		success: false,
		message: field + ' field is missing or Invalid in the request'
	};
	return response;
}

function pingChaincode(req,res,callback){
    var response = {};
	var username = helper.whoami();
	var orgname = helper.bankOrgMapping[username];
	var indexOfMe = Object.keys(helper.bankOrgMapping).indexOf(username)
	if(indexOfMe+1 == Object.keys(helper.bankOrgMapping).length ){
		var receiver = Object.keys(helper.bankOrgMapping)[1]
	} else {
		var receiver = Object.keys(helper.bankOrgMapping)[indexOfMe+1]
	}
	var targetFundOrg = helper.bankOrgMapping[receiver];
    var channelName = helper.ORGS[orgname].orgChannels[targetFundOrg]; 
    var peers = helper.channelMapping[channelName];
	var fcn = "pingChaincode";
	var args = []
	var chaincodeName = helper.chainCodeMapping['bilateral'];
	var createTime = new Date();
	async.series({
		binvoke: function(callback) {
			invoke.invokeChaincode(peers, channelName , chaincodeName , fcn , args , username, orgname)
			.then(function(message) {
				callback(null, message);
			})
		},
		bquery: function(callback){
			query.queryChaincode("peer0", channelName, chaincodeName, args, "pingChaincodeQuery", username, orgname)
			.then(function(message) {
				callback(null, message);
			})
		},
		finvoke: function(callback) {
			invoke.invokeChaincode(peers, helper.multilateralChannels[0] , helper.chainCodeMapping['funding'] , fcn , args , username, orgname)
			.then(function(message) { 
				callback(null, message);
			})
		},
		fquery: function(callback){
			query.queryChaincode("peer0", helper.multilateralChannels[0], helper.chainCodeMapping['funding'], args, "pingChaincodeQuery", username, orgname)
			.then(function(message) { 
				callback(null, message);
			})
		},
		ninvoke: function(callback) {
			invoke.invokeChaincode(helper.getAllpeers() , helper.multilateralChannels[1] , helper.chainCodeMapping['netting'] , fcn , args , username, orgname)
			.then(function(message) { 
				callback(null, message);
			})
		},
		nquery: function(callback){
			query.queryChaincode( "peer0" , helper.multilateralChannels[1], helper.chainCodeMapping['netting'], args, "pingChaincodeQuery", username, orgname)
			.then(function(message) { 
				callback(null, message);
			})
		}
	}, function(err, results) {
		// results is now equal to: {one: 1, two: 2}
		var finishTime = new Date()
		logger.debug(results)
		response.startTime = createTime.toJSON().toString();
		response.endTime = finishTime.toJSON().toString();
		response.timeTaken = ((finishTime - createTime)/1000).toString().concat(" s");
		callback(response)
	});
	
}


function resetAll(req,res, callback){
	var allchannels = helper.channelMapping;
	var fcn = "resetChannel";
	var response = {};
	var all = req.headers.all ? true : false 
	var args = helper.stringify([ all ])
	async.eachOfSeries(allchannels, function(peers,channel,functioncallback){
		var bankName = helper.getRUsername();
		var orgname = helper.bankOrgMapping[bankName];
		if (channel == "nettingchannel"){
			var chaincodeName = helper.chainCodeMapping['netting']
		}else if(channel == "fundingchannel"){
			var chaincodeName = helper.chainCodeMapping['funding']
			// peers.push(helper.channelMapping['scbcschannel'][0]);
			peers = ["FabricNx02:7051", "FabricNx03:8051"];
		} else {
			var chaincodeName = helper.chainCodeMapping['bilateral']
		}
		logger.info("peers: %s, channel: %s, chaincodename: %s, fcn: %s, args: %s, bankname: %s, orgname: %s",peers, channel , chaincodeName , fcn, args , bankName, orgname);
		invoke.invokeChaincode(peers, channel , chaincodeName , fcn, args , bankName, orgname)
		.then(function(result) {
			response[channel] = result
			functioncallback();
		});
	}, function (results){
		callback(response);
	});

}


exports.getUsers = getUsers;
exports.createChannel = createChannel;
exports.joinChannel = joinChannel;
exports.installChaincode = installChaincode;
exports.instantiateChaincode = instantiateChaincode;
exports.upgradeChaincode = upgradeChaincode;
exports.invokeChaincode = invokeChaincode;
exports.queryByChaincode = queryByChaincode;
exports.queryBlockNumber = queryBlockNumber;
exports.getTransactionByID = getTransactionByID;
exports.getBlockByHash = getBlockByHash;
exports.getChannels = getChannels;
exports.queryChannelInfo = queryChannelInfo;
exports.getAllChaincodes = getAllChaincodes;
exports.pingChaincode = pingChaincode;
exports.resetAll = resetAll;
