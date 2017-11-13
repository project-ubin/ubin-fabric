#!/bin/bash

STATE=`ps -ef | grep "app.js" | grep -v grep | wc -l`
PID=`ps -ef | grep "app.js" | grep -v grep |awk 'NR==1{print $2}'`
if [ "${STATE}" -ne 0 ] ; then
        echo "NodeJS currently running. Shutting down..."
        pm2 stop all 
        echo "NodeJS has been shut down...."
else
        echo "NodeJS server is not running"
fi
# Remove enrollment materials
# rm -rf /tmp/hfc-test-kvs* $HOME/.hfc-key-store/ /tmp/fabric-client-kvs*
echo
echo "Starting NodeJS and waiting 5 seconds..."
pm2 start ecosystem.config.js
