#!/bin/bash
# Pulls the latest image and (re)starts the app behind Caddy. Idempotent.
# Runtime configuration comes from SSM Parameter Store under /hsdeck/<name> (SecureString
# or String); every parameter becomes an environment variable of the same name.
set -euo pipefail
IMAGE="${IMAGE:-ghcr.io/zheng808/hsdeckbuilder:latest}"
IMDS_TOKEN=$(curl -sX PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')
imds() { curl -s -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" "http://169.254.169.254/latest/meta-data/$1"; }
REGION="${REGION:-$(imds placement/region)}"
if [ -z "${APP_HOST:-}" ]; then
  if [ -f /opt/hsdeck/app_host ]; then APP_HOST=$(cat /opt/hsdeck/app_host)
  else APP_HOST="$(imds public-ipv4 | tr . -).sslip.io"; fi
fi

ENV_FILE=/opt/hsdeck/app.env
umask 077
{
  echo "APP_URL=https://$APP_HOST"
  aws ssm get-parameters-by-path --region "$REGION" --path /hsdeck/ --with-decryption \
    --query 'Parameters[].[Name,Value]' --output text 2>/dev/null \
    | awk -F'\t' '{ sub("^/hsdeck/", "", $1); print $1"="$2 }'
} > "$ENV_FILE"

docker network inspect hsdeck >/dev/null 2>&1 || docker network create hsdeck
docker pull "$IMAGE"
docker rm -f hsdeck >/dev/null 2>&1 || true
docker run -d --name hsdeck --restart unless-stopped --network hsdeck \
  --env-file "$ENV_FILE" -v /data/app:/data "$IMAGE"

for i in $(seq 1 30); do
  if docker exec hsdeck wget -qO- http://127.0.0.1:3001/api/health >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec hsdeck npm run import:pro-decks || true

if ! docker ps --format '{{.Names}}' | grep -qx caddy; then
  docker run -d --name caddy --restart unless-stopped --network hsdeck \
    -p 80:80 -p 443:443 -v /data/caddy:/data caddy:2 \
    caddy reverse-proxy --from "https://$APP_HOST" --to hsdeck:3001
fi
docker image prune -f >/dev/null 2>&1 || true
echo "deployed $IMAGE at https://$APP_HOST"
