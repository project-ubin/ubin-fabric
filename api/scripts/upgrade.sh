#!/bin/bash

VERSION_FILE=cc_version.txt
CURR_VERSION=`cat ${VERSION_FILE}`
VERSION=""

if [ -e ./script_functions.sh ]
then
	echo "script_functions.sh found in current folder"
	. ./script_functions.sh
else
	echo "script_functions.sh not found in current folder. Execute via direct path..."
	. ~/ubin-fabric-api/scripts/script_functions.sh
fi


starttime=$(date +%s)

isBilateral=false
isFunding=false
isNetting=false

while 
   	case $1 in
		-b | --bilateral )
			isBilateral=true
			;;
		-f | --funding )
			isFunding=true
			;;
		-n | --netting )
			isNetting=true
			;;
		-v | --version )
			shift
			re='^[0-9]+$'
			if ! [[ $1 =~ ${re} ]]
			then
				echo "$1 is not a valid integer" >&2
				exit
			elif [ $1 -gt ${CURR_VERSION} ]
			then
		   		VERSION=$1
				echo "Upgrading to version ${VERSION}"
			else
				echo "Version specified ($1) must be greater than ${CURR_VERSION}" >&2
				exit
			fi
			;;
		* ) 
			echo "Invalid option: $1"
			echo "Usage: upgrade [-b] [-f] [-n] [-v version_number]"
			echo "     -b | --bilateral    upgrades the bilateral channel chaincode"
			echo "     -f | --funding      upgrades the funding channel chaincode"
			echo "     -n | --netting      upgrades the netting channel chaincode"
			echo "     -v | --version      requires the user to specify a version number (integer)"
			exit
	   		;;
  	esac
  	shift

  	[ "$1" != "" ]
do :; done


if [ -z ${VERSION} ]; then
	VERSION=$((CURR_VERSION+1))
	echo "No version defined, upgrading to version ${VERSION}"
fi
echo ${VERSION} > cc_version.txt


# =======================================
# CHAINCODE INSTALLATION
# =======================================

if [ ${isBilateral} = true ]
then
	Install bilateralchannel
fi

if [ ${isFunding} = true ]
then
	Install fundingchannel
fi

if [ ${isNetting} = true ]
then
	Install nettingchannel	
fi


# =======================================
# CHAINCODE UPGRADE
# =======================================

if [ ${ORG_NAME} = ${REGULATOR_ORG} ]
then
    sleep 20

    if [ ${isBilateral} = true ]
	then

		Upgrade bofasg2xchassgsgchannel
		Upgrade bofasg2xcitisgsgchannel
		Upgrade bofasg2xcsfbsgsxchannel
		Upgrade bofasg2xdbsssgsgchannel
		Upgrade bofasg2xhsbcsgsgchannel
		Upgrade bofasg2xmtbcsgsgchannel
		Upgrade bofasg2xocbcsgsgchannel
		Upgrade bofasg2xscblsgsgchannel
		Upgrade bofasg2xuobvsgsgchannel
		Upgrade bofasg2xxsimsgsgchannel
		Upgrade chassgsgcitisgsgchannel
		Upgrade chassgsgcsfbsgsxchannel
		Upgrade chassgsgdbsssgsgchannel
		Upgrade chassgsghsbcsgsgchannel
		Upgrade chassgsgmtbcsgsgchannel
		Upgrade chassgsgocbcsgsgchannel
		Upgrade chassgsgscblsgsgchannel
		Upgrade chassgsguobvsgsgchannel
		Upgrade chassgsgxsimsgsgchannel
		Upgrade citisgsgcsfbsgsxchannel
		Upgrade citisgsgdbsssgsgchannel
		Upgrade citisgsghsbcsgsgchannel
		Upgrade citisgsgmtbcsgsgchannel
		Upgrade citisgsgocbcsgsgchannel
		Upgrade citisgsgscblsgsgchannel
		Upgrade citisgsguobvsgsgchannel
		Upgrade citisgsgxsimsgsgchannel
		Upgrade csfbsgsxdbsssgsgchannel
		Upgrade csfbsgsxhsbcsgsgchannel
		Upgrade csfbsgsxmtbcsgsgchannel
		Upgrade csfbsgsxocbcsgsgchannel
		Upgrade csfbsgsxscblsgsgchannel
		Upgrade csfbsgsxuobvsgsgchannel
		Upgrade csfbsgsxxsimsgsgchannel
		Upgrade dbsssgsghsbcsgsgchannel
		Upgrade dbsssgsgmtbcsgsgchannel
		Upgrade dbsssgsgocbcsgsgchannel
		Upgrade dbsssgsgscblsgsgchannel
		Upgrade dbsssgsguobvsgsgchannel
		Upgrade dbsssgsgxsimsgsgchannel
		Upgrade hsbcsgsgmtbcsgsgchannel
		Upgrade hsbcsgsgocbcsgsgchannel
		Upgrade hsbcsgsgscblsgsgchannel
		Upgrade hsbcsgsguobvsgsgchannel
		Upgrade hsbcsgsgxsimsgsgchannel
		Upgrade mtbcsgsgocbcsgsgchannel
		Upgrade mtbcsgsgscblsgsgchannel
		Upgrade mtbcsgsguobvsgsgchannel
		Upgrade mtbcsgsgxsimsgsgchannel
		Upgrade ocbcsgsgscblsgsgchannel
		Upgrade ocbcsgsguobvsgsgchannel
		Upgrade ocbcsgsgxsimsgsgchannel
		Upgrade scblsgsguobvsgsgchannel
		Upgrade scblsgsgxsimsgsgchannel
		Upgrade uobvsgsgxsimsgsgchannel
	
	fi

	if [ ${isFunding} = true ]
	then
    	Upgrade fundingchannel
    fi

    if [ ${isNetting} = true ]
	then
    	Upgrade nettingchannel
    fi
fi
