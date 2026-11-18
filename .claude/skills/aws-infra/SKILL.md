---
name: aws-infra
description: Operate the AWS deployment defined in infra/aws with OpenTofu — plan/apply/destroy, read outputs, open an SSM shell, redeploy the image, check bootstrap logs, estimate cost. Use for anything about the EC2/EBS/Caddy stack or the GitHub→AWS deploy role.
allowed-tools: Bash, Read, Grep
argument-hint: '[plan|apply|destroy|status|logs|redeploy]'
---

# AWS stack (infra/aws)

Always start with `aws sts get-caller-identity` and confirm it is the user's **personal** account; stop if it looks like a work account.

| Task                  | Command (run in `infra/aws`)                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Validate              | `tofu fmt -recursive && tofu init -backend=false && tofu validate`                                                      |
| Plan                  | `tofu init && tofu plan` (read-only; show the summary to the user)                                                      |
| Apply / destroy       | only on explicit request: `tofu apply` / `tofu destroy` (billable; destroy deletes the volume and snapshots)            |
| Outputs               | `tofu output` → `url`, `instance_id`, `ssm_session_command`, `deploy_command`, `github_deploy_role_arn`                 |
| Health                | `curl -s "$(tofu output -raw url)/api/health"`                                                                          |
| Shell                 | `aws ssm start-session --target "$(tofu output -raw instance_id)"` (needs session-manager-plugin)                       |
| Bootstrap log         | in the shell: `sudo tail -n 100 /var/log/hsdeck-bootstrap.log`; containers: `sudo docker ps`, `sudo docker logs hsdeck` |
| Redeploy latest image | `eval "$(tofu output -raw deploy_command)"` or trigger the "Deploy to AWS" workflow                                     |
| Seed pro lists        | happens in `deploy.sh`; manually: `sudo docker exec hsdeck npm run import:pro-decks`                                    |

Gotchas: the first HTTPS certificate takes up to a minute after boot; `sslip.io` depends on Let's Encrypt/ZeroSSL rate limits; changing `user_data.sh.tftpl` replaces the instance. `$ARGUMENTS` names the task when the skill is invoked with one.
