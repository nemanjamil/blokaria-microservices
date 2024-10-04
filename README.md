# NodeJs BackEnd for Cardano and Avalanche BlockChain on [Moleculer](https://moleculer.services/)

# Cardano-Moleculer

This is a [Moleculer](https://moleculer.services/)-based microservices project. Generated with the [Moleculer CLI](https://moleculer.services/docs/0.14/moleculer-cli.html).

# Email template

https://github.com/konsav/email-templates

This **project** is dependent of

-   [Caradano transactions service](https://github.com/nemanjamil/blokaria-cardano-service)
-   [Avalanche transactions service](https://github.com/nemanjamil/blokaria-avalanche-service)

## Setting up project s

-   yarn
-   npm run dev (yarn dev)

## GRAFANA SET UP - use grafana.yml file

0. https://grafana.com/docs/loki/latest/setup/install/docker/
1. docker volume create grafana-volume
2. /home/admin/loki
3. Create folders and file
    - data
    - docker-compose.yml
    - promtail-config

### Add file

-   cd /etc/docker
-   sudo vi deamon.json

{
"debug" : true,
"log-driver": "loki",
"log-opts": {
"loki-url": "http://127.0.0.1:3100/loki/api/v1/push",
"loki-batch-size": "400"
}
}

### restart docker

docker-compose up -d --force-recreate

### CHECK if docker knows Loki

docker inspect -f '{{.HostConfig.LogConfig.Type}}' moleculer
docker info --format '{{.LoggingDriver}}'
docker plugin ls
