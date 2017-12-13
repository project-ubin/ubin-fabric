# Project Ubin Phase 2 - Hyperledger Fabric

This repository contains the source code and test scripts for the Hyperledger Fabric prototype in Project Ubin Phase 2.

Ubin Phase 2 is a collaborative design and rapid prototyping project, exploring the use of Distributed Ledger Technologies (DLT) for Real-Time Gross Settlement (RTGS) system. 
* Read the **Project Ubin Phase 2 Report** [here](http://bit.ly/ubin2017rpt)
* For more detailed documentation, refer to the Technical Reports: [Overview](https://github.com/project-ubin/ubin-docs/blob/master/UbinPhase2-Overview.pdf), [Hyperledger Fabric](https://github.com/project-ubin/ubin-docs/blob/master/UbinPhase2-Fabric.pdf) and [Testing](https://github.com/project-ubin/ubin-docs/blob/master/UbinPhase2-Testing.pdf)

The Fabric chaincode is written in Go and the API layer is written in JavaScript. All configurations and scripts are based on a 13 Virtual Machine setup (1 orderer, 1 central bank, 11 banks).

Additional notes:
* An external service (mock RTGS service) is to be deployed for Pledge and Redeem functions. It can be found in the [`ubin-ext-service`](https://github.com/project-ubin/ubin-ext-service)
* A common UI can be found in the [`ubin-ui`](https://github.com/project-ubin/ubin-ui) repository


## A. Getting Started

### Pre-requisites

This project is built and tested on the following:

- Operating System: Ubuntu 16.04.3 LTS (64-bit)
- Docker: 17.09.0-ce
- Fabric: 1.0.1
- Go: 1.7.6
- Node JS: 6.9.5
- NPM: 3.10.10
- PM2: 2.7.2

To install all prerequisites, download and run the [setup script](fabric-setup.sh) provided in the root folder of this repository. Reboot the VM(s) after installation to ensure that all changes have taken effect.
    

### Installation

1. Clone or download the repository into `$GOPATH/src`
    ```
    cd $GOPATH/src
    git clone https://github.com/project-ubin/ubin-fabric.git
    ```

2. Install required NodeJS packages
    ```
    cd ubin-fabric/api
    npm install
    ```

3. Configure argument for NodeJS
    ```
    cd scripts
    cp ecosystem.config-template.js ecosystem.config.js
    ```
    Edit the `args` field in ecosystem.config.js to reflect the BIC assigned to the VM

    Default organisation names used for this prototype:

    | Hostname    | Organisation BIC |
    | ----------- | ---------------- |
    | FabricNx01  | *Orderer*               |
    | FabricNx02  | masgsgsg         |
    | FabricNx03  | bofasg2x         |
    | FabricNx04  | chassgsg         |
    | FabricNx05  | citisgsg         |
    | FabricNx06  | csfbsgsx         |
    | FabricNx07  | dbsssgsg         |
    | FabricNx08  | hsbcsgsg         |
    | FabricNx09  | mtbcsgsg         |
    | FabricNx010 | ocbcsgsg         |
    | FabricNx011 | scblsgsg         |
    | FabricNx012 | uobvsgsg         |
    | FabricNx013 | xsimsgsg         |

### Setting up cron jobs

1. Open up the cron table for editing
    ```
    crontab -e
    ```

2. Add the following line to the end of the file to trigger a 'keep-alive' transaction to all chaincode containers every 10 minutes:
    ```
    */10 * * * *  [ -f /var/tmp/croncontrol/fabric_ping ] || curl -X GET http://localhost:8080/api/ping -H 'content-type: application/json' -o $HOME/ping.log
    ```

3. On the MAS virtual machine, add the following line to enable a daily data reset at 2am:
    ```
    0 2 * * * curl -X PATCH http://localhost:8080/api/resetdata -H 'all: true' -H 'content-type: application/json' -o $HOME/reset.log
    ```


## B. Deployment

### Environment Configurations

All scripts executed during deployment are based on the assumption that each VM represents a different organisation

The VMs for banks will only contain:
- 1 Peer container
- 1 CA container
- 1 CouchDB container

While the VM for the orderer will only contain:
- 1 orderer container

Configurations and scripts assumes the VM hostnames are in the format of `FabricNx01`, `FabricNx02`, ..., `FabricNx013`. 

If the VM hostnames are named differently, change them accordingly in [`crypto-config.yaml`](network/crypto-config.yaml), [`docker-compose.yaml`](network/docker-compose.yaml
) and [`config.sh`](api/scripts/config.sh).

Prior to deployment, ensure that the following ports are opened between virtual machines:

| Port                         | Protocol | Usage                                      |
| ---------------------------- | -------- | ------------------------------------------ |
| 7946                         | TCP/UDP  | Communication among nodes for docker swarm |
| 2377                         | TCP      | Cluster management communications          |
| 4789                         | UDP      | Overlay network traffic                    |
| 7050                         | TCP      | Orderer                                    |
| 7051, 8051, 9051, ..., 18051 | TCP      | Peer gRPC                                  |
| 7053, 8053, 9053, ..., 18053 | TCP      | Peer events                                |
| 7054, 8054, 9054, ..., 18054 | TCP      | CA Containers                              | 
| 5984, 6984, 7984, ..., 16984 | TCP      | CouchDB Containers                         | 



### Starting up the Fabric Network
The commands in this section should be executed in the [network](/network/) folder
```
cd $GOPATH/src/ubin-fabric/network
```

1. Start up docker swarm on the VM to be assigned as the orderer node (this will be the manager node)
    ```
    docker swarm init
    ```

    This will generate a command for joining the swarm as a worker node. Run this command on all worker nodes to join the swarm. 

    An example of the generated command is as follows:
    ```
    docker swarm join \
        --token SWMTKN-1-3pu6hszjas19xyp7ghgosyx9k8atbfcr8p2is99znpy26u2lkl-1awxwuwd3z9j1z3puu7rcgdbx \
        172.17.0.2:2377
    ```

2. Once all other nodes have joined the swarm, start the docker stack on the manager node
    ```
    docker stack up ubin -c docker-compose.yaml
    ```

    Note: Once all the docker containers are created, it is recommended to wait for approximately 2 minutes before moving on to the next step

3. Create and join channels on the VM assigned as the central bank node
    ```
    ./channels.sh
    ```

    Once the central bank node has created and joined all channels. The other nodes can now join the Fabric network using the same command

### Initialising the API Layer and Chaincodes

Initialise the API and install all chaincodes on the 11 bank nodes
```
./init.sh
```

Once complete, run the same command on the central bank node to initialise the API, install and instantiate the chaincodes on all channels


## C. Chaincode Upgrade

The [upgrade script](api/scripts/upgrade.sh) will install and upgrade (if ran on central bank node) the specified chaincode(s)

Usage:
```
./upgrade.sh upgrade [-b] [-f] [-n] [-v version_number]

Options:
    -b | --bilateral    upgrades the bilateral channel chaincode
    -f | --funding      upgrades the funding channel chaincode
    -n | --netting      upgrades the netting channel chaincode
    -v | --version      requires the user to specify a version number (integer)
```

Example for upgrading bilateral and netting channel chaincodes to version 3:
```
cd $GOPATH/src/ubin-fabric/api
./upgrade.sh -b -n -v 3
```

Note:
- Running the upgrade script will update the version number in `cc_version.txt` in the `ubin-fabric/api/scripts` folder, which is meant to keep track the current chaincode version
- If version is not specified, the upgrade version will be corresponding to the number in `cc_version.txt`, incremented by 1

## D. Ubin External Service Setup

Ubin external service should be set up in the MAS Node (Nx02). This is a mock service of the current RTGS system, MEPS+. 

#### Build

1\. Clone the repository to the MAS node (FabricNx02)

```sh
$ git clone https://github.com/project-ubin/ubin-ext-service.git
```
2\. Go to newly created folder

```sh
$ cd ubin-ext-service
```

3\. Build project using gradle

```sh
$ ./gradlew build
```
4\. Build artifact can be found at

    build/libs/MEPS-MockService-0.0.1-SNAPSHOT.jar

### Start External Service
1\. Update the `ubin-ext-service/application.properties` with Fabric configuration:

```sh
    PledgeURI=http://<host>:9001/api/fund/pledge
    RedeemURI=http://<host>:9001/api/fund/redeem
    Dlt=Fabric
```
    Note: Replace <host> with Central Bank (MAS) host/domain name.

2\. Copy built JAR artifact and properties files to the Central Bank VM
```sh
ubin-ext-service/build/libs/MEPS-MockService-0.0.1-SNAPSHOT.jar
ubin-ext-service/application.properties
```
Note: Ensure both files are in the same directory

3\. From Central Bank VM, start the mock service application
```sh
$ java -jar -Dspring.config.location=application.properties -Dserver.port=9001 MEPS-MockService-0.0.1-SNAPSHOT.jar
```

## E. Network Teardown

Bring down all docker containers, remove docker images, clean up enrollment materials and kill the API
```
cd $GOPATH/src/ubin-fabric/network
./network-down.sh
```

## F. Test Scripts

[Postman](https://www.getpostman.com/) is the main testing tool used for this prototype. The Postman collection and environments are located in the [tests](tests/postman) folder in this repository. The API definitions can be found in the [Technical Report repository](https://github.com/project-ubin/ubin-docs/blob/master/api/UbinPhase2-FabricAPI.pdf).


## License 
 
Copyright 2017 The Association of Banks in Singapore
 
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
 
http://www.apache.org/licenses/LICENSE-2.0
 
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
