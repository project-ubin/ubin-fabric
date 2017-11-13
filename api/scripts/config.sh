#!/bin/bash

NETWORK_CONFIG_PATH=../config
NETWORK_REFERENCE_FILE=${NETWORK_CONFIG_PATH}/network-reference.json
REGULATOR_ORG=org0

ORG0_NAME=org0
ORG0_HOST=FabricNx02
ORG0_CONFIG=network-config_masgsgsg

ORG1_NAME=org1
ORG1_HOST=FabricNx03
ORG1_CONFIG=network-config_bofasg2x

ORG2_NAME=org2
ORG2_HOST=FabricNx04
ORG2_CONFIG=network-config_chassgsg

ORG3_NAME=org3
ORG3_HOST=FabricNx05
ORG3_CONFIG=network-config_citisgsg

ORG4_NAME=org4
ORG4_HOST=FabricNx06
ORG4_CONFIG=network-config_csfbsgsx

ORG5_NAME=org5
ORG5_HOST=FabricNx07
ORG5_CONFIG=network-config_dbsssgsg

ORG6_NAME=org6
ORG6_HOST=FabricNx08
ORG6_CONFIG=network-config_hsbcsgsg

ORG7_NAME=org7
ORG7_HOST=FabricNx09
ORG7_CONFIG=network-config_mtbcsgsg

ORG8_NAME=org8
ORG8_HOST=FabricNx010
ORG8_CONFIG=network-config_ocbcsgsg

ORG9_NAME=org9
ORG9_HOST=FabricNx011
ORG9_CONFIG=network-config_scblsgsg

ORG10_NAME=org10
ORG10_HOST=FabricNx012
ORG10_CONFIG=network-config_uobvsgsg

ORG11_NAME=org11
ORG11_HOST=FabricNx013
ORG11_CONFIG=network-config_xsimsgsg


jq --version > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Please Install 'jq' https://stedolan.github.io/jq/ to execute this script"
    echo
    exit 1
fi

case $(hostname) in
    ${ORG0_HOST})
        NETWORK_CONFIG=${ORG0_CONFIG}
        ORG_NAME=${ORG0_NAME}
        ;;
    ${ORG1_HOST})
        NETWORK_CONFIG=${ORG1_CONFIG}
        ORG_NAME=${ORG1_NAME}
        ;;
    ${ORG2_HOST})
        NETWORK_CONFIG=${ORG2_CONFIG}
        ORG_NAME=${ORG2_NAME}
        ;;
    ${ORG3_HOST})
        NETWORK_CONFIG=${ORG3_CONFIG}
        ORG_NAME=${ORG3_NAME}
        ;;
    ${ORG4_HOST})
        NETWORK_CONFIG=${ORG4_CONFIG}
        ORG_NAME=${ORG4_NAME}
        ;;
    ${ORG5_HOST})
        NETWORK_CONFIG=${ORG5_CONFIG}
        ORG_NAME=${ORG5_NAME}
        ;;
    ${ORG6_HOST})
        NETWORK_CONFIG=${ORG6_CONFIG}
        ORG_NAME=${ORG6_NAME}
        ;;
    ${ORG7_HOST})
        NETWORK_CONFIG=${ORG7_CONFIG}
        ORG_NAME=${ORG7_NAME}
        ;;
    ${ORG8_HOST})
        NETWORK_CONFIG=${ORG8_CONFIG}
        ORG_NAME=${ORG8_NAME}
        ;;
    ${ORG9_HOST})
        NETWORK_CONFIG=${ORG9_CONFIG}
        ORG_NAME=${ORG9_NAME}
        ;;
    ${ORG10_HOST})
        NETWORK_CONFIG=${ORG10_CONFIG}
        ORG_NAME=${ORG10_NAME}
        ;;
    ${ORG11_HOST})
        NETWORK_CONFIG=${ORG11_CONFIG}
        ORG_NAME=${ORG11_NAME}
        ;;
    *)
        echo "Invalid Hostname ($(hostname))"
        exit 1
        ;;
esac

NETWORK_CONFIG_FILE=${NETWORK_CONFIG_PATH}/${NETWORK_CONFIG}.json

ORG_PEER=`jq -r .networkConfig.${ORG_NAME}.orgPeers[0] ${NETWORK_CONFIG_FILE}`
ORG_USER=`jq -r .networkConfig.${ORG_NAME}.bic ${NETWORK_CONFIG_FILE}`
ORG_ACCT=${ORG_USER}


ORG0_BIC=`jq -r .networkConfig.${ORG0_NAME}.bic ${NETWORK_CONFIG_FILE}`
ORG1_BIC=`jq -r .networkConfig.${ORG1_NAME}.bic ${NETWORK_CONFIG_FILE}`
ORG2_BIC=`jq -r .networkConfig.${ORG2_NAME}.bic ${NETWORK_CONFIG_FILE}`
ORG3_BIC=`jq -r .networkConfig.${ORG3_NAME}.bic ${NETWORK_CONFIG_FILE}`
ORG4_BIC=`jq -r .networkConfig.${ORG4_NAME}.bic ${NETWORK_CONFIG_FILE}`
ORG5_BIC=`jq -r .networkConfig.${ORG5_NAME}.bic ${NETWORK_CONFIG_FILE}`
ORG6_BIC=`jq -r .networkConfig.${ORG6_NAME}.bic ${NETWORK_CONFIG_FILE}`
ORG7_BIC=`jq -r .networkConfig.${ORG7_NAME}.bic ${NETWORK_CONFIG_FILE}`
ORG8_BIC=`jq -r .networkConfig.${ORG8_NAME}.bic ${NETWORK_CONFIG_FILE}`
ORG9_BIC=`jq -r .networkConfig.${ORG9_NAME}.bic ${NETWORK_CONFIG_FILE}`
ORG10_BIC=`jq -r .networkConfig.${ORG10_NAME}.bic ${NETWORK_CONFIG_FILE}`
ORG11_BIC=`jq -r .networkConfig.${ORG11_NAME}.bic ${NETWORK_CONFIG_FILE}`


