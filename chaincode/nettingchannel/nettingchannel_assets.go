package main

import (
	"time"
)

const bankRequestObjectType string = "bankrequest"
const nettingCycleObjectType string = "nettingcycle"

type BankRequest struct {
	ObjectType      string   `json:"docType"`
	bankRequestID   string   `json:"bankRequestID"`
	BankID          string   `json:"bankID"`
	NetValue        float64  `json:"netValue"`
	NettableList    []string `json:"nettableList"`
	NonNettableList []string `json:"nonNettableList"`
}

type NettingCycle struct {
	ObjectType   string                 `json:"docType"`
	CycleID      int                    `json:"cycleID"`
	Status       string                 `json:"status"` // ACHIEVED, FAILED, ONGOING, SETTLED, EXPIRED
	Created      time.Time              `json:"created"`
	Updated      time.Time              `json:"updated"`
	BankRequests map[string]BankRequest `json:"bankRequests"`
}

type PingChaincode struct {
	ObjectType string `json:"docType"`
	number     int    `json:"number"`
}

type SimpleChaincode struct {
}
