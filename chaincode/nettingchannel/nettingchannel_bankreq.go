package main

import (
	"encoding/json"
	"fmt"
	"github.com/hyperledger/fabric/core/chaincode/shim"
)

func getAllBankRequestStruct(
	stub shim.ChaincodeStubInterface) ([]BankRequest, error) {

	queryString := fmt.Sprintf(
		`{"selector":{"docType":"%s"}}`,
		bankRequestObjectType)
	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	bankRequestArr := []BankRequest{}
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		bankRequestAsBytes := queryResponse.Value
		bankRequest := BankRequest{}
		json.Unmarshal(bankRequestAsBytes, &bankRequest)
		bankRequestArr = append(bankRequestArr, bankRequest)
	}
	return bankRequestArr, nil
}

func createBankRequest(
	stub shim.ChaincodeStubInterface,
	requestID string,
	bankID string,
	netValue float64,
	nettableList []string,
	nonNettableList []string) (*BankRequest, error) {

	bankRequest := &BankRequest{}
	bankRequest.ObjectType = bankRequestObjectType
	bankRequest.bankRequestID = requestID
	bankRequest.BankID = bankID
	bankRequest.NetValue = netValue
	bankRequest.NettableList = nettableList
	bankRequest.NonNettableList = nonNettableList

	bankRequestAsBytes, err := json.Marshal(bankRequest)
	if err != nil {
		return bankRequest, err
	}
	err = stub.PutState(requestID, bankRequestAsBytes)
	if err != nil {
		return bankRequest, err
	}

	return bankRequest, nil
}

func resetBankRequests(stub shim.ChaincodeStubInterface) error {
	bankRequestArr, err := getAllBankRequestStruct(stub)
	if err != nil {
		return err
	}
	for _, bankRequest := range bankRequestArr {
		err = stub.DelState(bankRequest.bankRequestID)
		if err != nil {
			return err
		}
	}
	return nil
}
