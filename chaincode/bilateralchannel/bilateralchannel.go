package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

// Netting channel constants
const nettingChaincodeName string = "nettingchannel_cc"
const nettingChannelName string = "nettingchannel"

// Funding channel constants
const fundingChaincodeName string = "fundingchannel_cc"
const fundingChannelName string = "fundingchannel"

const isBilateralNetting bool = true
const regulatorName string = "MASGSGSG"

type lessFunc func(p1, p2 *QueuedTransaction) bool

func main() {
	err := shim.Start(new(SimpleChaincode))
	if err != nil {
		fmt.Printf("Error starting Simple chaincode: %s", err)
	}
}

func (t *SimpleChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	return shim.Success(nil)
}

func (t *SimpleChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	function, args := stub.GetFunctionAndParameters()
	fmt.Println("invoke account is running " + function)

	if function == "pingChaincode" {
		return t.pingChaincode(stub)
	} else if function == "pingChaincodeQuery" {
		return t.pingChaincodeQuery(stub)

		// Account Functions
	} else if function == "initAccount" {
		return t.initAccount(stub, args)
	} else if function == "deleteAccount" {
		return t.deleteAccount(stub, args)
	} else if function == "readAccount" {
		return t.getStateAsBytes(stub, args)
	} else if function == "freezeAccount" {
		return t.updateAccountStatus(stub, args, "PAUSED")
	} else if function == "unfreezeAccount" {
		return t.updateAccountStatus(stub, args, "NORMAL")

		// Fund Manipulation Functions
	} else if function == "pledgeFund" {
		return t.createDestroyFund(stub, args, pledgeObjectType)
	} else if function == "redeemFund" {
		return t.createDestroyFund(stub, args, redeemObjectType)
	} else if function == "nettingAdd" {
		return t.createDestroyFund(stub, args, nettingAddObjectType)
	} else if function == "nettingSubtract" {
		return t.createDestroyFund(stub, args, nettingSubtractObjectType)
	} else if function == "fundTransfer" {
		return t.fundTransfer(stub, args)

		// Cross Channel Fund Movement Functions
	} else if function == "moveOutFund" {
		return t.moveOutFund(stub, args)
	} else if function == "moveInFund" {
		return t.moveInFund(stub, args)

		// Queueing Functions
	} else if function == "checkQueueAndSettle" {
		return t.checkQueueAndSettle(stub, args)
	} else if function == "getSortedQueue" {
		return t.getSortedQueueString(stub)
	} else if function == "getIncomingQueue" {
		return t.getIncomingQueueString(stub, args)
	} else if function == "getOutgoingQueue" {
		return t.getOutgoingQueueString(stub, args)
	} else if function == "updatePriority" {
		return t.updateQueuePriority(stub, args)
	} else if function == "toggleHoldResume" {
		return t.toggleHoldResume(stub, args)
	} else if function == "cancelQueue" {
		return t.cancelQueue(stub, args)

		// Multilateral Netting Functions
	} else if function == "getNettableIncomingQueue" {
		return t.getNettableIncomingQueueString(stub, args)
	} else if function == "getNettableOutgoingQueue" {
		return t.getNettableOutgoingQueueString(stub, args)
	} else if function == "settleMLNettingInstructions" {
		return t.settleMLNettingInstructions(stub, args)
	} else if function == "unfreezeAllTransactions" {
		return t.unfreezeAllTransactions(stub)

		// Other Functions
	} else if function == "getState" {
		return t.getStateAsBytes(stub, args)
	} else if function == "getTransactionHistory" {
		return t.getTransactionHistory(stub, args)
	} else if function == "getChannelLiquidity" {
		return t.getChannelLiquidity(stub)
	} else if function == "resetChannel" {
		return t.resetChannel(stub, args)
	}

	fmt.Println("Account invoke did not find func: " + function) //error
	return shim.Error("Received unknown function for Bilateral Channel invocation")
}

func (t *SimpleChaincode) pingChaincode(
	stub shim.ChaincodeStubInterface) pb.Response {

	pingChaincodeAsBytes, err := stub.GetState("pingchaincode")
	if err != nil {
		jsonResp := "Error: Failed to get state for pingchaincode"
		return shim.Error(jsonResp)
	} else if pingChaincodeAsBytes == nil {
		pingChaincode := PingChaincode{"pingchaincode", 1}
		pingChaincodeAsBytes, err = json.Marshal(pingChaincode)
		if err != nil {
			return shim.Error(err.Error())
		}

		err = stub.PutState("pingchaincode", pingChaincodeAsBytes)
		if err != nil {
			return shim.Error(err.Error())
		}
	} else {
		pingChaincode := &PingChaincode{}
		err = json.Unmarshal([]byte(pingChaincodeAsBytes), pingChaincode)
		pingChaincode.number++
		pingChaincodeAsBytes, err = json.Marshal(pingChaincode)
		if err != nil {
			return shim.Error(err.Error())
		}
		err = stub.PutState("pingchaincode", pingChaincodeAsBytes)
		if err != nil {
			return shim.Error(err.Error())
		}
	}
	return shim.Success(pingChaincodeAsBytes)
}

func (t *SimpleChaincode) pingChaincodeQuery(
	stub shim.ChaincodeStubInterface) pb.Response {

	pingChaincodeAsBytes, err := stub.GetState("pingchaincode")
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(pingChaincodeAsBytes)
}

func (t *SimpleChaincode) getStateAsBytes(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	err := checkArgArrayLength(args, 1)
	if err != nil {
		return shim.Error(err.Error())
	}

	key := args[0]
	valAsbytes, err := stub.GetState(key)
	if err != nil {
		return shim.Error(err.Error())
	} else if valAsbytes == nil {
		errMsg := fmt.Sprintf("Error: Key does not exist (%s)", key)
		return shim.Error(errMsg)
	}

	return shim.Success(valAsbytes)
}

func (t *SimpleChaincode) getTransactionHistory(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	var completedTransactionArr []CompletedTransaction
	var pledgeRedeemFundArr []PledgeRedeemFund
	var queryString string

	err := checkArgArrayLength(args, 1)
	if err != nil {
		return shim.Error(err.Error())
	}
	accountID := args[0]

	if accountID == regulatorName {
		queryString = fmt.Sprintf(
			`{"selector":{  
	        	"$or":[  
	            	{"docType":"%s"},
	            	{"docType":"%s"},
	            	{"docType":"%s"},
	            	{"docType":"%s"}
	        	]
	    	}}`,
			pledgeObjectType,
			redeemObjectType,
			nettingAddObjectType,
			nettingSubtractObjectType)
	} else {
		queryString = fmt.Sprintf(
			`{"selector":{"docType":"%s"}}`,
			completedTxObjectType)
		completedTransactionArr, err = getCompletedTxArrFromQuery(stub, queryString)
		if err != nil {
			return shim.Error(err.Error())
		}

		queryString = fmt.Sprintf(
			`{"selector":{  
		        "accountID":"%s",
		        "$or":[  
		            {"docType":"%s"},
		            {"docType":"%s"},
		            {"docType":"%s"},
		            {"docType":"%s"}
		        ]
			}}`,
			accountID,
			pledgeObjectType,
			redeemObjectType,
			nettingAddObjectType,
			nettingSubtractObjectType)
	}

	pledgeRedeemFundArr, err = getPledgeRedeemFundArrFromQuery(stub, queryString)
	if err != nil {
		return shim.Error(err.Error())
	}

	queryString = fmt.Sprintf(
		`{"selector":{
			"accountID":"%s",
			"$or":[
				{"docType":"moveoutfund"},
				{"docType":"moveinfund"}
			]
		}}`,
		accountID)
	moveOutInFundArr, err := getMoveOutInFundArrayFromQuery(stub, queryString)
	if err != nil {
		return shim.Error(err.Error())
	}
	transactionHistory := TransactionHistory{
		completedTransactionArr,
		pledgeRedeemFundArr,
		moveOutInFundArr}
	transactionHistoryAsBytes, err := json.Marshal(transactionHistory)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(transactionHistoryAsBytes)
}

func (t *SimpleChaincode) resetChannel(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	var err error
	respMsg := "Successfully reset all assets"

	isResetHistory := false
	if len(args) > 0 && len(args[0]) > 0 {
		isResetHistory, err = strconv.ParseBool(strings.ToLower(args[0]))
		if err != nil {
			return shim.Error(err.Error())
		}
	}

	err = resetAllAccounts(stub)
	if err != nil {
		return shim.Error(err.Error())
	}
	err = resetAllQueues(stub)
	if err != nil {
		return shim.Error(err.Error())
	}
	if isResetHistory {
		respMsg = "Successfully reset all assets and transaction history"
		err = resetAllCompletedTx(stub)
		if err != nil {
			return shim.Error(err.Error())
		}
		err = resetAllPledgeRedeem(stub)
		if err != nil {
			return shim.Error(err.Error())
		}
		err = resetAllMoveOutInFund(stub)
		if err != nil {
			return shim.Error(err.Error())
		}
	}

	return shim.Success([]byte(respMsg))
}
