output "url" {
  description = "Public HTTPS URL of the app."
  value       = "https://${local.app_host}"
}

output "public_ip" {
  value = aws_eip.app.public_ip
}

output "instance_id" {
  value = aws_instance.app.id
}

output "ssm_session_command" {
  description = "Open a shell on the instance (needs the AWS CLI session-manager-plugin)."
  value       = "aws ssm start-session --region ${var.region} --target ${aws_instance.app.id}"
}

output "deploy_command" {
  description = "Pull the latest image and restart the app (what the GitHub workflow runs)."
  value       = "aws ssm send-command --region ${var.region} --targets Key=tag:App,Values=${var.app_name} --document-name AWS-RunShellScript --parameters commands=/opt/hsdeck/deploy.sh"
}

output "github_deploy_role_arn" {
  description = "Set this as the AWS_DEPLOY_ROLE_ARN repository variable in GitHub."
  value       = local.github_deploy_role_arn
}
