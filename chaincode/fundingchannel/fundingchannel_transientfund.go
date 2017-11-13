package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

func (t *SimpleChaincode) createTransientFund(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	// moveOutInFundID
	err := checkArgArrayLength(args, 2)
	if err != nil {
		return shim.Error(err.Error())
	}
	if len(args[0]) <= 0 {
		return shim.Error("MoveOutInFund ID must be a non-empty string")
	}
	if len(args[1]) <= 0 {
		return shim.Error("Source channel must be a non-empty string")
	}

	moveOutInFundID := args[0]
	sourceChannel := args[1]

	currTime, err := getTxTimeStampAsTime(stub)
	if err != nil {
		return shim.Error(err.Error())
	}

	queryArgs := [][]byte{[]byte("getState"), []byte(moveOutInFundID)}
	moveOutInFundAsBytes, err := crossChannelQuery(stub,
		queryArgs,
		sourceChannel,
		bilateralChaincodeName)
	if err != nil {
		return shim.Error(err.Error())
	}

	moveOutInFund := &TransientFund{}
	err = json.Unmarshal(moveOutInFundAsBytes, moveOutInFund)
	if err != nil {
		return shim.Error(err.Error())
	}

	transientFundAsBytes, err := stub.GetState(moveOutInFund.RefID)
	if err != nil {
		return shim.Error(err.Error())
	} else if transientFundAsBytes != nil {
		errMsg := fmt.Sprintf(
			"Error: Transient fund already exists (%s)",
			moveOutInFund.RefID)
		return shim.Error(errMsg)
	}

	// Owner verification
	ownerID := moveOutInFund.AccountID
	err = verifyIdentity(stub, ownerID)
	if err != nil {
		return shim.Error(err.Error())
	}

	// Update fields before storing
	moveOutInFund.ObjectType = transientFundObjectType
	moveOutInFund.CreateTime = currTime

	transientFundAsBytes, err = json.Marshal(moveOutInFund)
	if err != nil {
		return shim.Error(err.Error())
	}

	err = stub.PutState(moveOutInFundID, transientFundAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success(transientFundAsBytes)
}
