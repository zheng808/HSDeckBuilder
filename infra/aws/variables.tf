variable "region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-west-2"
}

variable "app_name" {
  description = "Name used for resource names and the App tag (the deploy pipeline targets this tag)."
  type        = string
  default     = "hsdeckbuilder"
}

variable "image" {
  description = "Container image to run. Must be public or pullable without credentials."
  type        = string
  default     = "ghcr.io/zheng808/hsdeckbuilder:latest"
}

variable "architecture" {
  description = "CPU architecture of the instance type: arm64 (Graviton, cheaper) or x86_64."
  type        = string
  default     = "arm64"

  validation {
    condition     = contains(["arm64", "x86_64"], var.architecture)
    error_message = "architecture must be arm64 or x86_64."
  }
}

variable "instance_type" {
  description = "EC2 instance type. t4g.* are arm64; t3.* are x86_64. 1 GiB RAM is plenty for the app."
  type        = string
  default     = "t4g.micro"
}

variable "data_volume_size_gb" {
  description = "Size of the EBS volume that holds the SQLite database and TLS certificates."
  type        = number
  default     = 8
}

variable "snapshot_retain_count" {
  description = "How many daily EBS snapshots of the data volume to keep."
  type        = number
  default     = 7
}

variable "github_repository" {
  description = "GitHub repository (owner/name) allowed to assume the deploy role from Actions. Empty string disables the role."
  type        = string
  default     = "zheng808/HSDeckBuilder"
}

variable "github_oidc_provider_arn" {
  description = "ARN of an existing GitHub OIDC provider in this account. Leave empty to create one (an account can only have one per URL)."
  type        = string
  default     = ""
}
