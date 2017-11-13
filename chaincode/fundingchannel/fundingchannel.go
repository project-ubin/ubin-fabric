package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

const bilateralChaincodeName string = "bilateralchannel_cc"

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
	fmt.Println("invoke MultilateralChannel is running " + function)

	if function == "pingChaincode" {
		return t.pingChaincode(stub)
	} else if function == "pingChaincodeQuery" {
		return t.pingChaincodeQuery(stub)

		// Transient fund functions
	} else if function == "createTransientFund" {
		return t.createTransientFund(stub, args)

		// Other Functions
	} else if function == "getState" {
		return t.getStateAsBytes(stub, args)
	} else if function == "resetChannel" {
		return t.resetChannel(stub)
	}

	fmt.Println("MultilateralChannel invoke did not find func: " + function) //error
	return shim.Error("Received unknown function")
}

func (t *SimpleChaincode) pingChaincode(stub shim.ChaincodeStubInterface) pb.Response {
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

func (t *SimpleChaincode) resetChannel(stub shim.ChaincodeStubInterface) pb.Response {
	err := resetAllTransientFund(stub)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(nil)
}
