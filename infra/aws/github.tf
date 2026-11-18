# Lets GitHub Actions deploy without long-lived AWS keys: the workflow assumes
# this role through OIDC and asks SSM to run /opt/hsdeck/deploy.sh on the instance.

data "aws_caller_identity" "current" {}

locals {
  github_enabled         = var.github_repository != ""
  create_oidc_provider   = local.github_enabled && var.github_oidc_provider_arn == ""
  github_oidc_provider   = local.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : var.github_oidc_provider_arn
  github_deploy_role_arn = local.github_enabled ? aws_iam_role.github_deploy[0].arn : ""
}

resource "aws_iam_openid_connect_provider" "github" {
  count = local.create_oidc_provider ? 1 : 0

  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1", "1c58a3a8518e8759bf075b76b750d4f2df264fcd"]
}

resource "aws_iam_role" "github_deploy" {
  count = local.github_enabled ? 1 : 0

  name = "${var.app_name}-github-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = local.github_oidc_provider }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = { "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com" }
        StringLike   = { "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:*" }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_deploy" {
  count = local.github_enabled ? 1 : 0

  name = "${var.app_name}-github-deploy"
  role = aws_iam_role.github_deploy[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ssm:SendCommand"]
        Resource = ["arn:aws:ssm:${var.region}::document/AWS-RunShellScript"]
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:SendCommand"]
        Resource = ["arn:aws:ec2:${var.region}:${data.aws_caller_identity.current.account_id}:instance/*"]
        Condition = {
          StringEquals = { "ssm:resourceTag/App" = var.app_name }
        }
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:ListCommandInvocations", "ssm:GetCommandInvocation", "ssm:ListCommands"]
        Resource = "*"
      }
    ]
  })
}
