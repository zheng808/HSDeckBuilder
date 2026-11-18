# AWS deployment with OpenTofu

Runs the deck builder on AWS as one small ARM instance with a persistent disk, no domain required.

```
GitHub Actions ──OIDC──▶ IAM role ──SSM SendCommand──▶ EC2 (Amazon Linux 2023, Docker)
                                                        ├─ hsdeck container  (ghcr.io image, SQLite at /data/app)
                                                        ├─ caddy container   (HTTPS for <ip>.sslip.io)
                                                        └─ EBS data volume   (daily DLM snapshots)
VPC 10.42.0.0/16 → public subnet → internet gateway → Elastic IP → security group (80, 443 only)
```

What you get and why:

| Resource                                              | Why                                                                                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| VPC, subnet, IGW, route table                         | A self-contained network; `tofu destroy` leaves nothing behind.                                                        |
| `t4g.micro` instance (Graviton)                       | Cheapest sensible box; the app needs ~150 MB RAM. AMI resolved from the AL2023 SSM parameter.                          |
| EBS `gp3` data volume + DLM policy                    | Decks survive instance replacement; 7 daily snapshots.                                                                 |
| Elastic IP + `sslip.io` hostname                      | Stable address and a real HTTPS certificate via Caddy, without buying a domain.                                        |
| IAM instance role with `AmazonSSMManagedInstanceCore` | Shell access with `aws ssm start-session`; no SSH port, no key pairs.                                                  |
| GitHub OIDC provider + deploy role                    | Actions deploys with short-lived credentials; the role can only run SSM commands on instances tagged `App=<app_name>`. |

## Prerequisites

- An AWS account you own (this is a personal project; don't put it in a work account).
- AWS CLI configured: `aws configure` (access key) or `aws configure sso`, then `aws sts get-caller-identity` shows your account.
- OpenTofu ≥ 1.6 (`brew install opentofu`). Optional: `brew install --cask session-manager-plugin` for `aws ssm start-session`.

## Deploy

```bash
cd infra/aws
cp terraform.tfvars.example terraform.tfvars   # edit region/instance type if you like
tofu init
tofu plan
tofu apply
```

`apply` takes about two minutes, then the instance bootstraps itself (Docker install, volume format, image pull, Caddy certificate) for another two to three minutes. Watch it with:

```bash
tofu output                     # url, instance_id, ssm_session_command, github_deploy_role_arn
curl -s "$(tofu output -raw url)/api/health"
aws ssm start-session --target "$(tofu output -raw instance_id)"   # then: sudo tail -f /var/log/hsdeck-bootstrap.log
```

The bootstrap runs `/opt/hsdeck/deploy.sh`, which also seeds the pro lists.

## Continuous deployment from GitHub

1. `tofu output -raw github_deploy_role_arn`
2. In the GitHub repo: Settings → Secrets and variables → Actions → **Variables**: add `AWS_DEPLOY_ROLE_ARN` (the ARN) and, if not `us-west-2`, `AWS_REGION`.
3. From then on every successful "Release image" run on `main` triggers "Deploy to AWS", which runs `deploy.sh` on the instance via SSM. You can also run it manually from the Actions tab, or locally with the `deploy_command` output.

## Cost (us-west-2, on demand)

| Item                        | Approx. per month |
| --------------------------- | ----------------- |
| t4g.micro                   | $6.10             |
| Public IPv4 address         | $3.65             |
| 8 GB root + 8 GB data (gp3) | $1.30             |
| Snapshots, data transfer    | pennies           |

About $11/month. New accounts' free-tier credits may cover it. `tofu destroy` removes everything, including the volume and snapshots; copy `/data/app/decks.db` off first if you want the decks.

## State

State is kept locally in `infra/aws/terraform.tfstate` (git-ignored, contains resource ids). For a shared/team setup, add an S3 backend block in `versions.tf`.

## Troubleshooting

- **Certificate not issued yet**: Caddy needs port 80/443 reachable and DNS for `<ip>.sslip.io`; first issuance takes up to a minute. Let's Encrypt rate-limits `sslip.io` as a whole; Caddy falls back to ZeroSSL automatically. A custom domain removes this dependency: point an A record at the Elastic IP and set `--from` in `deploy.sh`.
- **Deploy role already exists / OIDC provider exists**: pass `github_oidc_provider_arn` to reuse an existing provider.
- **Changing `image`, `app_name` or the host**: `user_data_replace_on_change` replaces the instance; the data volume is detached and reattached, decks are kept.
