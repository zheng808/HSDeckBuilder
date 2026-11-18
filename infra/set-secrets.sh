#!/bin/bash
# Pushes the app's runtime secrets to both hosts from a local env file (never committed).
#
#   cp infra/secrets.env.example infra/secrets.env   # fill it in
#   ./infra/set-secrets.sh infra/secrets.env [aws|fly|all]
#
# AWS: each KEY=VALUE becomes SSM Parameter Store /hsdeck/KEY (SecureString); the
#      instance reads them on every deploy (infra/aws/deploy.sh).
# Fly: `flyctl secrets set`, which also restarts the app.
set -euo pipefail
FILE="${1:?usage: set-secrets.sh <env-file> [aws|fly|all]}"
TARGET="${2:-all}"
REGION="${AWS_DEFAULT_REGION:-us-west-2}"
FLY_APP="${FLY_APP:-hsdeckbuilder}"

mapfile -t PAIRS < <(grep -E '^[A-Z0-9_]+=' "$FILE" | grep -vE '^(APP_URL)=')

if [ "$TARGET" = aws ] || [ "$TARGET" = all ]; then
  for kv in "${PAIRS[@]}"; do
    name="${kv%%=*}"; value="${kv#*=}"
    [ -n "$value" ] || continue
    aws ssm put-parameter --region "$REGION" --name "/hsdeck/$name" --value "$value" \
      --type SecureString --overwrite --query Version --output text >/dev/null
    echo "aws: /hsdeck/$name set"
  done
  echo "aws: redeploy to apply ->  $(cd "$(dirname "$0")/aws" && tofu output -raw deploy_command 2>/dev/null || echo 'see infra/aws/outputs.tf')"
fi

if [ "$TARGET" = fly ] || [ "$TARGET" = all ]; then
  args=()
  for kv in "${PAIRS[@]}"; do [ -n "${kv#*=}" ] && args+=("$kv"); done
  args+=("APP_URL=https://$FLY_APP.fly.dev")
  flyctl secrets set --app "$FLY_APP" "${args[@]}" >/dev/null && echo "fly: ${#args[@]} secrets set (app restarting)"
fi
