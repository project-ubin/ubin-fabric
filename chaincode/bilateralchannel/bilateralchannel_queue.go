package main

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

// ***********************************************************
// External Queue Getter Functions
// ***********************************************************

func (t *SimpleChaincode) getSortedQueueString(
	stub shim.ChaincodeStubInterface) pb.Response {

	queryString := fmt.Sprintf(
		`{"selector":{"docType":"%s"}}`,
		queuedTxObjectType)
	queryResults, err := getSortedQueues(stub, queryString)
	if err != nil {
		return shim.Error(err.Error())
	}
	queryResultsString, err := json.MarshalIndent(queryResults, "", "  ")
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(queryResultsString)
}

func (t *SimpleChaincode) getOutgoingQueueString(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	err := checkArgArrayLength(args, 1)
	if err != nil {
		return shim.Error(err.Error())
	}
	var accountID string
	accountID = args[0]
	queryString := fmt.Sprintf(
		`{"selector":{"docType":"%s","sender":"%s"}}`,
		queuedTxObjectType,
		accountID)
	queryResults, err := getSortedQueues(stub, queryString)
	if err != nil {
		return shim.Error(err.Error())
	}
	queryResultsString, err := json.MarshalIndent(queryResults, "", "  ")
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(queryResultsString)
}

func (t *SimpleChaincode) getIncomingQueueString(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	err := checkArgArrayLength(args, 1)
	if err != nil {
		return shim.Error(err.Error())
	}
	accountID := args[0]
	queryString := fmt.Sprintf(
		`{"selector":{"docType":"%s","receiver":"%s"}}`,
		queuedTxObjectType,
		accountID)
	queryResults, err := getSortedQueues(stub, queryString)
	if err != nil {
		return shim.Error(err.Error())
	}
	queryResultsString, err := json.MarshalIndent(queryResults, "", "  ")
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(queryResultsString)
}

func (t *SimpleChaincode) getNettableOutgoingQueueString(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	err := checkArgArrayLength(args, 1)
	if err != nil {
		return shim.Error(err.Error())
	}
	accountID := args[0]
	queryString := fmt.Sprintf(
		`{"selector":{
			"docType":"%s",
			"status":"ACTIVE",
			"sender":"%s",
			"nettable":true,
			"isFrozen":false
		}}`,
		queuedTxObjectType,
		accountID)
	queryResults, err := getSortedQueues(stub, queryString)
	if err != nil {
		return shim.Error(err.Error())
	}
	queryResultsString, err := json.MarshalIndent(queryResults, "", "  ")
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(queryResultsString)
}

func (t *SimpleChaincode) getNettableIncomingQueueString(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	err := checkArgArrayLength(args, 1)
	if err != nil {
		return shim.Error(err.Error())
	}
	accountID := args[0]
	queryString := fmt.Sprintf(
		`{"selector":{
			"docType":"%s",
			"status":"ACTIVE",
			"receiver":"%s",
			"nettable":true,
			"isFrozen":false
		}}`,
		queuedTxObjectType,
		accountID)
	queryResults, err := getSortedQueues(stub, queryString)
	if err != nil {
		return shim.Error(err.Error())
	}
	queryResultsString, err := json.MarshalIndent(queryResults, "", "  ")
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(queryResultsString)
}

// ***********************************************************
// External Queue Update Functions
// ***********************************************************

func (t *SimpleChaincode) updateQueueStatus(
	stub shim.ChaincodeStubInterface,
	args []string,
	status string) pb.Response {

	err := checkArgArrayLength(args, 1)
	if err != nil {
		return shim.Error(err.Error())
	}
	if len(args[0]) <= 0 {
		return shim.Error("Instruction ID must be a non-empty string")
	}
	if len(status) <= 0 {
		return shim.Error("Status must be a non-empty string")
	}

	refID := args[0]

	queuedTx, err := getQueueStructFromID(stub, refID)
	if err != nil {
		return shim.Error(err.Error())
	}
	queuedTx.Status = status
	queuedTx.UpdateTime, err = getTxTimeStampAsTime(stub)
	if err != nil {
		return shim.Error(err.Error())
	}

	queuedTxAsBytes, err := json.Marshal(queuedTx)
	if err != nil {
		return shim.Error(err.Error())
	}
	err = stub.PutState(queuedTx.RefID, queuedTxAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success(nil)
}

func (t *SimpleChaincode) toggleHoldResume(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	err := checkArgArrayLength(args, 1)
	if err != nil {
		return shim.Error(err.Error())
	}
	if len(args[0]) <= 0 {
		return shim.Error("Queue RefID must be a non-empty string")
	}

	queueID := args[0]

	queuedTx, err := getQueueStructFromID(stub, queueID)
	if err != nil {
		return shim.Error(err.Error())
	}

	var respMsg string
	if queuedTx.Status == "HOLD" {
		respMsg = fmt.Sprintf("Successfully changed status of %s to ACTIVE", queueID)
		queuedTx.Status = "ACTIVE"
	} else if queuedTx.Status == "ACTIVE" {
		respMsg = fmt.Sprintf("Successfully changed status of %s to HOLD", queueID)
		queuedTx.Status = "HOLD"
	}

	queuedTx.UpdateTime, err = getTxTimeStampAsTime(stub)
	if err != nil {
		return shim.Error(err.Error())
	}

	queuedTxAsBytes, err := json.Marshal(queuedTx)
	if err != nil {
		return shim.Error(err.Error())
	}
	err = stub.PutState(queuedTx.RefID, queuedTxAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success([]byte(respMsg))
}

func (t *SimpleChaincode) updateQueuePriority(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	// instructionID, priority, currentTime
	err := checkArgArrayLength(args, 2)
	if err != nil {
		return shim.Error(err.Error())
	}
	if len(args[0]) <= 0 {
		return shim.Error("Instruction ID must be a non-empty string")
	}
	if len(args[1]) <= 0 {
		return shim.Error("Priority must be a non-empty string")
	}

	refID := args[0]
	priority, err := strconv.Atoi(args[1])
	if err != nil {
		return shim.Error(err.Error())
	}

	isParticipatingInNetting, err := checkMLNettingParticipation(stub)
	if err != nil {
		return shim.Error(err.Error())
	} else if isParticipatingInNetting {
		errMsg := "Error: Multilateral netting is ongoing"
		return shim.Error(errMsg)
	}

	queuedTx, err := getQueueStructFromID(stub, refID)
	if err != nil {
		return shim.Error(err.Error())
	}
	queuedTx.Priority = priority
	queuedTx.UpdateTime, err = getTxTimeStampAsTime(stub)
	if err != nil {
		return shim.Error(err.Error())
	}

	queuedTxAsBytes, err := json.Marshal(queuedTx)
	if err != nil {
		return shim.Error(err.Error())
	}
	err = stub.PutState(queuedTx.RefID, queuedTxAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success(nil)
}

func (t *SimpleChaincode) cancelQueue(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	// queueID
	err := checkArgArrayLength(args, 1)
	if err != nil {
		return shim.Error(err.Error())
	}
	if len(args[0]) <= 0 {
		return shim.Error("Payment instruction ID must be a non-empty string")
	}

	refID := args[0]

	isParticipatingInNetting, err := checkMLNettingParticipation(stub)
	if err != nil {
		return shim.Error(err.Error())
	} else if isParticipatingInNetting {
		errMsg := "Error: Multilateral netting is ongoing"
		return shim.Error(errMsg)
	}

	queuedTx, err := getQueueStructFromID(stub, refID)
	if err != nil {
		return shim.Error(err.Error())
	}
	err = moveQueuedTxStructToCompleted(stub, *queuedTx, "CANCELLED")
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success([]byte("Cancellation Success"))
}

func (t *SimpleChaincode) checkQueueAndSettle(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	var totalSettledAmount float64
	var receiverAccount *Account
	var unsettledTxList []QueuedTransaction

	// accountID
	err := checkArgArrayLength(args, 1)
	if err != nil {
		return shim.Error(err.Error())
	}
	if len(args[0]) <= 0 {
		return shim.Error("Account ID must be a non-empty string")
	}

	accountID := args[0]

	// Access Control
	err = verifyIdentity(stub, accountID, regulatorName)
	if err != nil {
		return shim.Error(err.Error())
	}

	isParticipatingInNetting, err := checkMLNettingParticipation(stub)
	if err != nil {
		return shim.Error(err.Error())
	} else if isParticipatingInNetting {
		errMsg := "Error: Multilateral netting is ongoing"
		return shim.Error(errMsg)
	}

	senderAccount, err := getAccountStructFromID(stub, accountID)
	if err != nil {
		return shim.Error(err.Error())
	}
	accountBal := senderAccount.Amount
	queryString := fmt.Sprintf(
		`{"selector":{
			"docType":"%s",
			"status":"ACTIVE",
			"sender":"%s"
		}}`,
		queuedTxObjectType,
		accountID)
	queueArr, err := getSortedQueues(stub, queryString)
	if err != nil {
		return shim.Error(err.Error())
	}

	totalSettledAmount = 0
	for i, queueElement := range queueArr {
		if queueElement.Amount <= accountBal {
			amount := queueElement.Amount

			err = moveQueuedTxStructToCompleted(stub, queueElement, "SETTLED")
			if err != nil {
				return shim.Error(err.Error())
			}
			totalSettledAmount += amount
			accountBal -= amount
		} else {
			unsettledTxList = queueArr[i:]
			break
		}
	}

	accountList, err := getListOfAccounts(stub)
	if err != nil {
		shim.Error(err.Error())
	}
	if accountList[0] != accountID {
		receiverAccount, err = getAccountStructFromID(stub, accountList[0])
	} else {
		receiverAccount, err = getAccountStructFromID(stub, accountList[1])
	}
	if err != nil {
		shim.Error(err.Error())
	}
	senderAccount.Amount -= totalSettledAmount
	receiverAccount.Amount += totalSettledAmount
	queryString = fmt.Sprintf(
		`{"selector":{
			"docType":"%s",
			"status":"ACTIVE",
			"receiver":"%s"
		}}`,
		queuedTxObjectType,
		accountID)
	incomingQueueArr, err := getSortedQueues(stub, queryString)
	if err != nil {
		return shim.Error(err.Error())
	}

	isNetted, err := tryBilateralNetting(stub,
		senderAccount,
		receiverAccount,
		unsettledTxList,
		incomingQueueArr)
	if err != nil {
		return shim.Error(err.Error())
	}
	respMsg := "Bilateral Netting"
	if !isNetted && totalSettledAmount > 0 {
		err = updateAccountBalance(stub,
			senderAccount.AccountID,
			senderAccount.Currency,
			totalSettledAmount,
			true)
		if err != nil {
			return shim.Error(err.Error())
		}
		err = updateAccountBalance(stub,
			receiverAccount.AccountID,
			receiverAccount.Currency,
			totalSettledAmount,
			false)
		if err != nil {
			return shim.Error(err.Error())
		}
		respMsg = "no bilateral netting"
	}

	return shim.Success([]byte(respMsg))
}

func moveQueuedTxStructToCompleted(
	stub shim.ChaincodeStubInterface,
	queuedTx QueuedTransaction,
	status string) error {

	var err error

	completedTx := CompletedTransaction{}
	completedTx.ObjectType = completedTxObjectType
	completedTx.RefID = queuedTx.RefID
	completedTx.Sender = queuedTx.Sender
	completedTx.Receiver = queuedTx.Receiver
	completedTx.Priority = queuedTx.Priority
	completedTx.Amount = queuedTx.Amount
	completedTx.Currency = queuedTx.Currency
	completedTx.Status = status
	completedTx.CreateTime = queuedTx.CreateTime
	completedTx.UpdateTime, err = getTxTimeStampAsTime(stub)
	if err != nil {
		return err
	}

	completedTxAsBytes, err := json.Marshal(completedTx)
	if err != nil {
		return err
	}
	err = stub.PutState(queuedTx.RefID, completedTxAsBytes)
	if err != nil {
		return err
	}

	return nil
}
