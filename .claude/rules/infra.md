---
paths:
  - 'infra/**'
---

# Rules for infra/

- OpenTofu (not Terraform CLI): run `tofu fmt -recursive`, `tofu init -backend=false` and `tofu validate` in `infra/aws` before finishing. The Infra workflow enforces the same.
- Never commit state, `terraform.tfvars`, or credentials; `infra/aws/.gitignore` covers them. Never paste account ids or keys into docs.
- `tofu apply`/`destroy` create or delete billable resources: only run them when the user explicitly asks, after showing the plan, and only against the user's personal AWS account (`aws sts get-caller-identity` first).
- Keep the instance scripts idempotent: `deploy.sh` is re-run by the GitHub workflow on every release.
- Changing `user_data.sh.tftpl` replaces the instance (data volume survives); say so when proposing such a change.
