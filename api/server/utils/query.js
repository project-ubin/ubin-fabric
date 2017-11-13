var path = require('path');
var fs = require('fs');
var util = require('util');
var hfc = require('fabric-client');
var Peer = require('fabric-client/lib/Peer.js');
var EventHub = require('fabric-client/lib/EventHub.js');
var config = require('../config.json');
var helper = require('./helper.js');
var logger = helper.getLogger('Query');

function queryChaincode(peer, channelName, chaincodeName, args, fcn, username, org, retryNos=1) {
	var channel = helper.getChannelForOrg(org + ':' + channelName);
	var client = helper.getClientForOrg(org);
	var target = buildTarget(peer, org);
	var errorFlag = false;
	return helper.getRegisteredUsers(username, org).then((user) => {
		tx_id = client.newTransactionID();
		// send query
		var request = {
			chaincodeId: chaincodeName,
			txId: tx_id,
			fcn: fcn,
			args: args
		};
		logger.info("query to %s request: %j" , channelName , request)
		return channel.queryByChaincode(request, target);
	}, (err) => {
		logger.info('Failed to get submitter \''+username+'\'');
		errorFlag = true;
		return 'Failed to get submitter \''+username+'\'. Error: ' + err.stack ? err.stack :
			err;
	}).then((response_payloads) => {
		if (response_payloads) {
			logger.debug(response_payloads.toString('utf8'));
			for (let i = 0; i < response_payloads.length; i++) {
				return response_payloads[i].toString('utf8');
			}
		} else {
			logger.error('response_payloads is null');
			errorFlag = true;
			return 'response_payloads is null';
		}
		if(errorFlag && retryNos > 0 ){
			logger.warn("----RETRYING --%s-- ----" , retryNos)
			var returnMsg = queryChaincode(peer, channelName, chaincodeName, args, fcn, username, org, --retryNos )
			return returnMsg;
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to end to end test with error:' + err.stack ? err.stack :
			err);
		return 'Failed to end to end test with error:' + err.stack ? err.stack :
			err;
	});
};

var getBlockByNumber = function(peer, blockNumber, username, org, channelName) {
	var target = buildTarget(peer, org);
	var channel = helper.getChannelForOrg(org + ':' + channelName);

	return helper.getRegisteredUsers(username, org).then((member) => {
		return channel.queryBlock(parseInt(blockNumber), target);
	}, (err) => {
		logger.info('Failed to get submitter "' + username + '"');
		return 'Failed to get submitter "' + username + '". Error: ' + err.stack ?
			err.stack : err;
	}).then((response_payloads) => {
		if (response_payloads) {
			//logger.debug(response_payloads);
			logger.debug(response_payloads);
			return response_payloads; //response_payloads.data.data[0].buffer;
		} else {
			logger.error('response_payloads is null');
			return 'response_payloads is null';
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to query with error:' + err.stack ? err.stack : err);
		return 'Failed to query with error:' + err.stack ? err.stack : err;
	});
};
var getTransactionByID = function(peer, trxnID, username, org, channelName) {
	var target = buildTarget(peer, org);
	var channel = helper.getChannelForOrg(org + ':' + channelName);

	return helper.getRegisteredUsers(username, org).then((member) => {
		return channel.queryTransaction(trxnID, target);
	}, (err) => {
		logger.info('Failed to get submitter "' + username + '"');
		return 'Failed to get submitter "' + username + '". Error: ' + err.stack ?
			err.stack : err;
	}).then((response_payloads) => {
		if (response_payloads) {
			logger.debug(response_payloads);
			return response_payloads;
		} else {
			logger.error('response_payloads is null');
			return 'response_payloads is null';
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to query with error:' + err.stack ? err.stack : err);
		return 'Failed to query with error:' + err.stack ? err.stack : err;
	});
};
var getBlockByHash = function(peer, hash, username, org, channelName) {
	var target = buildTarget(peer, org);
	var channel = helper.getChannelForOrg(org + ':' + channelName);

	return helper.getRegisteredUsers(username, org).then((member) => {
		return channel.queryBlockByHash(Buffer.from(hash), target);
	}, (err) => {
		logger.info('Failed to get submitter "' + username + '"');
		return 'Failed to get submitter "' + username + '". Error: ' + err.stack ?
			err.stack : err;
	}).then((response_payloads) => {
		if (response_payloads) {
			logger.debug(response_payloads);
			return response_payloads;
		} else {
			logger.error('response_payloads is null');
			return 'response_payloads is null';
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to query with error:' + err.stack ? err.stack : err);
		return 'Failed to query with error:' + err.stack ? err.stack : err;
	});
};
var getChainInfo = function(peer, username, org, channelname) {
	var target = buildTarget(peer, org);
	var channel = helper.getChannelForOrg(org+ ':' + channelname);
	
	return helper.getRegisteredUsers(username, org).then((member) => {
		return channel.queryInfo(target);
	}, (err) => {
		logger.info('Failed to get submitter "' + username + '"');
		return 'Failed to get submitter "' + username + '". Error: ' + err.stack ?
			err.stack : err;
	}).then((blockchainInfo) => {
		if (blockchainInfo) {
			logger.debug('===========================================');
			logger.debug(blockchainInfo.currentBlockHash);
			logger.debug('===========================================');
			return blockchainInfo;
		} else {
			logger.error('response_payloads is null');
			return 'response_payloads is null';
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to query with error:' + err.stack ? err.stack : err);
		return 'Failed to query with error:' + err.stack ? err.stack : err;
	});
};
//getInstalledChaincodes
var getInstalledChaincodes = function(peer, type, username, org, channelname) {
	var target = buildTarget("peer0", org);
	var channel = helper.getChannelForOrg(org+ ':' + channelname);
	var client = helper.getClientForOrg(org);
	var channels;
	return helper.getOrgAdmin(org).then((member) => {
		if (type === 'installed') {
			logger.debug(client.queryInstalledChaincodes(target));
			return client.queryInstalledChaincodes(target);
		} else {
			channels = helper.getChannelsList(org);
			var arr = [];
			for(var i = 0; i < channels.length ; i++){
				var channel = helper.getChannelForOrg(org + ':' + channels[i]);
				arr.push(channel.queryInstantiatedChaincodes(target));
			}
			return Promise.all(arr);
		}
	}, (err) => {
		logger.info('Failed to get submitter "' + username + '"');
		return 'Failed to get submitter "' + username + '". Error: ' + err.stack ?
			err.stack : err;
	}).then((response) => {
		logger.debug(response[0])
		if (response) {
			if (type === 'installed') {
				logger.debug('<<< Installed Chaincodes >>>');
			} else {
				response.chaincodes = [];
				logger.debug('<<< Instantiated Chaincodes >>>');
				logger.debug(channels);
				for(var i = 0; i < response.length ; i ++){
					response.chaincodes.push(response[i].chaincodes[0])
					response.chaincodes[i].name = channels[i].split(':')[1].concat(':').concat(response.chaincodes[i].name)
				}
			}
			var details = [];
			for (let i = 0; i < response.chaincodes.length; i++) {
				logger.debug('name: ' + response.chaincodes[i].name + ', version: ' +
					response.chaincodes[i].version + ', path: ' + response.chaincodes[i].path
				);
				details.push('name: ' + response.chaincodes[i].name + ', version: ' +
					response.chaincodes[i].version + ', path: ' + response.chaincodes[i].path
				);
			}
			return details;
		} else {
			logger.error('response is null');
			return 'response is null';
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to query with error:' + err.stack ? err.stack : err);
		return 'Failed to query with error:' + err.stack ? err.stack : err;
	});
};
var getChannels = function(peer, username, org, channelname) {
	var target = buildTarget(peer, org);
	var channel = helper.getChannelForOrg(org+ ':' + channelname);
	var client = helper.getClientForOrg(org);

	return helper.getRegisteredUsers(username, org).then((member) => {
		//channel.setPrimaryPeer(targets[0]);
		return client.queryChannels(target);
	}, (err) => {
		logger.info('Failed to get submitter "' + username + '"');
		return 'Failed to get submitter "' + username + '". Error: ' + err.stack ?
			err.stack : err;
	}).then((response) => {
		if (response) {
			logger.debug('<<< channels >>>');
			var channelNames = [];
			for (let i = 0; i < response.channels.length; i++) {
				channelNames.push('channel id: ' + response.channels[i].channel_id);
			}
			logger.debug(channelNames);
			return response;
		} else {
			logger.error('response_payloads is null');
			return 'response_payloads is null';
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to query with error:' + err.stack ? err.stack : err);
		return 'Failed to query with error:' + err.stack ? err.stack : err;
	});
};

function buildTarget(peer, org) {
	var target = null;
	if (typeof peer !== 'undefined') {
		let targets = helper.newPeers([helper.getPeerAddressByName(org, peer)]);
		if (targets && targets.length > 0) target = targets[0];
	}

	return target;
}

exports.queryChaincode = queryChaincode;
exports.getBlockByNumber = getBlockByNumber;
exports.getTransactionByID = getTransactionByID;
exports.getBlockByHash = getBlockByHash;
exports.getChainInfo = getChainInfo;
exports.getInstalledChaincodes = getInstalledChaincodes;
exports.getChannels = getChannels;
