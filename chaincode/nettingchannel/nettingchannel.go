package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

const timeLayout string = "2006-01-02T15:04:05.999Z"
const cycleExpiryMinutes float64 = 5
const regulatorName string = "MASGSGSG"

func main() {
	err := shim.Start(new(SimpleChaincode))
	if err != nil {
		fmt.Printf("Error starting Simple chaincode: %s", err)
	}
}

func (t *SimpleChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	currTime, err := getTxTimeStampAsTime(stub)
	if err != nil {
		return shim.Error(err.Error())
	}
	bankRequestMap := make(map[string]BankRequest)

	nettingCycle := NettingCycle{}
	nettingCycle.ObjectType = nettingCycleObjectType
	nettingCycle.CycleID = 0
	nettingCycle.Status = "SETTLED"
	nettingCycle.BankRequests = bankRequestMap
	nettingCycle.Created = currTime
	nettingCycle.Updated = currTime

	nettingCycleAsBytes, err := json.Marshal(nettingCycle)
	if err != nil {
		return shim.Error(err.Error())
	}
	err = stub.PutState(nettingCycleObjectType, nettingCycleAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success(nil)
}

func (t *SimpleChaincode) Invoke(
	stub shim.ChaincodeStubInterface) pb.Response {

	function, args := stub.GetFunctionAndParameters()
	fmt.Println("invoke MultilateralChannel is running " + function)

	if function == "pingChaincode" {
		return t.pingChaincode(stub)
	} else if function == "pingChaincodeQuery" {
		return t.pingChaincodeQuery(stub)

		// Functions for initiation/participation
	} else if function == "conductMLNetting" {
		return t.conductMLNetting(stub, args)
	} else if function == "queryOngoingMLNetting" {
		return t.queryOngoingMLNetting(stub)

		// Functions for updating netting cycle status
	} else if function == "expireOngoingMLNetting" {
		return t.expireOngoingMLNetting(stub)
	} else if function == "settleOngoingMLNetting" {
		return t.updateOngoingMLNettingStatus(stub, "SETTLED")
	} else if function == "failOngoingMLNetting" {
		return t.updateOngoingMLNettingStatus(stub, "FAILED")
	} else if function == "getNonNettableTxList" {
		return t.getNonNettableTxList(stub)

		// Other Functions
	} else if function == "checkParticipation" {
		return t.checkParticipation(stub, args)
	} else if function == "getBilateralNettableTxList" {
		return t.getBilateralNettableTxList(stub, args)
	} else if function == "resetChannel" {
		return t.resetChannel(stub)
	}

	fmt.Println("Netting channel chaincode invocation did not find func: " + function) //error
	return shim.Error("Received unknown function")
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

func (t *SimpleChaincode) resetChannel(
	stub shim.ChaincodeStubInterface) pb.Response {

	err := resetNettingCycle(stub)
	if err != nil {
		return shim.Error(err.Error())
	}
	err = resetBankRequests(stub)
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success(nil)
}
