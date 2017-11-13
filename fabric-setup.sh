#!/bin/bash

echo "==============================================="
echo " Installing Pre-Requisites"
echo "==============================================="
echo 
sudo apt-get update
# sudo apt-get -y install bison
# sudo apt-get -y install python-software-properties
sudo apt-get -y install build-essential
sudo apt-get -y install jq
sudo apt-get -y install docker-compose
sudo apt-get -y install python-pip


echo
echo "==============================================="
echo " Installing Go"
echo "==============================================="
echo 
wget https://storage.googleapis.com/golang/go1.7.6.linux-amd64.tar.gz
sudo tar -zxvf  go1.7.6.linux-amd64.tar.gz -C /usr/local/
mkdir $HOME/go
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
echo 'export GOPATH=$HOME' >> ~/.bashrc
# echo 'export PATH=$PATH:$GOPATH/bin' >> ~/.bashrc
source ~/.bashrc


echo
echo "==============================================="
echo " Installing Node JS"
echo "==============================================="
echo 
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
sudo apt-get install nodejs
sudo npm -g install n && sudo n 6.9
sudo npm install pm2@latest -g


echo
echo "==============================================="
echo " Installing Docker"
echo "==============================================="
echo 
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt-get update
apt-cache policy docker-ce
sudo apt-get install -y docker-ce
sudo usermod -aG docker ${USER}

pip install --upgrade pip
sudo pip install docker-compose

echo
echo " ===== Initial setup complete. Please restart your machine for changes to take effect. ====="
