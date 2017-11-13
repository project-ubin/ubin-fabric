package main

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

func (t *SimpleChaincode) conductMLNetting(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	//  nettingCycleID, bankID, nettableArray, nonNettableArray, nettedValue
	var nettingCycleID int

	err := checkArgArrayLength(args, 5)
	if err != nil {
		return shim.Error(err.Error())
	}
	if len(args[1]) <= 0 {
		return shim.Error("Bank ID must be a non-empty string")
	}
	if len(args[2]) <= 0 {
		return shim.Error("Nettable array must be a non-empty string")
	}
	if len(args[3]) <= 0 {
		return shim.Error("Non-nettable array must be a non-empty string")
	}
	if len(args[4]) <= 0 {
		return shim.Error("nettedValue must be a non-empty string")
	}

	bankID := args[1]
	nettableArray, err := convertStringToArrayOfStrings(args[2])
	if err != nil {
		return shim.Error(err.Error())
	}
	nonNettableArray, err := convertStringToArrayOfStrings(args[3])
	if err != nil {
		return shim.Error(err.Error())
	}
	nettedValue, err := strconv.ParseFloat(args[4], 64)
	if err != nil {
		return shim.Error("Amount must be a numeric string")
	}

	err = verifyIdentity(stub, bankID)
	if err != nil {
		return shim.Error(err.Error())
	}

	currTime, err := getTxTimeStampAsTime(stub)
	if err != nil {
		return shim.Error(err.Error())
	}

	nettingCycle, err := getCurrentNettingCycle(stub)
	if err != nil {
		return shim.Error(err.Error())
	}

	nettingCycleID = -1
	if len(args[0]) > 0 {
		nettingCycleID, err = strconv.Atoi(args[0])
		if err != nil {
			return shim.Error("Netting cycle ID must be a numeric string")
		} else if nettingCycleID <= 0 {
			return shim.Error("Netting cycle ID must be a positive value")
		}
		if nettingCycle.CycleID != nettingCycleID {
			return shim.Error("Cycle ID does not match current netting cycle")
		}
	}

	bankRequestID := args[0] + bankID
	bankRequest, err := createBankRequest(stub,
		bankRequestID,
		bankID,
		nettedValue,
		nettableArray,
		nonNettableArray)

	if nettingCycle.Status == "ACHIEVED" ||
		nettingCycle.Status == "INVALID" { // Not settled by central bank yet
		return shim.Error("Unable to start new netting cycle: Last cycle not settled yet.")
	}

	if len(args[0]) == 0 && nettingCycle.Status != "ONGOING" { // Start new netting cycle
		bankRequestMap := make(map[string]BankRequest)
		bankRequestMap[bankID] = *bankRequest

		nettingCycle.CycleID = nettingCycle.CycleID + 1
		nettingCycle.Status = "ONGOING"
		nettingCycle.Created = currTime
		nettingCycle.Updated = currTime
		nettingCycle.BankRequests = bankRequestMap

	} else { // Participate in ongoing cycle
		isExpired, err := checkOngoingMLNettingExpiry(stub)
		if err != nil {
			return shim.Error(err.Error())
		} else if isExpired {
			respMsg := "Netting cycle is expired"
			return shim.Success([]byte(respMsg))
		}

		if nettingCycle.CycleID != nettingCycleID {
			return shim.Error(
				"Netting cycle ID provided does not match current netting cycle")
		}
		nettingCycle.BankRequests[bankID] = *bankRequest
		nettingCycle.Updated = currTime

		var totalNettedValue float64
		nettableTxMap := make(map[string]int)
		for _, request := range nettingCycle.BankRequests {
			totalNettedValue += request.NetValue

			requestNettableList := request.NettableList
			for _, txID := range requestNettableList {
				nettableTxMap[txID]++
				if nettableTxMap[txID] > 2 {
					errMsg := fmt.Sprintf(
						"Error: transaction %s has been proposed more than twice",
						txID)
					return shim.Error(errMsg)
				}
			}
		}
		isNettable := false
		for _, txOccurance := range nettableTxMap { // Check for transaction pairs
			isNettable = true
			if txOccurance != 2 {
				isNettable = false
				break
			}
		}
		if isNettable {
			if totalNettedValue != 0 {
				nettingCycle.Status = "INVALID"
			} else {
				nettingCycle.Status = "ACHIEVED"
			}
		}
	}

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

func (t *SimpleChaincode) expireOngoingMLNetting(
	stub shim.ChaincodeStubInterface) pb.Response {

	isExpired, err := checkOngoingMLNettingExpiry(stub)
	if err != nil {
		return shim.Error(err.Error())
	}

	respMsg := "Ongoing netting cycle is still valid"
	if isExpired {
		respMsg = "Netting cycle is now expired"
	}
	return shim.Success([]byte(respMsg))
}

func checkOngoingMLNettingExpiry(
	stub shim.ChaincodeStubInterface) (bool, error) {

	isExpired := false
	currTime, err := getTxTimeStampAsTime(stub)
	if err != nil {
		return isExpired, err
	}

	nettingCycle, err := getCurrentNettingCycle(stub)
	if err != nil {
		return isExpired, err
	}
	cycleTimeElapsed := currTime.Sub(nettingCycle.Created)
	if cycleTimeElapsed.Minutes() >= cycleExpiryMinutes &&
		nettingCycle.Status == "ONGOING" {
		nettingCycle.Status = "EXPIRED"
		nettingCycleAsBytes, err := json.Marshal(nettingCycle)
		if err != nil {
			return isExpired, err
		}
		err = stub.PutState(nettingCycleObjectType, nettingCycleAsBytes)
		if err != nil {
			return isExpired, err
		}
		isExpired = true
	}
	return isExpired, err
}

func (t *SimpleChaincode) updateOngoingMLNettingStatus(
	stub shim.ChaincodeStubInterface,
	status string) pb.Response {

	currTime, err := getTxTimeStampAsTime(stub)
	if err != nil {
		return shim.Error(err.Error())
	}
	nettingCycle, err := getCurrentNettingCycle(stub)
	if err != nil {
		return shim.Error(err.Error())
	}
	nettingCycle.Status = status
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

func (t *SimpleChaincode) queryOngoingMLNetting(stub shim.ChaincodeStubInterface) pb.Response {
	nettingCycleAsBytes, err := stub.GetState(nettingCycleObjectType)
	if err != nil {
		return shim.Error("Error: Failed to get state for current nettingcycle")
	} else if nettingCycleAsBytes == nil {
		return shim.Error("Error: netting cycle does not exist")
	}
	return shim.Success(nettingCycleAsBytes)
}

func (t *SimpleChaincode) getBilateralNettableTxList(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	err := checkArgArrayLength(args, 2)
	if err != nil {
		return shim.Error(err.Error())
	}
	if len(args[0]) <= 0 {
		return shim.Error("Bank 1 ID must be a non-empty string")
	}
	if len(args[1]) <= 0 {
		return shim.Error("Bank 2 ID must be a non-empty string")
	}

	bank1ID := args[0]
	bank2ID := args[1]

	nettingCycle, err := getCurrentNettingCycle(stub)
	if err != nil {
		return shim.Error(err.Error())
	}
	if nettingCycle.Status != "ACHIEVED" {
		errMsg := "Error: Current netting cycle is not achieved"
		return shim.Error(errMsg)
	}

	bank1Request := nettingCycle.BankRequests[bank1ID]
	bank2Request := nettingCycle.BankRequests[bank2ID]

	nettableArray := bank1Request.NettableList
	nettableArray = append(bank2Request.NettableList, nettableArray...)

	nettableTxMap := make(map[string]int)
	for _, txID := range nettableArray {
		nettableTxMap[txID]++
	}

	var bilateralNettableArr []string
	for txID, txOccurance := range nettableTxMap { // Check for transaction pairs
		if txOccurance == 2 {
			bilateralNettableArr = append(bilateralNettableArr, txID)
		}
	}
	bilateralNettableArrByte, err := json.Marshal(bilateralNettableArr)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(bilateralNettableArrByte)
}

func (t *SimpleChaincode) checkParticipation(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	err := checkArgArrayLength(args, 2)
	if err != nil {
		return shim.Error(err.Error())
	}
	if len(args[0]) <= 0 {
		return shim.Error("Bank 1 ID must be a non-empty string")
	}
	if len(args[1]) <= 0 {
		return shim.Error("Bank 2 ID must be a non-empty string")
	}

	bank1ID := args[0]
	bank2ID := args[1]

	nettingCycle, err := getCurrentNettingCycle(stub)
	if err != nil {
		return shim.Error(err.Error())
	}

	_, isBank1Exist := nettingCycle.BankRequests[bank1ID]
	_, isBank2Exist := nettingCycle.BankRequests[bank2ID]

	isParticipating := false
	if (nettingCycle.Status == "ONGOING" ||
		nettingCycle.Status == "ACHIEVED") &&
		(isBank1Exist || isBank2Exist) {

		isParticipating = true
	}

	return shim.Success([]byte(strconv.FormatBool(isParticipating)))
}

func (t *SimpleChaincode) getNonNettableTxList(
	stub shim.ChaincodeStubInterface) pb.Response {

	nettingCycle, err := getCurrentNettingCycle(stub)
	if err != nil {
		return shim.Error(err.Error())
	}
	nonNettableMap := make(map[string]int)
	for _, request := range nettingCycle.BankRequests {
		requestNonNettableList := request.NonNettableList
		for _, txID := range requestNonNettableList {
			nonNettableMap[txID]++
		}
	}
	var nonNettableArray []string
	for txID := range nonNettableMap {
		nonNettableArray = append(nonNettableArray, txID)
	}
	nonNettableArrayByte, err := json.Marshal(nonNettableArray)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(nonNettableArrayByte)
}

func resetNettingCycle(
	stub shim.ChaincodeStubInterface) error {

	nettingCycle, err := getCurrentNettingCycle(stub)
	if err != nil {
		return err
	}
	bankRequestMap := make(map[string]BankRequest)
	nettingCycle.CycleID = 0
	nettingCycle.Status = "SETTLED"
	nettingCycle.BankRequests = bankRequestMap

	nettingCycleAsBytes, err := json.Marshal(nettingCycle)
	if err != nil {
		return err
	}
	err = stub.PutState(nettingCycleObjectType, nettingCycleAsBytes)
	if err != nil {
		return err
	}
	return nil
}
