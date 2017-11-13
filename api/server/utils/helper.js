'use strict';
var log4js = require('log4js');
var logger = log4js.getLogger('Helper');
logger.setLevel('ERROR');

var path = require('path');
var util = require('util');
var fs = require('fs-extra');
var User = require('fabric-client/lib/User.js');
var crypto = require('crypto');
var copService = require('fabric-ca-client');
var config = require('../config.json');
var bankArgs = process.argv[2] == null ? '' : '_'.concat(process.argv[2]);
var networkConfig = require(path.join(__dirname, '../../', 'config/network-config'.concat(bankArgs).concat('.json')));
var async = require('async');

var hfc = require('fabric-client');
hfc.addConfigFile(path.join(__dirname, '../../', 'config/network-config'.concat(bankArgs).concat('.json')));
hfc.setLogger(logger);
hfc.addConfigFile(path.join(__dirname, '../../', 'config/network-reference'.concat('.json')));
var ORGS = hfc.getConfigSetting('networkConfig');
var bankOrgMapping = hfc.getConfigSetting('bankOrgMapping');
var regulators = hfc.getConfigSetting('regulators');
var chainCodeMapping = hfc.getConfigSetting('chainCodeMapping');
var multilateralChannels = hfc.getConfigSetting('multilateralChannels');
var channelMapping = hfc.getConfigSetting('channelMapping');
var channelBankMapping = hfc.getConfigSetting('channelBankMapping');

const PEER0 = "peer0" //assumed that 1 bank only have 1 peer that is: peer0


var clients = {};
var channels = {};
var caClients = {};

// set up the client and channel objects for each org
for (let key in ORGS) {
	if (key.indexOf('org') === 0) {
		let client = new hfc();
		logger.debug("Key : " + key);

		channelList(whoami()).forEach(function(channelName){
			logger.debug("\t Channel Name: " + channelName);
			let cryptoSuite = hfc.newCryptoSuite();
			cryptoSuite.setCryptoKeyStore(hfc.newCryptoKeyStore({path: getKeyStoreForOrg(ORGS[key].bic)}));
			client.setCryptoSuite(cryptoSuite);
	
			let channel = client.newChannel(channelName);
			channel.addOrderer(newOrderer(client));
	
			clients[key] = client;
			channels[key + ':' + channelName] = channel;
	
			setupPeers(channel, key, client);
	
			let caUrl = ORGS[key].ca;
			caClients[key] = new copService(caUrl, null /*defautl TLS opts*/, '' /* default CA */, cryptoSuite);
		});		
	}
}

function setupPeers(channel, org, client) {
	for (let key in ORGS[org]) {
		if (key.indexOf('peer') === 0) {
			let data = fs.readFileSync(path.join(__dirname, ORGS[org][key]['tls_cacerts']));
			let peer = client.newPeer(
				ORGS[org][key].requests,
				{
					pem: Buffer.from(data).toString(),
					'ssl-target-name-override': ORGS[org][key]['server-hostname']
				}
			);

			channel.addPeer(peer);
		}
	}
}

function newOrderer(client) {
	var caRootsPath = ORGS.orderer.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, caRootsPath));
	let caroots = Buffer.from(data).toString();
	return client.newOrderer(config.orderer, {
		'pem': caroots,
		'ssl-target-name-override': ORGS.orderer['server-hostname']
	});
}

function readAllFiles(dir) {
	var files = fs.readdirSync(dir);
	var certs = [];
	files.forEach((file_name) => {
		let file_path = path.join(dir,file_name);
		let data = fs.readFileSync(file_path);
		certs.push(data);
	});
	return certs;
}

function getOrgName(org) {
	return ORGS[org].bic;
}

function getKeyStoreForOrg(org) {
	return config.keyValueStore + '_' + org;
}

function getBilateralOrgName(org, channelName){
	var orgChannels = ORGS[org].orgChannels;
	for(var bilateralOrg in orgChannels){
		if(orgChannels[bilateralOrg] == channelName){
			return bilateralOrg;
		}
	}	
}

function newRemotes(urls, forPeers, userOrg) {
	var targets = [];
	// find the peer that match the urls
	let found = false;
	outer:
	for (let index in urls) {
		let peerUrl = urls[index];

		for (let key in ORGS) {
			if (key.indexOf('org') === 0) {
				// if looking for event hubs, an app can only connect to
				// event hubs in its own org
				if (!forPeers && key !== userOrg) {
					continue;
				}

				let org = ORGS[key];
				let client = getClientForOrg(key);

				for (let prop in org) {
					if (prop.indexOf('peer') === 0) {
						if (org[prop]['requests'].indexOf(peerUrl) >= 0) {
							// found a peer matching the subject url
							found = true;
							if (forPeers) {
								let data = fs.readFileSync(path.join(__dirname, org[prop]['tls_cacerts']));
								targets.push(client.newPeer('grpc://' + peerUrl, {
									pem: Buffer.from(data).toString(),
									'ssl-target-name-override': org[prop]['server-hostname']
								}));
								
								continue outer;
							} else {
								let eh = client.newEventHub();
								let data = fs.readFileSync(path.join(__dirname, org[prop]['tls_cacerts']));
								eh.setPeerAddr(org[prop]['events'], {
									pem: Buffer.from(data).toString(),
									'ssl-target-name-override': org[prop]['server-hostname']
								});
								targets.push(eh);
								
								continue outer;
							}
						}
					}
				}
			}
		}

		if (!found) {
			logger.warn(util.format('Failed to find a peer matching the url %s', peerUrl));
		}
	}

	return targets;
}

function channelList(bankname){
	if(regulators.includes(bankname)){
		return ORGS[getOrg(bankname)].channels
	} else {
		var org = getOrg(bankname)
		var multiChannels =  multilateralChannels.length > 0 ? Object.keys(multilateralChannels).map(function(k) { return multilateralChannels[k] }) : [] ;
		var biChannels = Object.keys(ORGS[org].orgChannels).map(function(k) { return ORGS[org].orgChannels[k] });
		return multiChannels.concat(biChannels)
	}
}

//-------------------------------------//
// APIs
//-------------------------------------//
var getChannelForOrg = function(org) {
	return channels[org];
};

var getChannelsList = function(org) {

	var orgName = [];
	
	async.forEachOf( channels, (value,key,callback) => {
		if( org === key.split(':')[0] ) {
			orgName.push(key);
		}
	} )

	return orgName;
};

var getClientForOrg = function(org) {
	return clients[org];
};

var newPeers = function(urls) {
	return newRemotes(urls, true);
};

var newEventHubs = function(urls, org) {
	return newRemotes(urls, false, org);
};

var getMspID = function(org) {
	logger.debug('Msp ID : ' + ORGS[org].mspid);
	return ORGS[org].mspid;
};

var getAdminUser = function(userOrg) {
	var users = config.users;
	var username = users[0].username;
	var password = users[0].secret;
	var member;
	var client = getClientForOrg(userOrg);

	return hfc.newDefaultKeyValueStore({
		path: getKeyStoreForOrg(getOrgName(userOrg))
	}).then((store) => {
		client.setStateStore(store);
		// clearing the user context before switching
		client._userContext = null;
		return client.getUserContext(username, true).then((user) => {
			if (user && user.isEnrolled()) {
				logger.info('Successfully loaded member from persistence');
				return user;
			} else {
				let caClient = caClients[userOrg];
				// need to enroll it with CA server
				return caClient.enroll({
					enrollmentID: username,
					enrollmentSecret: password
				}).then((enrollment) => {
					logger.info('Successfully enrolled user \'' + username + '\'');
					member = new User(username);
					member.setCryptoSuite(client.getCryptoSuite());
					return member.setEnrollment(enrollment.key, enrollment.certificate, getMspID(userOrg));
				}).then(() => {
					return client.setUserContext(member);
				}).then(() => {
					return member;
				}).catch((err) => {
					logger.error('Failed to enroll and persist user. Error: ' + err.stack ?
						err.stack : err);
					return null;
				});
			}
		});
	});
};

var getRegisteredUsers = function(username, userOrg, isJson) {
	var member;
	var client = getClientForOrg(userOrg);
	var enrollmentSecret = null;
	return hfc.newDefaultKeyValueStore({
		path: getKeyStoreForOrg(getOrgName(userOrg))
	}).then((store) => {
		client.setStateStore(store);
		// clearing the user context before switching
		client._userContext = null;
		return client.getUserContext(username, true).then((user) => {
			if (user && user.isEnrolled()) {
				logger.info('Successfully loaded member from persistence');
				return user;
			} else {
				let caClient = caClients[userOrg];
				return getAdminUser(userOrg).then(function(adminUserObj) {
					member = adminUserObj;
					logger.info(member);
					return caClient.register({
						enrollmentID: username,
						affiliation: 'org1.department1'
					}, member);
				}).then((secret) => {
					enrollmentSecret = secret;
					logger.debug(username + ' registered successfully');
					return caClient.enroll({
						enrollmentID: username,
						enrollmentSecret: secret
					});
				}, (err) => {
					logger.error(username + ' failed to register due to ' + err);
					return '' + err;
					//return 'Failed to register '+username+'. Error: ' + err.stack ? err.stack : err;
				}).then((message) => {
					if (message && typeof message === 'string' && message.includes(
							'Error:')) {
						logger.error(username + ' enrollment failed due to ' + message);
						return message;
					}
					logger.debug(username + ' enrolled successfully');

					member = new User(username);
					member._enrollmentSecret = enrollmentSecret;
					return member.setEnrollment(message.key, message.certificate, getMspID(userOrg));
				}).then(() => {
					client.setUserContext(member);
					return member;
				}, (err) => {
					logger.error(util.format('%s enroll failed: %s', username, err.stack ? err.stack : err));
					return '' + err;
				});;
			}
		});
	}).then((user) => {
		if (isJson && isJson === true) {
			var response = {
				success: true,
				secret: user._enrollmentSecret,
				message: username + ' enrolled Successfully',
			};
			return response;
		}
		return user;
	}, (err) => {
		logger.error(util.format('Failed to get registered user: %s, error: %s', username, err.stack ? err.stack : err));
		return '' + err;
	});
};

var getOrgAdmin = function(userOrg) {
	var admin = ORGS[userOrg].admin;
	var keyPath = path.join(__dirname, admin.key);
	var keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
	var certPath = path.join(__dirname, admin.cert);
	var certPEM = readAllFiles(certPath)[0].toString();

	var client = getClientForOrg(userOrg);
	var cryptoSuite = hfc.newCryptoSuite();
	if (userOrg) {
		cryptoSuite.setCryptoKeyStore(hfc.newCryptoKeyStore({path: getKeyStoreForOrg(getOrgName(userOrg))}));
		client.setCryptoSuite(cryptoSuite);
	}

	return hfc.newDefaultKeyValueStore({
		path: getKeyStoreForOrg(getOrgName(userOrg))
	}).then((store) => {
		client.setStateStore(store);

		return client.createUser({
			username: 'peer'+userOrg+'Admin',
			mspid: getMspID(userOrg),
			cryptoContent: {
				privateKeyPEM: keyPEM,
				signedCertPEM: certPEM
			}
		});
	});
};

var setupChaincodeDeploy = function() {
	logger.warn("GOPATH: %s ",process.env.GOPATH);
};

var getLogger = function(moduleName) {
	var logger = log4js.getLogger(moduleName);
	logger.setLevel('ERROR');
	return logger;
};

var getPeerAddressByName = function(org, peer) {
	logger.debug("\tDebug : Org : " + org);
	logger.debug("\tDebug : Peer : " + peer);
	var address = ORGS[org][peer].requests;
	return address.split('grpc://')[1];
};

var getRUsername = function(){
	return Object.keys(bankOrgMapping)[0];
}

var whoamilist = function(){
	var list = [];
	for (var i = 1; i < Object.keys(ORGS).length ; i++){
		list.push(Object.keys(ORGS)[i])
	}
	return list
}

function whoami(){
	Object.keys(ORGS)[1];
	//reverse json mapping
	for (var i = 0; i < Object.keys(bankOrgMapping).length ; i++){
		if ( bankOrgMapping[Object.keys(bankOrgMapping)[i]] ==  Object.keys(ORGS)[1] ) {
			return Object.keys(bankOrgMapping)[i];
		}
	}
}

function getName(bankName){
 	return ORGS[getOrg(bankName)].bic
}

function getOrg(bankName){
	return bankOrgMapping[bankName];
}

function getChannel(sender,receiver){
	var senderOrg = getOrg(sender);
	var receiverOrg = getOrg(receiver);
	return ORGS[senderOrg].orgChannels[receiverOrg]; 
}

function getPeers(sender,receiver){
	var senderOrg = getOrg(sender);
	var receiverOrg = getOrg(receiver);
	return [ getPeerAddressByName(senderOrg,PEER0), getPeerAddressByName(receiverOrg,PEER0) ]
}

function getCounterpartyOrgFromChannelName(channelName){
	var sender = whoami()
	var senderOrg = getOrg(sender);
	var chls = ORGS[senderOrg].orgChannels;
	// reverse mapping
	for (var i = 0; i < Object.keys(chls).length; i++){
		if ( chls[Object.keys(chls)[i]] ==  channelName ) {
			return Object.keys(chls)[i];
		}
	}
}

function getPeersFromChannel(channelName){
	//check if is regulator
	if(regulators.includes(whoami())){
		var channelParticipants = []
		async.forEach(ORGS, function(channel,callback){
			logger.debug(channel.orgChannels)
			logger.debug(channelName)
			for(var keys in channel.orgChannels){
				if(channel.orgChannels[keys] === channelName){
					channelParticipants.push(keys)
				}
			}
		});
		return [ getPeerAddressByName(channelParticipants[1],PEER0), getPeerAddressByName(channelParticipants[0],PEER0) ]
	} else {
		var senderOrg = getOrg(whoami());
		var receiverOrg = getCounterpartyOrgFromChannelName(channelName);
		return [ getPeerAddressByName(senderOrg,PEER0), getPeerAddressByName(receiverOrg,PEER0) ]
	}
	
}


exports.getChannelForOrg = getChannelForOrg;
exports.getChannelsList = getChannelsList;
exports.getClientForOrg = getClientForOrg;
exports.getLogger = getLogger;
exports.setupChaincodeDeploy = setupChaincodeDeploy;
exports.getMspID = getMspID;
exports.ORGS = ORGS;
exports.bankOrgMapping = bankOrgMapping;
exports.chainCodeMapping = chainCodeMapping;
exports.multilateralChannels = multilateralChannels;
exports.channelMapping = channelMapping;
exports.channelBankMapping = channelBankMapping;
exports.regulators = regulators;
exports.newPeers = newPeers;
exports.newEventHubs = newEventHubs;
exports.getPeerAddressByName = getPeerAddressByName;
exports.getRegisteredUsers = getRegisteredUsers;
exports.getOrgAdmin = getOrgAdmin;
exports.getBilateralOrgName = getBilateralOrgName;
exports.getRUsername = getRUsername;
exports.whoamilist = whoamilist;
exports.whoami = whoami;
exports.getName = getName;
exports.getOrg = getOrg;
exports.getChannel = getChannel;
exports.getPeers = getPeers;
exports.getPeersFromChannel = getPeersFromChannel;


//=============================  helper function(s) =================================
function stringify(args){
	for(var i=0; i<args.length;i++) args[i] = String(args[i]);
	return args
}

exports.convertToSHA256 = function (string){
	return crypto.createHash('sha256').update(string).digest('hex');
}

exports.checkError = function(message){
	if(message.indexOf("Error")>=0) {
		return( { "Error" : message.substring(message.indexOf("Error")+7)  } );
	} else {
		return false;
	}
}

exports.hasWhiteSpace = function(s) {
	return s.indexOf(' ') >= 0; 
}

function JSONValueToArray (json){
	var returnArr = [];
	for ( var obj in json ) {
		returnArr.push(obj);
	}
	return returnArr;
}

exports.getpeers = function(sender,receiver){
	var orgname = bankOrgMapping[sender];
	var senderpeer = ORGS[orgname].orgPeers;
	var receiverorgname = bankOrgMapping[receiver];
	var receiverpeer = ORGS[receiverorgname].orgPeers;
	return  [ senderpeer , receiverpeer  ]  ;
}

exports.getAllpeers = function(){
	return channelMapping.nettingchannel;
}

exports.collapseAndSort = function(longstring){
	var splittedArr = splitPrioritysortTimestamp(collapseChannelArray(longstring));
	var priorityarray = splittedArr.priorityarray;
	var nonpriorityarray = splittedArr.nonpriorityarray;
	Array.prototype.push.apply(priorityarray,nonpriorityarray);
	return priorityarray
}

function collapseChannelArray(longstring,callback){
	var collapsearray = []
	for(var i = 0; i < longstring.channels.length; i++) {
		var obj = longstring.channels[i];
		for (var key in obj) {
			for(var int = 0; int < obj[key].length; int++) {
				if (obj[key][int] != null){
					collapsearray.push(obj[key][int]);
				}
			}
		}
	}
	return collapsearray;
}

function splitPrioritysortTimestamp(collapsearray){
	var priorityarray = [];
	var nonpriorityarray = [];
	for(var x = 0; x < collapsearray.length; x++){
		if(collapsearray[x].priority == 1 ){
			priorityarray.push(collapsearray[x]);
		} else {
			nonpriorityarray.push(collapsearray[x]);
		}
	}
	priorityarray.sort(function(a, b) {
		return a.createTime > b.createTime;
	});
	nonpriorityarray.sort(function(a, b) {
		return a.createTime > b.createTime;
	});
	return {
		priorityarray: priorityarray,
		nonpriorityarray: nonpriorityarray
	}
}

exports.getCounterparty = function(org, channelName){
	var bilateralOrg = getBilateralOrgName(org, channelName);
	var bankOrgMap = bankOrgMapping;
	for (var bankName in bankOrgMap){
		if (bankOrgMap[bankName] == bilateralOrg){
			return bankName;
		}
	}
}

function validateBank(inputvalue){
	var valid;
	async.forEachOf(bankOrgMapping, function (value, key, callback) {
		if( inputvalue == key ){
			callback("breakloop");
		}
	}, function (err) {
		valid = err ? true : false ;
	});
	return valid;
}

function validateChannel(inputvalue){
	var valid;
	async.forEachOf(channelMapping, function (value, key, callback) {
		if( inputvalue == key ){
			callback("breakloop");
		}
	}, function (err) {
		valid = err ? true : false ;
	});
	return valid;
}

exports.validateBankInChannel = function(bank,channel){
	var valid;
	if (!validateBank(bank) || !validateChannel(channel) ){
		valid = false;
	} else if (regulators.includes(bank) && validateChannel(channel)) {
		// MAS by-pass 
		valid = true;
	} else {
		var orgname = getOrg(bank);
		var orgPeers = ORGS[orgname].orgPeers;
		var peers =  channelMapping[channel];
		valid = peers.includes(orgPeers[0])
	}
	return valid;
}

function sort(array,key,asc){
	if (asc){
		array.sort(function(a,b){
			return a[key] > b[key]
		})
	} else {
		array.sort(function(a,b){
			return a[key] < b[key]
		})
	}
	return array;
}

function IsJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

exports.IsJsonString = IsJsonString;
exports.stringify = stringify;
exports.JSONValueToArray = JSONValueToArray;
exports.sort = sort;
exports.channelList = channelList;

