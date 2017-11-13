'use strict';
var path = require('path');
var fs = require('fs');
var util = require('util');
var config = require('../config.json');
var helper = require('./helper.js');
var logger = helper.getLogger('invoke-chaincode');
var ORGS = helper.ORGS;
logger.setLevel('INFO');


function invokeChaincode(peersUrls, channelName, chaincodeName, fcn, args, username, org, retryNos=1) {
	logger.debug(util.format('\n============ invoke transaction on organization %s : %s ============\n', org, channelName));
	var client = helper.getClientForOrg(org);
	var channel = helper.getChannelForOrg(org + ':' + channelName);
	var targets = helper.newPeers(peersUrls);
	var tx_id = null;
	var niceErrorMsg;

	return helper.getRegisteredUsers(username, org).then((user) => {
		tx_id = client.newTransactionID();
		logger.debug(util.format('Sending transaction "%j"', tx_id));
		// send proposal to endorser
		var request = {
			targets: targets,
			chaincodeId: chaincodeName,
			fcn: fcn,
			args: args,
			chainId: channelName,
			txId: tx_id
		};
		logger.debug("request properties: %j", request);
		return channel.sendTransactionProposal(request);
	}, (err) => {
		logger.error('Failed to enroll user \'' + username + '\'. ' + err);
		throw new Error('Failed to enroll user \'' + username + '\'. ' + err);
	}).then((results) => {
		var proposalResponses = results[0];
		var proposal = results[1];
		var all_good = true;
		for (var i in proposalResponses) {
			let one_good = false;
			if (proposalResponses && proposalResponses[i].response &&
				proposalResponses[i].response.status === 200) {
				one_good = true;
				logger.info('transaction proposal %s was good', i);
			} else {
				logger.error('transaction proposal %s was bad', i);
			}
			all_good = all_good & one_good;
		}
		if (all_good) {
			logger.debug(util.format(
				'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s',
				proposalResponses[0].response.status, proposalResponses[0].response.message,
				proposalResponses[0].response.payload, proposalResponses[0].endorsement.signature));
			var responseCompare = channel.compareProposalResponseResults(proposalResponses);
			if (responseCompare) {
				logger.info('Proposal response comparison %s', responseCompare);
			} else {
				logger.error(
					'Mismatch on proposal response comparison. exiting... %s' , results[0]
				);
				return results[0] ;
			}
			var request = {
				proposalResponses: proposalResponses,
				proposal: proposal
			};
			// set the transaction listener and set a timeout of 30sec
			// if the transaction did not get committed within the timeout period,
			// fail the test
			var transactionID = tx_id.getTransactionID();
			var eventPromises = [];

			if (username == helper.getRUsername()) {
				var regulatorOrg = helper.bankOrgMapping[username];
				var regulatorPeerUrl = ORGS[regulatorOrg].orgPeers;
				var eventhubs = helper.newEventHubs(regulatorPeerUrl, regulatorOrg);
			} else {
				var eventhubs = helper.newEventHubs(peersUrls, org);
			}
			
			for (let key in eventhubs) {
				let eh = eventhubs[key];
				eh.connect();

				let txPromise = new Promise((resolve, reject) => {
					let handle = setTimeout(() => {
						eh.disconnect();
						reject();
					}, 30000);

					eh.registerTxEvent(transactionID, (tx, code) => {
						clearTimeout(handle);
						eh.unregisterTxEvent(transactionID);
						eh.disconnect();

						if (code !== 'VALID') {
							logger.error( 'Transaction ' + channelName + ' ' + fcn + ' ' + transactionID + ' was invalid on ' + eh._ep._endpoint.addr + ', code = ' + code);
							reject();
						} else {
							logger.info( 'Committed ' + channelName + ' ' + fcn + ' ' + transactionID + ' on peer ' + eh._ep._endpoint.addr);
							resolve();
						}
					});
				});
				eventPromises.push(txPromise);
			};
			var sendPromise = channel.sendTransaction(request);
			return Promise.all([sendPromise].concat(eventPromises)).then((results) => {
				logger.debug(' event promise all complete and testing complete');
				results[0].payload = String(request.proposalResponses[0].response.payload);
				return results[0]; // the first returned value is from the 'sendPromise' which is from the 'sendTransaction()' call
				logger.error(
					'Failed to send transaction and get notifications within the timeout period. %s',err
				);
				return '(status : 504, message : Failed to send transaction and get notifications within the timeout period.)';	
			});
		} else {
			logger.error(
				'Failed to send Proposal or receive valid response. Response null or status is not 200. exiting... %s' , results[0]
			);
			return results[0] ;
		}
	}, (err) => {
		logger.error('Failed to send proposal due to error: ' + err.stack ? err.stack : err);
		return '(status : 502, message : Failed to send proposal due to error: ' + err.stack ? err.stack : err + ')';
	}).then((response) => {
		if (response.status === 'SUCCESS') {
			logger.info('Successfully sent transaction to the orderer.');
			logger.debug("peersUrls %s, channelName %s, chaincodeName %s, fcn %s, args %s, username %s, org %s",peersUrls, channelName, chaincodeName, fcn, args, username, org);
			return { "status": 200 , fabricId: tx_id.getTransactionID(), "payload": response.payload };
		} else {
			if(retryNos > 0){
				logger.error("------RETRYING %s------", retryNos)
				return invokeChaincode(peersUrls, channelName, chaincodeName, fcn, args, username, org, --retryNos);
			} else {
				var nice;
				logger.warn(
					nice = String(response[0]).substring(String(response[0]).indexOf("("),String(response[0]).lastIndexOf(")"))
				  );
				var status = nice.substring(0,nice.indexOf(":"))
				var statusmsg = nice.indexOf(",") == -1 ? 500 : nice.substring(nice.indexOf(":")+2,nice.indexOf(",") );
				var message = nice.substring(nice.indexOf("message"),nice.indexOf(":",nice.indexOf(",")))
				var messagemsg = nice.substring(nice.indexOf(":",nice.indexOf("message"))+2)

				niceErrorMsg = {
					status : statusmsg,
					message : messagemsg
				}
				if(!nice || isNaN(statusmsg) ){
					niceErrorMsg = {
						"status" : 500,
						"message" : response
					}
				} 
				return niceErrorMsg ;
			}
		}
	}, (err) => {
		logger.error('Failed to send transaction due to error: ' + err);
		return 'Failed to send transaction due to error: ' +  err;
	});
};

exports.invokeChaincode = invokeChaincode;
