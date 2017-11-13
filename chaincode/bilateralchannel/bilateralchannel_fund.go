package main

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

func (t *SimpleChaincode) createDestroyFund(
	stub shim.ChaincodeStubInterface,
	args []string,
	docType string) pb.Response {

	// AccountID, Currency, Amount
	err := checkArgArrayLength(args, 3)
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

	accountID := args[0]
	currency := strings.ToUpper(args[1])
	amount, err := strconv.ParseFloat(args[2], 64)
	if err != nil {
		return shim.Error("Amount must be a numeric string")
	} else if amount < 0 {
		return shim.Error("Amount must be a positive number")
	}
	currTime, err := getTxTimeStampAsTime(stub)
	if err != nil {
		return shim.Error(err.Error())
	}

	// Access Control
	err = verifyIdentity(stub, regulatorName)
	if err != nil {
		return shim.Error(err.Error())
	}

	if docType == pledgeObjectType || docType == nettingAddObjectType {
		err = updateAccountBalance(stub, accountID, currency, amount, false)
	} else if docType == redeemObjectType || docType == nettingSubtractObjectType {
		err = updateAccountBalance(stub, accountID, currency, amount, true)
	} else {
		errMsg := fmt.Sprintf("Error: Unrecognised docType (%s)", docType)
		return shim.Error(errMsg)
	}
	if err != nil {
		return shim.Error(err.Error())
	}

	txID := sha256.New()
	txID.Write([]byte(accountID + currTime.String()))
	txIDString := fmt.Sprintf("%x", txID.Sum(nil))

	pledgeRedeemFund := PledgeRedeemFund{docType,
		txIDString,
		accountID,
		amount,
		currency,
		currTime}
	pledgeRedeemFundAsBytes, err := json.Marshal(pledgeRedeemFund)
	if err != nil {
		return shim.Error(err.Error())
	}

	err = stub.PutState(txIDString, pledgeRedeemFundAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	return shim.Success(nil)
}

func validateTransaction(
	stub shim.ChaincodeStubInterface,
	args []string) (QueuedTransaction, bool, error) {

	var err error
	newTx := QueuedTransaction{}

	err = checkArgArrayLength(args, 6)
	if err != nil {
		return newTx, false, err
	}
	if len(args[0]) <= 0 {
		return newTx, false, errors.New("sender must be a non-empty string")
	}
	if len(args[1]) <= 0 {
		return newTx, false, errors.New("receiver must be a non-empty string")
	}
	if len(args[2]) <= 0 {
		return newTx, false, errors.New("Priority must be a non-empty string")
	}
	if len(args[3]) <= 0 {
		return newTx, false, errors.New("Amount must be a non-empty string")
	}
	if len(args[4]) <= 0 {
		return newTx, false, errors.New("Currency must be a non-empty string")
	}
	if len(args[5]) <= 0 {
		return newTx, false, errors.New("isPutToQueue flag must be a non-empty string")
	}

	sender := args[0]
	receiver := args[1]
	priority, err := strconv.Atoi(args[2])
	if err != nil {
		return newTx, false, errors.New("priority must be a numeric string")
	}
	amount, err := strconv.ParseFloat(args[3], 64)
	if err != nil {
		return newTx, false, errors.New("Amount must be a numeric string")
	} else if amount < 0 {
		return newTx, false, errors.New("Amount must be a positive value")
	}
	currency := strings.ToUpper(args[4])
	isPutToQueue, err := strconv.ParseBool(strings.ToLower(args[5]))
	if err != nil {
		return newTx, false, errors.New("isPutToQueue must be a boolean string")
	}

	currTime, err := getTxTimeStampAsTime(stub)
	if err != nil {
		return newTx, false, err
	}

	// Access Control
	err = verifyIdentity(stub, sender)
	if err != nil {
		return newTx, false, err
	}

	txID := sha256.New()
	txID.Write([]byte(sender + receiver + currTime.String()))
	txIDString := fmt.Sprintf("%x", txID.Sum(nil))

	newTx.ObjectType = queuedTxObjectType
	newTx.RefID = txIDString
	newTx.Sender = sender
	newTx.Receiver = receiver
	newTx.Priority = priority
	newTx.Nettable = true
	newTx.Amount = amount
	newTx.Currency = currency
	newTx.IsFrozen = false
	newTx.CreateTime = currTime
	newTx.UpdateTime = currTime

	return newTx, isPutToQueue, nil
}

func (t *SimpleChaincode) fundTransfer(
	stub shim.ChaincodeStubInterface,
	args []string) pb.Response {

	//  sender, receiver, priority, amount, currency, isPutToQueue
	newTx, isPutToQueue, err := validateTransaction(stub, args)
	if err != nil {
		return shim.Error(err.Error())
	}

	senderAccount, err := getAccountStructFromID(stub, newTx.Sender)
	if err != nil {
		return shim.Error(err.Error())
	}
	receiverAccount, err := getAccountStructFromID(stub, newTx.Receiver)
	if err != nil {
		return shim.Error(err.Error())
	}

	isParticipatingInNetting, err := checkMLNettingParticipation(stub)
	if err != nil {
		return shim.Error(err.Error())
	}

	isAccountFrozen := false
	if isParticipatingInNetting {
		isAccountFrozen = true
	}

	queryString := fmt.Sprintf(
		`{"selector":{
			"docType":"%s",
			"status":"ACTIVE",
			"sender":"%s",
			"priority":{"$gte":%d}
		}}`,
		queuedTxObjectType,
		newTx.Sender,
		newTx.Priority)
	outgoingQueueArr, err := getSortedQueues(stub, queryString)

	queryString = fmt.Sprintf(
		`{"selector":{
			"docType":"%s",
			"status":"ACTIVE",
			"receiver":"%s"
		}}`,
		queuedTxObjectType,
		newTx.Sender,
		newTx.Priority)
	incomingQueueArr, err := getSortedQueues(stub, queryString)

	isCompleted := false
	isNetted := false
	if isBilateralNetting &&
		len(incomingQueueArr) > 0 &&
		!isAccountFrozen { // Try Bilateral Netting

		queryString = fmt.Sprintf(
			`{"selector":{
				"docType":"%s",
				"status":"ACTIVE",
				"sender":"%s"
			}}`,
			queuedTxObjectType,
			newTx.Sender)
		fullOutgoingQueueArr, err := getSortedQueues(stub, queryString)
		if err != nil {
			return shim.Error(err.Error())
		}
		fullOutgoingQueueArr = append(fullOutgoingQueueArr, newTx)

		isNetted, err = tryBilateralNetting(stub,
			senderAccount,
			receiverAccount,
			fullOutgoingQueueArr,
			incomingQueueArr)
		if err != nil {
			return shim.Error(err.Error())
		}

	} else if senderAccount.Amount >= newTx.Amount &&
		!isPutToQueue &&
		!isAccountFrozen &&
		len(outgoingQueueArr) == 0 { // Check for sufficient liquidity

		err = updateAccountBalance(stub,
			newTx.Sender,
			newTx.Currency,
			newTx.Amount,
			true)
		if err != nil {
			return shim.Error(err.Error())
		}
		err = updateAccountBalance(stub,
			newTx.Receiver,
			newTx.Currency,
			newTx.Amount,
			false)
		if err != nil {
			return shim.Error(err.Error())
		}
		isCompleted = true
	}

	var respMsg string
	if isNetted {
		respMsg = "Success: Bilateral netting is completed"
	} else if isCompleted {
		respMsg = "Success: Transaction is completed"
		err = moveQueuedTxStructToCompleted(stub, newTx, "SETTLED")
		if err != nil {
			return shim.Error(err.Error())
		}

	} else {
		respMsg = "Success: Transaction is Queued"
		newTx.Status = "ACTIVE"

		if isAccountFrozen {
			respMsg = "Success: Transaction is queued and frozen"
			newTx.IsFrozen = true
		}
		newTxAsBytes, err := json.Marshal(newTx)
		if err != nil {
			return shim.Error(err.Error())
		}
		err = stub.PutState(newTx.RefID, newTxAsBytes)
		if err != nil {
			return shim.Error(err.Error())
		}
	}

	respPayload := fmt.Sprintf(
		`{"msg": "%s", "refId": "%s"}`,
		respMsg,
		newTx.RefID)

	return shim.Success([]byte(respPayload))
}

func tryBilateralNetting(
	stub shim.ChaincodeStubInterface,
	senderAccount *Account,
	receiverAccount *Account,
	outgoingQueueArr []QueuedTransaction,
	incomingQueueArr []QueuedTransaction) (bool, error) {

	isCompleted := false
	totalOutgoingAmt, err := getTotalQueuedAmount(outgoingQueueArr)

	receiverBalance := receiverAccount.Amount
	totalNettingAmt := totalOutgoingAmt + receiverBalance

	var nettableQueueArray []QueuedTransaction
	isNettingPossible := false
	for _, queueElement := range incomingQueueArr {
		if totalNettingAmt >= queueElement.Amount {
			nettableQueueArray = append(nettableQueueArray, queueElement)
			totalNettingAmt -= queueElement.Amount
			isNettingPossible = true
		} else {
			break
		}
	}

	if isNettingPossible {
		extraReceiverBalance := totalNettingAmt - receiverBalance
		nettableQueueArray = append(nettableQueueArray, outgoingQueueArr...)

		if extraReceiverBalance == 0 {
			for _, queueElement := range nettableQueueArray {
				err = moveQueuedTxStructToCompleted(stub,
					queueElement,
					"SETTLED")
			}
			isCompleted = true

		} else if extraReceiverBalance > 0 &&
			extraReceiverBalance <= senderAccount.Amount {

			for _, queueElement := range nettableQueueArray {

				err = moveQueuedTxStructToCompleted(stub,
					queueElement,
					"SETTLED")
			}
			err = updateAccountBalance(stub,
				senderAccount.AccountID,
				senderAccount.Currency,
				extraReceiverBalance,
				true)
			if err != nil {
				return isCompleted, err
			}
			err = updateAccountBalance(stub,
				receiverAccount.AccountID,
				receiverAccount.Currency,
				extraReceiverBalance,
				false)
			if err != nil {
				return isCompleted, err
			}
			isCompleted = true

		} else if extraReceiverBalance < 0 &&
			extraReceiverBalance <= receiverAccount.Amount {

			extraReceiverBalance *= -1
			for _, queueElement := range nettableQueueArray {
				err = moveQueuedTxStructToCompleted(stub,
					queueElement,
					"SETTLED")
			}
			err = updateAccountBalance(stub,
				senderAccount.AccountID,
				senderAccount.Currency,
				extraReceiverBalance,
				false)
			if err != nil {
				return isCompleted, err
			}
			err = updateAccountBalance(stub,
				receiverAccount.AccountID,
				receiverAccount.Currency,
				extraReceiverBalance,
				true)
			if err != nil {
				return isCompleted, err
			}
			isCompleted = true
		}
	}
	return isCompleted, nil
}
