package main

import (
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/golang/protobuf/proto"
	"github.com/golang/protobuf/ptypes"
	"github.com/hyperledger/fabric/core/chaincode/shim"
	"github.com/hyperledger/fabric/protos/common"
	mspprotos "github.com/hyperledger/fabric/protos/msp"
	"github.com/hyperledger/fabric/protos/peer"
)

// ***********************************************************
// Struct Getter Functions
// ***********************************************************

func getAccountStructFromID(
	stub shim.ChaincodeStubInterface,
	accountID string) (*Account, error) {

	var errMsg string
	account := &Account{}
	accountAsBytes, err := stub.GetState(accountID)
	if err != nil {
		return account, err
	} else if accountAsBytes == nil {
		errMsg = fmt.Sprintf("Error: Account does not exist (%s)", accountID)
		return account, errors.New(errMsg)
	}
	err = json.Unmarshal([]byte(accountAsBytes), account)
	if err != nil {
		return account, err
	}
	return account, nil
}

func getAccountArrayFromQuery(
	stub shim.ChaincodeStubInterface,
	queryString string) ([]Account, error) {

	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	accountArr := []Account{}
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		accountAsBytes := queryResponse.Value
		account := Account{}
		json.Unmarshal(accountAsBytes, &account)
		accountArr = append(accountArr, account)
	}
	return accountArr, nil
}

func getQueueStructFromID(
	stub shim.ChaincodeStubInterface,
	queueID string) (*QueuedTransaction, error) {

	var errMsg string
	queue := &QueuedTransaction{}
	queueAsBytes, err := stub.GetState(queueID)
	if err != nil {
		return queue, err
	} else if queueAsBytes == nil {
		errMsg = fmt.Sprintf("Error: QueuedTransaction ID does not exist: %s", queueID)
		return queue, errors.New(errMsg)
	}
	err = json.Unmarshal([]byte(queueAsBytes), queue)
	if err != nil {
		return queue, err
	}
	return queue, nil
}

func getQueueArrayFromQuery(
	stub shim.ChaincodeStubInterface,
	queryString string) ([]QueuedTransaction, error) {

	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	queueArr := []QueuedTransaction{}
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		jsonByteObj := queryResponse.Value
		queue := QueuedTransaction{}
		json.Unmarshal(jsonByteObj, &queue)
		queueArr = append(queueArr, queue)
	}
	return queueArr, nil
}

func getSortedQueues(
	stub shim.ChaincodeStubInterface,
	queryString string) ([]QueuedTransaction, error) {

	queryResults, err := getQueueArrayFromQuery(stub, queryString)
	if err != nil {
		return nil, err
	}
	queryResults = sortQueues(queryResults)
	return queryResults, nil
}

func getCompletedTxArrFromQuery(
	stub shim.ChaincodeStubInterface,
	queryString string) ([]CompletedTransaction, error) {

	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	completedTransactionArr := []CompletedTransaction{}
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		completedTransactionAsBytes := queryResponse.Value
		completedTransaction := CompletedTransaction{}
		json.Unmarshal(completedTransactionAsBytes, &completedTransaction)
		completedTransactionArr = append(completedTransactionArr, completedTransaction)
	}

	return completedTransactionArr, nil
}

func getMoveOutInFundStructFromID(
	stub shim.ChaincodeStubInterface,
	moveOutInFundID string) (*MoveOutInFund, error) {

	moveOutInFund := &MoveOutInFund{}
	moveOutInFundAsBytes, err := stub.GetState(moveOutInFundID)
	if err != nil {
		return moveOutInFund, err
	} else if moveOutInFundAsBytes == nil {
		errMsg := fmt.Sprintf("Error: MoveOutInFund (%s) does not exist", moveOutInFundID)
		return moveOutInFund, errors.New(errMsg)
	}
	err = json.Unmarshal([]byte(moveOutInFundAsBytes), moveOutInFund)
	if err != nil {
		return moveOutInFund, err
	}
	return moveOutInFund, nil
}

func getMoveOutInFundArrayFromQuery(
	stub shim.ChaincodeStubInterface,
	queryString string) ([]MoveOutInFund, error) {

	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	moveOutInFundArr := []MoveOutInFund{}
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		jsonByteObj := queryResponse.Value
		moveOutInFund := MoveOutInFund{}
		json.Unmarshal(jsonByteObj, &moveOutInFund)
		moveOutInFundArr = append(moveOutInFundArr, moveOutInFund)
	}
	return moveOutInFundArr, nil
}

func getPledgeRedeemFundArrFromQuery(
	stub shim.ChaincodeStubInterface,
	queryString string) ([]PledgeRedeemFund, error) {

	resultsIterator, err := stub.GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	pledgeRedeemFundArr := []PledgeRedeemFund{}
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		jsonByteObj := queryResponse.Value
		pledgeRedeemFund := PledgeRedeemFund{}
		json.Unmarshal(jsonByteObj, &pledgeRedeemFund)
		pledgeRedeemFundArr = append(pledgeRedeemFundArr, pledgeRedeemFund)
	}
	return pledgeRedeemFundArr, nil
}

// ***********************************************************
// Reset Functions
// ***********************************************************

func resetAllAccounts(
	stub shim.ChaincodeStubInterface) error {

	queryString := fmt.Sprintf(`{
		"selector":{"docType":"%s"}}`,
		accountObjectType)
	accountArr, err := getAccountArrayFromQuery(stub, queryString)
	if err != nil {
		return err
	}
	for _, account := range accountArr {
		account.Status = "NORMAL"
		account.Amount = 0
		UpdatedAcctAsBytes, err := json.Marshal(account)
		if err != nil {
			return err
		}
		err = stub.PutState(account.AccountID, UpdatedAcctAsBytes)
		if err != nil {
			return err
		}
	}
	return nil
}

func resetAllQueues(
	stub shim.ChaincodeStubInterface) error {

	queryString := fmt.Sprintf(
		`{"selector":{"docType":"%s"}}`,
		queuedTxObjectType)
	queueArr, err := getQueueArrayFromQuery(stub, queryString)
	if err != nil {
		return err
	}
	for _, queueElement := range queueArr {
		err = stub.DelState(queueElement.RefID)
		if err != nil {
			return err
		}
	}
	return nil
}

func resetAllCompletedTx(
	stub shim.ChaincodeStubInterface) error {

	queryString := fmt.Sprintf(
		`{"selector":{"docType":"%s"}}`,
		completedTxObjectType)
	completedTxArr, err := getCompletedTxArrFromQuery(stub, queryString)
	if err != nil {
		return err
	}
	for _, completedTx := range completedTxArr {
		err = stub.DelState(completedTx.RefID)
		if err != nil {
			return err
		}
	}
	return nil
}

func resetAllPledgeRedeem(
	stub shim.ChaincodeStubInterface) error {

	queryString := fmt.Sprintf(
		`{"selector":{
			"$or":[
				{"docType":"%s"},
				{"docType":"%s"},
				{"docType":"%s"},
				{"docType":"%s"}
			]
		}}`,
		pledgeObjectType,
		redeemObjectType,
		nettingSubtractObjectType,
		nettingAddObjectType)

	pledgeRedeemArr, err := getPledgeRedeemFundArrFromQuery(stub, queryString)
	if err != nil {
		return err
	}
	for _, pledgeRedeem := range pledgeRedeemArr {
		err = stub.DelState(pledgeRedeem.RefID)
		if err != nil {
			return err
		}
	}
	return nil
}

func resetAllMoveOutInFund(
	stub shim.ChaincodeStubInterface) error {

	queryString := fmt.Sprintf(
		`{"selector":{
			"$or":[
				{"docType":"%s"},
				{"docType":"%s"}
			]
		}}`,
		moveOutObjectType,
		moveInObjectType)

	moveOutInFundArr, err := getMoveOutInFundArrayFromQuery(stub, queryString)
	if err != nil {
		return err
	}
	for _, moveOutInFund := range moveOutInFundArr {
		err = stub.DelState(moveOutInFund.RefID)
		if err != nil {
			return err
		}
	}
	return nil
}

func checkArgArrayLength(
	args []string,
	expectedArgLength int) error {

	argArrayLength := len(args)
	if argArrayLength != expectedArgLength {
		errMsg := fmt.Sprintf(
			"Incorrect number of arguments: Received %d, expecting %d",
			argArrayLength,
			expectedArgLength)
		return errors.New(errMsg)
	}
	return nil
}

// ***********************************************************
// Fabric Network Related Helper Functions
// ***********************************************************

func getSigner(
	stub shim.ChaincodeStubInterface) (string, error) {

	creator, err := stub.GetCreator()
	if err != nil {
		return "", err
	}
	id := &mspprotos.SerializedIdentity{}
	err = proto.Unmarshal(creator, id)
	if err != nil {
		return "", err
	}
	block, _ := pem.Decode(id.GetIdBytes())
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return "", err
	}
	// mspID := id.GetMspid() // if you need the mspID
	signer := cert.Subject.CommonName
	return signer, nil
}

func verifyIdentity(
	stub shim.ChaincodeStubInterface,
	identities ...string) error {

	creatorString, err := getSigner(stub)
	if err != nil {
		return err
	}

	isVerified := false
	for _, identity := range identities {
		if creatorString == identity {
			isVerified = true
		}
	}

	if !isVerified {
		identitiesString := strings.Join(identities, " or ")
		errMsg := fmt.Sprintf(
			"Error: Identity of creator (%s) does not match %s",
			creatorString,
			identitiesString)
		return errors.New(errMsg)
	}
	return nil
}

func getChannelName(
	stub shim.ChaincodeStubInterface) (string, error) {

	signedProp, _ := stub.GetSignedProposal()

	proposal := &peer.Proposal{}
	err := proto.Unmarshal(signedProp.ProposalBytes, proposal)
	if err != nil {
		return "", err
	}

	header := &common.Header{}
	err = proto.Unmarshal(proposal.Header, header)
	if err != nil {
		return "", err
	}

	chHeader := &common.ChannelHeader{}
	err = proto.Unmarshal(header.ChannelHeader, chHeader)
	if err != nil {
		return "", err
	}

	channelId := chHeader.ChannelId
	return channelId, nil
}

func getTxTimeStampAsTime(
	stub shim.ChaincodeStubInterface) (time.Time, error) {

	timestampTime := time.Time{}
	timestamp, err := stub.GetTxTimestamp()
	if err != nil {
		return timestampTime, err
	}
	timestampTime, err = ptypes.Timestamp(timestamp)
	if err != nil {
		return timestampTime, err
	}

	return timestampTime, nil
}

func crossChannelQuery(
	stub shim.ChaincodeStubInterface,
	queryArgs [][]byte,
	targetChannel string,
	targetChaincode string) ([]byte, error) {

	response := stub.InvokeChaincode(targetChaincode, queryArgs, targetChannel)
	if response.Status != shim.OK {
		errStr := fmt.Sprintf(
			"Failed to invoke chaincode. Got error: %s",
			string(response.Payload))
		return nil, errors.New(errStr)
	}
	responseAsBytes := response.Payload

	return responseAsBytes, nil
}

// ***********************************************************
// Miscellaneous Internal Helper Functions
// ***********************************************************

func getTotalQueuedAmount(
	queueArr []QueuedTransaction) (float64, error) {

	var totalAmount float64
	totalAmount = 0
	for _, queueElement := range queueArr {
		totalAmount += queueElement.Amount
	}
	return totalAmount, nil
}

// ***********************************************************
// Sorting Helper Functions
// ***********************************************************

func sortQueues(
	queueArr []QueuedTransaction) []QueuedTransaction {

	priority := func(c1, c2 *QueuedTransaction) bool {
		return c1.Priority > c2.Priority
	}
	createtime := func(c1, c2 *QueuedTransaction) bool {
		return c1.CreateTime.Before(c2.CreateTime)
	}

	OrderedBy(priority, createtime).Sort(queueArr)
	return queueArr
}

func (ms *multiSorter) Sort(
	changes []QueuedTransaction) {

	ms.changes = changes
	sort.Sort(ms)
}

func OrderedBy(less ...lessFunc) *multiSorter {
	return &multiSorter{
		less: less,
	}
}

func (ms *multiSorter) Len() int {
	return len(ms.changes)
}

func (ms *multiSorter) Swap(i, j int) {
	ms.changes[i], ms.changes[j] = ms.changes[j], ms.changes[i]
}

func (ms *multiSorter) Less(i, j int) bool {
	p, q := &ms.changes[i], &ms.changes[j]
	var k int
	for k = 0; k < len(ms.less)-1; k++ {
		less := ms.less[k]
		switch {
		case less(p, q):
			return true
		case less(q, p):
			return false
		}
	}

	return ms.less[k](p, q)
}
