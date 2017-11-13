#!/usr/bin/env bash

REGULATOR_NAME=masgsgsg
MULTILATERAL_CHANNELS=( 'fundingchannel' 'nettingchannel' )
CHANNEL_SCRIPT_DIR=/etc/hyperledger/configtx

ALL_CHANNEL_TXS=( $(ls -q channel-artifacts/*-channel.tx | xargs -n 1 basename) )

# Determine identity of current VM
container_id=""
bank_name=""
container=$(docker ps | grep "fabric-peer")
if [[ ${container} =~ ^([0-9a-f]+)\ .*peer0-([a-z,0-9]*)\. ]]; then
    container_id="${BASH_REMATCH[1]}"
    bank_name="${BASH_REMATCH[2]}"
fi
echo
echo "---------- Peer Configuration ----------"
echo " Bank Name    : ${bank_name}"
echo " Container ID : ${container_id}"
echo "----------------------------------------"
echo


# Create Channels
if [[ ${bank_name} = ${REGULATOR_NAME} ]]; then
    echo "Regulator peer found. Creating channels..."
    docker exec ${container_id} bash ${CHANNEL_SCRIPT_DIR}/create-channel.sh
    echo
else
    echo "Regulator peer not found. Skipping channel creation..."
fi


# Join Channels
filter_channels() {
    for channel_tx in "${ALL_CHANNEL_TXS[@]}"; do
        [[ ${channel_tx} == *$1* ]] && res+=("${channel_tx%-channel.tx}channel")
    done
    echo "${res[@]}"
}

channels=""
if [ ${bank_name} = ${REGULATOR_NAME} ]; then
    channels=( $(filter_channels) )
else
    channels=( $(filter_channels ${bank_name}) "fundingchannel" "nettingchannel" )
fi

docker exec $container_id bash ${CHANNEL_SCRIPT_DIR}/join-channel.sh ${bank_name} ${channels[@]}
