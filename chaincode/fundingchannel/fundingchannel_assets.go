package main

import (
	"time"
)

const transientFundObjectType string = "transientfund"

type TransientFund struct {
	ObjectType  string    `json:"docType"` //default set to "transientfund"
	RefID       string    `json:"refID"`
	AccountID   string    `json:"accountID"`
	ChannelFrom string    `json:"channelFrom"`
	ChannelTo   string    `json:"channelTo"`
	Amount      float64   `json:"amount"`
	Currency    string    `json:"currency"`
	CreateTime  time.Time `json:"createTime"`
}

type PingChaincode struct {
	ObjectType string `json:"docType"`
	number     int    `json:"number"`
}

type SimpleChaincode struct {
}
