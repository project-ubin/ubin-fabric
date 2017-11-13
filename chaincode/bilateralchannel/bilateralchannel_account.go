package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

func (t *SimpleChaincode) initAccount(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	// AccountID, Currency, Amount, Status
	err := checkArgArrayLength(args, 4)
	if err != nil {
		return shim.Error(err.Error())
	}
	if len(args[0]) <= 0 {
		return shim.Error("AccountID must be a non-empty string")
	}
	if len(args[1]) <= 0 {
		return shim.Error("Currency must be a non-empty string")
	}
	if len(args[2]) <= 0 {
		return shim.Error("Amount must be a non-empty string")
	}
	if len(args[3]) <= 0 {
		return shim.Error("Status must be a non-empty string")
	}

	accountId := args[0]
	currency := strings.ToUpper(args[1])
	amount, err := strconv.ParseFloat(args[2], 64)
	status := strings.ToUpper(args[3])
	if err != nil {
		return shim.Error("amount must be a numeric string")
	}

	accountAsBytes, err := stub.GetState(accountId)
	if err != nil {
		return shim.Error(err.Error())
	} else if accountAsBytes != nil {
		errMsg := fmt.Sprintf(
			"Error: This account already exists (%s)",
			accountId)
		return shim.Error(errMsg)
	}

	account := Account{}
	account.ObjectType = accountObjectType
	account.AccountID = accountId
	account.Currency = currency
	account.Amount = amount
	account.Status = status

	accountAsBytes, err = json.Marshal(account)
	if err != nil {
		return shim.Error(err.Error())
	}

	err = stub.PutState(accountId, accountAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(accountAsBytes)
}

func (t *SimpleChaincode) getChannelLiquidity(
	stub shim.ChaincodeStubInterface) pb.Response {

	queryString := fmt.Sprintf(
		`{"selector":{"docType":"%s"}}`,
		accountObjectType)
	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		shim.Error(err.Error())
	}
	defer resultsIterator.Close()

	var totalLiquidity float64
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(err.Error())
		}
		jsonByteObj := queryResponse.Value
		account := Account{}
		json.Unmarshal(jsonByteObj, &account)
		totalLiquidity += account.Amount
	}
	totalLiquidityString := strconv.FormatFloat(totalLiquidity, 'f', -1, 64)
	return shim.Success([]byte(totalLiquidityString))
}

func (t *SimpleChaincode) updateAccount(
	stub shim.ChaincodeStubInterface,
	accountID string,
	currency string,
	amount float64,
	status string) pb.Response {

	account, err := getAccountStructFromID(stub, accountID)
	if err != nil {
		return shim.Error(err.Error())
	} else if account.Currency != currency {
		return shim.Error("Currency provided does not match with currency set by account")
	}

	account.Amount = amount
	account.Status = status
	accountAsBytes, err := json.Marshal(account)
	if err != nil {
		return shim.Error(err.Error())
	}

	err = stub.PutState(accountID, accountAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success(accountAsBytes)
}

func getListOfAccounts(
	stub shim.ChaincodeStubInterface) ([]string, error) {

	var accountList []string

	queryString := fmt.Sprintf(
		`{"selector":{"docType":"%s"}}`,
		accountObjectType)
	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return accountList, err
	}
	defer resultsIterator.Close()

	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return accountList, err
		}
		jsonByteObj := queryResponse.Value
		account := Account{}
		json.Unmarshal(jsonByteObj, &account)
		accountList = append(accountList, account.AccountID)
	}
	return accountList, nil
}

func updateAccountBalance(
	stub shim.ChaincodeStubInterface,
	accountID string,
	currency string,
	amount float64,
	isMinus bool) error {

	var err error

	if len(accountID) <= 0 {
		return errors.New("AccountID must be a non-empty string")
	}
	if len(currency) <= 0 {
		return errors.New("Currency must be a non-empty string")
	}
	if amount < 0 {
		return errors.New("Amount must be a positive value")
	}

	account, err := getAccountStructFromID(stub, accountID)
	if err != nil {
		return errors.New(err.Error())
	}

	if account.Status == "PAUSED" {
		return errors.New("Account Status is : " + account.Status)
	} else if account.Currency != currency {
		errStr := fmt.Sprintf(
			"Currency set for account [%s] does not match currency provided [%s]",
			account.Currency,
			currency)
		return errors.New(errStr)
	}

	if isMinus {
		if amount > account.Amount {
			return errors.New("Amount to be deducted from account cannot exceed account balance")
		} else {
			account.Amount -= amount
		}
	} else {
		account.Amount += amount
	}

	UpdatedAcctAsBytes, err := json.Marshal(account)
	if err != nil {
		return err
	}

	err = stub.PutState(accountID, UpdatedAcctAsBytes)
	if err != nil {
		return err
	}

	return nil
}

func (t *SimpleChaincode) deleteAccount(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	err := checkArgArrayLength(args, 1)
	if err != nil {
		return shim.Error(err.Error())
	}

	accountId := args[0]

	// Access Control
	err = verifyIdentity(stub, regulatorName)
	if err != nil {
		return shim.Error(err.Error())
	}

	valAsbytes, err := stub.GetState(accountId)
	if err != nil {
		errMsg := fmt.Sprintf(
			"Error: Failed to get state for account (%s)",
			accountId)
		return shim.Error(errMsg)
	} else if valAsbytes == nil {
		errMsg := fmt.Sprintf(
			"Error: Account does not exist (%s)",
			accountId)
		return shim.Error(errMsg)
	}

	err = stub.DelState(accountId)
	if err != nil {
		return shim.Error("Failed to delete state:" + err.Error())
	}
	return shim.Success(nil)
}

func (t *SimpleChaincode) updateAccountStatus(
	stub shim.ChaincodeStubInterface,
	args []string,
	status string) pb.Response {

	err := checkArgArrayLength(args, 1)
	if err != nil {
		return shim.Error(err.Error())
	}
	if len(args[0]) <= 0 {
		return shim.Error("AccountID must be a non-empty string")
	}

	accountID := args[0]
	account, err := getAccountStructFromID(stub, accountID)
	account.Status = status

	accountAsBytes, err := json.Marshal(account)
	if err != nil {
		return shim.Error(err.Error())
	}
	err = stub.PutState(accountID, accountAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(nil)
}
