#!/bin/bash

start=`date +%s`
echo "1" > cc_version.txt

VERSION=`cat cc_version.txt`

echo "Disabling ping cron job"
./cron_control.sh --disable fabric_ping

# Load files
if [ -e ./script_functions.sh ]
then
    echo "script_functions.sh found in current folder"
    . ./script_functions.sh
else
    echo "script_functions.sh not found in current folder. Execute via direct path..."
    . ~/ubin-fabric-api/scripts/script_functions.sh
fi

mkdir -p ../logs
RestartNodeJS

echo
echo "---------------- VM CONFIGURATIONS ----------------"
echo " NAME: ${ORG_NAME}"
echo " USER: ${ORG_USER}"
echo " ACCT: ${ORG_ACCT}"
echo " PEER: ${ORG_PEER}"
echo " CONFIG FILE: ${NETWORK_CONFIG_FILE}"
echo "---------------------------------------------------"
echo

Enroll
Install bilateralchannel
Install fundingchannel
Install nettingchannel

if [ ${ORG_NAME} = ${REGULATOR_ORG} ]
then
    sleep 20
    InstantiateBilateral bofasg2xchassgsgchannel
    InstantiateBilateral bofasg2xcitisgsgchannel
    InstantiateBilateral bofasg2xcsfbsgsxchannel
    InstantiateBilateral bofasg2xdbsssgsgchannel
    InstantiateBilateral bofasg2xhsbcsgsgchannel
    InstantiateBilateral bofasg2xmtbcsgsgchannel
    InstantiateBilateral bofasg2xocbcsgsgchannel
    InstantiateBilateral bofasg2xscblsgsgchannel
    InstantiateBilateral bofasg2xuobvsgsgchannel
    InstantiateBilateral bofasg2xxsimsgsgchannel
    InstantiateBilateral chassgsgcitisgsgchannel
    InstantiateBilateral chassgsgcsfbsgsxchannel
    InstantiateBilateral chassgsgdbsssgsgchannel
    InstantiateBilateral chassgsghsbcsgsgchannel
    InstantiateBilateral chassgsgmtbcsgsgchannel
    InstantiateBilateral chassgsgocbcsgsgchannel
    InstantiateBilateral chassgsgscblsgsgchannel
    InstantiateBilateral chassgsguobvsgsgchannel
    InstantiateBilateral chassgsgxsimsgsgchannel
    InstantiateBilateral citisgsgcsfbsgsxchannel
    InstantiateBilateral citisgsgdbsssgsgchannel
    InstantiateBilateral citisgsghsbcsgsgchannel
    InstantiateBilateral citisgsgmtbcsgsgchannel
    InstantiateBilateral citisgsgocbcsgsgchannel
    InstantiateBilateral citisgsgscblsgsgchannel
    InstantiateBilateral citisgsguobvsgsgchannel
    InstantiateBilateral citisgsgxsimsgsgchannel
    InstantiateBilateral csfbsgsxdbsssgsgchannel
    InstantiateBilateral csfbsgsxhsbcsgsgchannel
    InstantiateBilateral csfbsgsxmtbcsgsgchannel
    InstantiateBilateral csfbsgsxocbcsgsgchannel
    InstantiateBilateral csfbsgsxscblsgsgchannel
    InstantiateBilateral csfbsgsxuobvsgsgchannel
    InstantiateBilateral csfbsgsxxsimsgsgchannel
    InstantiateBilateral dbsssgsghsbcsgsgchannel
    InstantiateBilateral dbsssgsgmtbcsgsgchannel
    InstantiateBilateral dbsssgsgocbcsgsgchannel
    InstantiateBilateral dbsssgsgscblsgsgchannel
    InstantiateBilateral dbsssgsguobvsgsgchannel
    InstantiateBilateral dbsssgsgxsimsgsgchannel
    InstantiateBilateral hsbcsgsgmtbcsgsgchannel
    InstantiateBilateral hsbcsgsgocbcsgsgchannel
    InstantiateBilateral hsbcsgsgscblsgsgchannel
    InstantiateBilateral hsbcsgsguobvsgsgchannel
    InstantiateBilateral hsbcsgsgxsimsgsgchannel
    InstantiateBilateral mtbcsgsgocbcsgsgchannel
    InstantiateBilateral mtbcsgsgscblsgsgchannel
    InstantiateBilateral mtbcsgsguobvsgsgchannel
    InstantiateBilateral mtbcsgsgxsimsgsgchannel
    InstantiateBilateral ocbcsgsgscblsgsgchannel
    InstantiateBilateral ocbcsgsguobvsgsgchannel
    InstantiateBilateral ocbcsgsgxsimsgsgchannel
    InstantiateBilateral scblsgsguobvsgsgchannel
    InstantiateBilateral scblsgsgxsimsgsgchannel
    InstantiateBilateral uobvsgsgxsimsgsgchannel

    InstantiateMultilateral fundingchannel
    InstantiateMultilateral nettingchannel

    sleep 30
    
    InitChannelAccounts bofasg2xchassgsgchannel
    InitChannelAccounts bofasg2xcitisgsgchannel
    InitChannelAccounts bofasg2xcsfbsgsxchannel
    InitChannelAccounts bofasg2xdbsssgsgchannel
    InitChannelAccounts bofasg2xhsbcsgsgchannel
    InitChannelAccounts bofasg2xmtbcsgsgchannel
    InitChannelAccounts bofasg2xocbcsgsgchannel
    InitChannelAccounts bofasg2xscblsgsgchannel
    InitChannelAccounts bofasg2xuobvsgsgchannel
    InitChannelAccounts bofasg2xxsimsgsgchannel
    InitChannelAccounts chassgsgcitisgsgchannel
    InitChannelAccounts chassgsgcsfbsgsxchannel
    InitChannelAccounts chassgsgdbsssgsgchannel
    InitChannelAccounts chassgsghsbcsgsgchannel
    InitChannelAccounts chassgsgmtbcsgsgchannel
    InitChannelAccounts chassgsgocbcsgsgchannel
    InitChannelAccounts chassgsgscblsgsgchannel
    InitChannelAccounts chassgsguobvsgsgchannel
    InitChannelAccounts chassgsgxsimsgsgchannel
    InitChannelAccounts citisgsgcsfbsgsxchannel
    InitChannelAccounts citisgsgdbsssgsgchannel
    InitChannelAccounts citisgsghsbcsgsgchannel
    InitChannelAccounts citisgsgmtbcsgsgchannel
    InitChannelAccounts citisgsgocbcsgsgchannel
    InitChannelAccounts citisgsgscblsgsgchannel
    InitChannelAccounts citisgsguobvsgsgchannel
    InitChannelAccounts citisgsgxsimsgsgchannel
    InitChannelAccounts csfbsgsxdbsssgsgchannel
    InitChannelAccounts csfbsgsxhsbcsgsgchannel
    InitChannelAccounts csfbsgsxmtbcsgsgchannel
    InitChannelAccounts csfbsgsxocbcsgsgchannel
    InitChannelAccounts csfbsgsxscblsgsgchannel
    InitChannelAccounts csfbsgsxuobvsgsgchannel
    InitChannelAccounts csfbsgsxxsimsgsgchannel
    InitChannelAccounts dbsssgsghsbcsgsgchannel
    InitChannelAccounts dbsssgsgmtbcsgsgchannel
    InitChannelAccounts dbsssgsgocbcsgsgchannel
    InitChannelAccounts dbsssgsgscblsgsgchannel
    InitChannelAccounts dbsssgsguobvsgsgchannel
    InitChannelAccounts dbsssgsgxsimsgsgchannel
    InitChannelAccounts hsbcsgsgmtbcsgsgchannel
    InitChannelAccounts hsbcsgsgocbcsgsgchannel
    InitChannelAccounts hsbcsgsgscblsgsgchannel
    InitChannelAccounts hsbcsgsguobvsgsgchannel
    InitChannelAccounts hsbcsgsgxsimsgsgchannel
    InitChannelAccounts mtbcsgsgocbcsgsgchannel
    InitChannelAccounts mtbcsgsgscblsgsgchannel
    InitChannelAccounts mtbcsgsguobvsgsgchannel
    InitChannelAccounts mtbcsgsgxsimsgsgchannel
    InitChannelAccounts ocbcsgsgscblsgsgchannel
    InitChannelAccounts ocbcsgsguobvsgsgchannel
    InitChannelAccounts ocbcsgsgxsimsgsgchannel
    InitChannelAccounts scblsgsguobvsgsgchannel
    InitChannelAccounts scblsgsgxsimsgsgchannel
    InitChannelAccounts uobvsgsgxsimsgsgchannel
fi


echo "Enabling ping cron job"
./cron_control.sh --enable fabric_ping

end=`date +%s`
runtime=$((end-start))
echo "Initialization completed as of $(date)"
echo "Script Execution Time: ${runtime}"
