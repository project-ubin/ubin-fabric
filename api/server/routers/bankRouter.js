var express = require('express');
var bankService = require('../services/bankService.js');
var helper = require('../utils/helper.js');
var logger = helper.getLogger('bankRouter');
const bankRouter = express.Router();
const requestingBank = helper.whoami()

bankRouter.get('/bank/transactions', (req,res) => {
	bankService.getTransactions(req,res, (response) => {
		res.send(response);
	})
})

bankRouter.get('/bank/info', (req,res) => {
	bankService.getAccDetails(req,res, (response) => {
		res.send(response);
	})
})

bankRouter.get('/bank/counterparties', (req,res) => {
	bankService.getCounterparties(req,res, (response) => {
		res.send(response);
	})
})

// =========================================== Regulator Functions ===========================================

bankRouter.post('/bank/unfreeze/all', (req,res) => {
	bankService.unfreezeTransactions(req,res,function(response){
		res.send(response);
	})
})

bankRouter.get('/bank/balance/all', (req,res) => {
	if(!helper.regulators.includes(helper.whoami())){
		bankService.getAccDetails(req,res, (response) => {
			res.send(response);
		})
	} else {
		bankService.getAllBankBalances(req,res,(response) => {
			res.send(response);
		})
	}
})




module.exports = bankRouter;
