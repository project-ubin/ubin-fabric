package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

func (t *SimpleChaincode) moveOutFund(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	// AccountID, targetChannel, amount, currency
	err := checkArgArrayLength(args, 4)
	if err != nil {
		return shim.Error(err.Error())
	}
	if len(args[0]) <= 0 {
		return shim.Error("AccountID must be a non-empty string")
	}
	if len(args[1]) <= 0 {
		return shim.Error("Target channel must be a non-empty string")
	}
	if len(args[2]) <= 0 {
		return shim.Error("Amount must be a non-empty string")
	}
	if len(args[3]) <= 0 {
		return shim.Error("Currency must be a non-empty string")
	}

	accountID := args[0]
	targetChannel := args[1]
	amount, err := strconv.ParseFloat(args[2], 64)
	if err != nil {
		return shim.Error("Amount must be a numeric string")
	} else if amount < 0 {
		return shim.Error("Amount must be a positive value")
	}
	currency := strings.ToUpper(args[3])

	currTime, err := getTxTimeStampAsTime(stub)
	if err != nil {
		return shim.Error(err.Error())
	}
	currChannel, err := getChannelName(stub)
	if err != nil {
		return shim.Error(err.Error())
	}

	// Access Control
	err = verifyIdentity(stub, accountID)
	if err != nil {
		return shim.Error(err.Error())
	}

	// ID generation
	moveOutInFundID := sha256.New()
	moveOutInFundID.Write([]byte(currChannel + targetChannel + currTime.String()))
	moveOutInFundIDString := fmt.Sprintf("%x", moveOutInFundID.Sum(nil))

	// Check if move out request is already created
	moveOutInFundAsBytes, err := stub.GetState(moveOutInFundIDString)
	if err != nil {
		return shim.Error(err.Error())
	} else if moveOutInFundAsBytes != nil {
		errMsg := fmt.Sprintf(
			"Error: moveOutInFund already exists (%s)",
			moveOutInFundIDString)
		return shim.Error(errMsg)
	}

	err = updateAccountBalance(stub, accountID, currency, amount, true)
	if err != nil {
		return shim.Error(err.Error())
	}

	moveOutInFund := &MoveOutInFund{}
	moveOutInFund.ObjectType = moveOutObjectType
	moveOutInFund.RefID = moveOutInFundIDString
	moveOutInFund.AccountID = accountID
	moveOutInFund.ChannelFrom = currChannel
	moveOutInFund.ChannelTo = targetChannel
	moveOutInFund.Amount = amount
	moveOutInFund.Currency = currency
	moveOutInFund.CreateTime = currTime

	moveOutInFundAsBytes, err = json.Marshal(moveOutInFund)
	if err != nil {
		return shim.Error(err.Error())
	}

	err = stub.PutState(moveOutInFundIDString, moveOutInFundAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success([]byte(moveOutInFundIDString))
}

func (t *SimpleChaincode) moveInFund(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	// transientFundID
	err := checkArgArrayLength(args, 1)
	if err != nil {
		return shim.Error(err.Error())
	}
	if len(args[0]) <= 0 {
		return shim.Error("Transient fund ID must be a non-empty string")
	}

	transientFundID := args[0]

	currTime, err := getTxTimeStampAsTime(stub)
	if err != nil {
		return shim.Error(err.Error())
	}
	currChannel, err := getChannelName(stub)
	if err != nil {
		return shim.Error(err.Error())
	}

	queryArgs := [][]byte{[]byte("getState"), []byte(transientFundID)}
	transientFundAsBytes, err := crossChannelQuery(stub,
		queryArgs,
		fundingChannelName,
		fundingChaincodeName)
	if err != nil {
		return shim.Error(err.Error())
	}

	transientFund := &MoveOutInFund{}
	err = json.Unmarshal(transientFundAsBytes, transientFund)
	if err != nil {
		return shim.Error(err.Error())
	}

	moveOutInFundAsBytes, err := stub.GetState(transientFund.RefID)
	if err != nil {
		return shim.Error(err.Error())
	} else if moveOutInFundAsBytes != nil {
		errMsg := fmt.Sprintf(
			"Error: moveOutInFund already exists (%s)",
			transientFund.RefID)
		return shim.Error(errMsg)
	}

	// Owner verification
	ownerID := transientFund.AccountID
	err = verifyIdentity(stub, ownerID)
	if err != nil {
		return shim.Error(err.Error())
	}

	// Channel verification
	targetChannel := transientFund.ChannelTo
	if targetChannel != currChannel {
		errMsg := fmt.Sprintf(
			"Error: Target channel of transient fund (%s) does not match current channel (%s)",
			targetChannel,
			currChannel)
		return shim.Error(errMsg)
	}

	err = updateAccountBalance(stub,
		ownerID,
		transientFund.Currency,
		transientFund.Amount,
		false)
	if err != nil {
		return shim.Error(err.Error())
	}

	// Update fields before storing
	transientFund.ObjectType = moveInObjectType
	transientFund.CreateTime = currTime

	moveOutInFundAsBytes, err = json.Marshal(transientFund)
	if err != nil {
		return shim.Error(err.Error())
	}

	err = stub.PutState(transientFundID, moveOutInFundAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success(moveOutInFundAsBytes)
}
