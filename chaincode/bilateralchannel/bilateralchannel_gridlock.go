package main

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

func (t *SimpleChaincode) settleMLNettingInstructions(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	err := checkArgArrayLength(args, 1)
	if err != nil {
		return shim.Error(err.Error())
	}

	if len(args[0]) <= 0 {
		return shim.Error("Nettable list must be a non-empty string")
	}

	var nettableTxList []string

	nettableTxListAsBytes := []byte(args[0])

	err = json.Unmarshal(nettableTxListAsBytes, &nettableTxList)
	if err != nil {
		return shim.Error(err.Error())
	}

	isWentToLoop := false
	for _, txID := range nettableTxList {
		isWentToLoop = true

		queuedTx, err := getQueueStructFromID(stub, txID)
		if err != nil {
			return shim.Error(err.Error())
		}
		err = moveQueuedTxStructToCompleted(stub, *queuedTx, "SETTLED")
		if err != nil {
			return shim.Error(err.Error())
		}
	}

	resp := SettleMLNettingResp{
		nettableTxList,
		isWentToLoop}
	respAsBytes, err := json.Marshal(resp)
	if err != nil {
		return shim.Error(err.Error())
	}

	_, err = unfreezeAllQueues(stub)
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success(respAsBytes)
}

func (t *SimpleChaincode) unfreezeAllTransactions(
	stub shim.ChaincodeStubInterface) pb.Response {

	frozenQueuesArr, err := unfreezeAllQueues(stub)
	if err != nil {
		return shim.Error(err.Error())
	}

	frozenQueuesArrAsBytes, err := json.Marshal(frozenQueuesArr)
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success(frozenQueuesArrAsBytes)
}

func unfreezeAllQueues(
	stub shim.ChaincodeStubInterface) ([]QueuedTransaction, error) {

	var frozenQueuesArr []QueuedTransaction
	queryString := fmt.Sprintf(
		`{"selector":{
			"docType":"%s",
			"isFrozen":true
		}}`,
		queuedTxObjectType)

	frozenQueuesArr, err := getSortedQueues(stub, queryString)
	if err != nil {
		return frozenQueuesArr, err
	}
	for _, queuedTx := range frozenQueuesArr {
		queuedTx.IsFrozen = false
		queuedTxAsBytes, err := json.Marshal(queuedTx)
		err = stub.PutState(queuedTx.RefID, queuedTxAsBytes)
		if err != nil {
			return frozenQueuesArr, err
		}
	}

	return frozenQueuesArr, nil
}

func checkMLNettingParticipation(
	stub shim.ChaincodeStubInterface) (bool, error) {

	var isParticipating bool

	accountList, err := getListOfAccounts(stub)
	if err != nil {
		return isParticipating, err
	}

	account1ID := accountList[0]
	account2ID := accountList[1]

	queryArgs := [][]byte{
		[]byte("checkParticipation"),
		[]byte(account1ID),
		[]byte(account2ID)}
	isParticipatingAsBytes, err := crossChannelQuery(stub,
		queryArgs,
		nettingChannelName,
		nettingChaincodeName)
	if err != nil {
		return isParticipating, err
	}
	isParticipating, err = strconv.ParseBool(string(isParticipatingAsBytes))
	if err != nil {
		return isParticipating, err
	}

	return isParticipating, nil
}
