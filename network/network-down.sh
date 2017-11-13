#!/bin/bash


# Clear docker 
isManager=`docker node inspect self --format "{{ .ManagerStatus.Leader }}"`
if [ ${isManager} = true ]
then
    docker stack rm ubin
fi

CONTAINER_IDS=$(docker ps -aq)
echo
if [ -z "$CONTAINER_IDS" -o "$CONTAINER_IDS" = " " ]; then
    echo "========== No containers available for deletion =========="
else
    docker rm -f $CONTAINER_IDS
fi
echo

DOCKER_IMAGE_IDS=$(docker images | grep "dev\|none\|test-vp\|peer[0-9]-" | awk '{print $3}')
echo
if [ -z "$DOCKER_IMAGE_IDS" -o "$DOCKER_IMAGE_IDS" = " " ]; then
echo "========== No images available for deletion ==========="
else
	docker rmi -f $DOCKER_IMAGE_IDS
fi
echo

docker swarm leave --force

# Clean up enrollment materials
echo "Cleaning up enrollment materials..."
rm -rf /tmp/hfc-test-kvs* $HOME/.hfc-key-store/ /tmp/fabric-client-kvs*

# Kill API
pm2 kill
