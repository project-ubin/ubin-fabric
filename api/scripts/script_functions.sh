#!/bin/bash

if [ -e ./config.sh ]
then
    echo "config.sh found in current folder"
    . ./config.sh
else
    echo "config.sh not found in current folder. Execute via direct path..."
    . ~/ubin-fabric-api/scripts/config.sh
fi

CURRENCY=SGD

SetPeers() {
    CHANNEL=$1

    CHANNEL_PEER0=`jq -r .channelMapping.${CHANNEL}[0] ${NETWORK_REFERENCE_FILE}`
    CHANNEL_PEER1=`jq -r .channelMapping.${CHANNEL}[1] ${NETWORK_REFERENCE_FILE}`

    echo
    echo "Channel peers:"
    echo ${CHANNEL_PEER0}
    echo ${CHANNEL_PEER1}
    echo
}


#==============================================
# 
# STARTUP FUNCTIONS
# 
#==============================================

RestartNodeJS() {
    STATE=`ps -ef | grep "app.js" | grep -v grep | wc -l`
    PID=`ps -ef | grep "app.js" | grep -v grep |awk 'NR==1{print $2}'`
    if [ "${STATE}" -ne 0 ] ; then
        echo "NodeJS currently running. Shutting down..."
        pm2 stop all
        echo "NodeJS has been shut down...."
    else
        echo "NodeJS server is not running"
    fi
    echo
    echo "Starting NodeJS and waiting 5 seconds..."
    pm2 start ecosystem.config.js
    sleep 10
}


#**********************************************
# FUNCTIONS FOR ENROLMENT
#**********************************************

Enroll() {
    echo "POST - Enrolling ${ORG_USER} on ${ORG_NAME}"
    RESP=$(curl -s -X POST \
        http://localhost:8080/api/users \
        -H "content-type: application/x-www-form-urlencoded" \
        -d "username=${ORG_USER}&orgName=${ORG_NAME}")
    echo "Enroll Response: ${RESP}"
    echo
    echo
}


#**********************************************
# FUNCTIONS FOR INSTALLATION/INSTANTIATION
#**********************************************

Install() {
    CHAINCODE=$1

    echo "POST install chaincode ${CHAINCODE} version ${VERSION} on ${ORG_NAME}/${ORG_USER} with ${ORG_PEER}"
    RESP=$(curl -s -X POST \
        http://localhost:8080/api/chaincodes \
        -H "content-type: application/json" \
        -d "{
        \"username\" : \"${ORG_USER}\",
        \"orgname\" : \"${ORG_NAME}\",
        \"peers\" : [\"${ORG_PEER}\"],
        \"chaincodeName\":\"${CHAINCODE}_cc\",
        \"chaincodePath\":\"ubin-fabric/chaincode/${CHAINCODE}\",
        \"chaincodeVersion\":\"${VERSION}\"
    }")
    echo "Installation response:"
    echo "$RESP"
    echo
    echo
}

InstantiateBilateral() {
    CHANNEL=$1

    SetPeers ${CHANNEL}

    echo "PEER: $ORG_PEER"

    echo "POST instantiate chaincode on ${CHANNEL} using ${ORG_NAME}/${ORG_USER}"
    RESP=$(curl -s -X POST \
        http://localhost:8080/api/channels/${CHANNEL}/chaincodes \
        -H "content-type: application/json" \
        -d "{
        \"username\" : \"${ORG_USER}\",
        \"orgname\" : \"${ORG_NAME}\",
        \"peers\" : [\"${ORG_PEER}\"],
        \"functionName\" : \"init\",
        \"args\" : [],
        \"chaincodeName\":\"bilateralchannel_cc\",
        \"chaincodePath\":\"ubin-fabric/chaincode/bilateralchannel\",
        \"chaincodeVersion\":\"${VERSION}\"
    }")
    echo "Instantiation response:"
    echo "$RESP"
    echo
    echo
}

InstantiateMultilateral() {
    CHANNEL=$1

    echo "POST instantiate chaincode on ${CHANNEL} using ${ORG_NAME}/${ORG_USER} with ${ORG_PEER}"
    RESP=$(curl -s -X POST \
        http://localhost:8080/api/channels/${CHANNEL}/chaincodes \
        -H "content-type: application/json" \
        -d "{
        \"username\" : \"${ORG_USER}\",
        \"orgname\" : \"${ORG_NAME}\",
        \"peers\" : [\"${ORG_PEER}\"],
        \"functionName\" : \"init\",
        \"args\" : [],
        \"chaincodeName\":\"${CHANNEL}_cc\",
        \"chaincodePath\":\"ubin-fabric/chaincode/${CHANNEL}\",
        \"chaincodeVersion\":\"${VERSION}\"
    }")
    echo "Instantiation response:"
    echo "$RESP"
    echo
    echo
}

Upgrade() {
    CHANNEL=$1

    CHAINCODE=bilateralchannel
    if [ "${CHANNEL}" = "nettingchannel" -o "${CHANNEL}" = "fundingchannel" ]; then
        CHAINCODE=${CHANNEL}
    fi

    echo "POST upgrade chaincode on ${CHANNEL} using ${ORG_NAME}/${ORG_USER} with ${ORG_PEER}"
    RESP=$(curl -s -X POST \
        http://localhost:8080/api/channels/${CHANNEL}/chaincodes/upgrade \
        -H "content-type: application/json" \
        -d "{
        \"username\" : \"${ORG_USER}\",
        \"orgname\" : \"${ORG_NAME}\",
        \"peers\" : [\"${ORG_PEER}\"],
        \"functionName\" : \"init\",
        \"args\" : [],
        \"chaincodeName\":\"${CHAINCODE}_cc\",
        \"chaincodePath\":\"ubin-fabric/chaincode/${CHAINCODE}\",
        \"chaincodeVersion\":\"${VERSION}\"
    }")
    echo "Upgrade response:"
    echo "$RESP"
    echo
    echo
}

#==============================================
# 
# CHAINCODE FUNCTIONS
# 
#==============================================


#**********************************************
# FUNCTIONS FOR ASSET INITIALIZATION
#**********************************************

InitAccount() {
    ACCOUNT=$1
    AMOUNT=$2
    CHANNEL=$3

    SetPeers ${CHANNEL}

    echo "POST - initAccount ${ACCOUNT} with ${AMOUNT} ${CURRENCY} in ${CHANNEL}"
    RESP=$(curl -s -X POST \
        http://localhost:8080/api/channels/${CHANNEL}/chaincodes/bilateralchannel_cc \
        -H "content-type: application/json" \
        -d "{
        \"username\" : \"${ORG_USER}\",
        \"orgname\" : \"${ORG_NAME}\",
        \"peers\": [\"${CHANNEL_PEER0}\", \"${CHANNEL_PEER1}\"],
        \"fcn\":\"initAccount\",
        \"args\":[\"${ACCOUNT}\",\"${CURRENCY}\",\"${AMOUNT}\",\"NORMAL\"] 
    }")
    echo "InitAccount response:"
    echo "$RESP"
    echo
}

InitChannelAccounts() {
    CHANNEL=$1

    ACCT1=`jq -r .channelBankMapping.${CHANNEL}[0] ${NETWORK_REFERENCE_FILE}`
    ACCT2=`jq -r .channelBankMapping.${CHANNEL}[1] ${NETWORK_REFERENCE_FILE}`

    InitAccount ${ACCT1} 0 ${CHANNEL}
    InitAccount ${ACCT2} 0 ${CHANNEL}
}

#**********************************************
# OTHER FUNCTIONS
#**********************************************


PingChaincode() {
    ORG_NAME=$1
    CHANNEL=$2

    SetOrg ${ORG_NAME}
    SetPeers ${CHANNEL}

    echo "GET - Ping all chaincodes"
    curl -X GET http://localhost:8080/api/ping -H 'content-type: application/json'
    echo
    echo
}


