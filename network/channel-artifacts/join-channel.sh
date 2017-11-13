#!/bin/bash -ne

if [ $# -lt 2 ]; then
    echo "Need more parameters."
    echo "Usage: join-channel.sh <org> <channel> [<additional_channel> ...]"
    exit -1
fi

export CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/crypto/msp/users/Admin@$1.example.com/msp
if [ ! -d $CORE_PEER_MSPCONFIGPATH ]
then
    echo "Path does not exist: $CORE_PEER_MSPCONFIGPATH"
    exit -1
fi

join_channel() {
    echo "Joining $1..."
    peer channel fetch 0 "$1".block -o orderer.example.com:7050 -c "$1"
    peer channel join -b "$1".block
    echo
}

for channel in "${@:2}"; do
    join_channel $channel
done       
echo "All done..."
