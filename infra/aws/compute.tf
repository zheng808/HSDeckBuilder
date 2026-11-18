# One Graviton instance running Amazon Linux 2023, the app container and Caddy
# (automatic HTTPS). The SQLite database lives on a separate EBS volume so the
# instance can be replaced without losing decks.

locals {
  ami_parameter = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-${var.architecture}"
  # sslip.io resolves 1-2-3-4.sslip.io to 1.2.3.4, which gives Caddy a hostname
  # for a Let's Encrypt / ZeroSSL certificate without owning a domain.
  app_host = "${replace(aws_eip.app.public_ip, ".", "-")}.sslip.io"
}

data "aws_ssm_parameter" "al2023" {
  name = local.ami_parameter
}

resource "aws_iam_role" "instance" {
  name = "${var.app_name}-instance"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Session Manager (shell access without SSH) and nothing else.
resource "aws_iam_role_policy_attachment" "instance_ssm" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Read runtime secrets (OAuth, API keys) from Parameter Store under /hsdeck/.
resource "aws_iam_role_policy" "instance_params" {
  name = "${var.app_name}-params"
  role = aws_iam_role.instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParametersByPath", "ssm:GetParameter"]
      Resource = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/hsdeck/*"
    }]
  })
}

resource "aws_iam_instance_profile" "instance" {
  name = "${var.app_name}-instance"
  role = aws_iam_role.instance.name
}

resource "aws_eip" "app" {
  domain = "vpc"

  tags = { Name = var.app_name }
}

resource "aws_ebs_volume" "data" {
  availability_zone = aws_subnet.public.availability_zone
  size              = var.data_volume_size_gb
  type              = "gp3"
  encrypted         = true

  tags = {
    Name     = "${var.app_name}-data"
    Snapshot = "true" # picked up by the DLM snapshot policy
  }
}

resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.al2023.value
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.web.id]
  iam_instance_profile   = aws_iam_instance_profile.instance.name

  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    image             = var.image
    app_host          = local.app_host
    volume_id_nodash  = replace(aws_ebs_volume.data.id, "-", "")
    deploy_script_url = var.deploy_script_url
  })
  # user data only runs at first boot; later script changes ship via deploy.sh, so don't replace the instance
  user_data_replace_on_change = false

  root_block_device {
    volume_size = 8
    volume_type = "gp3"
    encrypted   = true
  }

  metadata_options {
    http_tokens = "required" # IMDSv2 only
  }

  tags = {
    Name = var.app_name
    App  = var.app_name # the deploy pipeline targets instances by this tag
  }

  depends_on = [aws_internet_gateway.igw]
}

resource "aws_volume_attachment" "data" {
  device_name                    = "/dev/sdf"
  volume_id                      = aws_ebs_volume.data.id
  instance_id                    = aws_instance.app.id
  stop_instance_before_detaching = true
}

resource "aws_eip_association" "app" {
  instance_id   = aws_instance.app.id
  allocation_id = aws_eip.app.id
}
