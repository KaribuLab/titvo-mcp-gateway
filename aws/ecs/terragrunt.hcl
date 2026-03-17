terraform {
  # Módulo local sin dependencia de ALB
  source = "${get_parent_terragrunt_dir()}/aws/_modules/ecs-service"
}

locals {
  serverless   = read_terragrunt_config(find_in_parent_folders("serverless.hcl"))
  base_path    = "${local.serverless.locals.parameter_path}/${local.serverless.locals.stage}"
  service_name = "${local.serverless.locals.service_name}-service-${local.serverless.locals.stage}"
  common_tags  = local.serverless.locals.common_tags
  image_tag    = get_env("GITHUB_SHA", "latest")
}

dependency "parameter" {
  config_path = "${get_parent_terragrunt_dir()}/aws/parameter"
  mock_outputs = {
    parameters = {
      "/tvo/security-scan/prod/infra/ecs/cluster_name"                     = "tvo-mcp-cluster-prod"
      "/tvo/security-scan/prod/infra/eventbridge/eventbus_arn"             = "arn:aws:events:us-east-2:123456789012:event-bus/tvo-event-bus"
      "/tvo/security-scan/prod/infra/eventbridge/eventbus_name"            = "tvo-event-bus"
      "/tvo/security-scan/prod/infra/vpc/subnets/private"        = "[\"subnet-123abc\"]"
      "/tvo/security-scan/prod/infra/vpc/vpc_id"                           = "vpc-123abc"
      "/tvo/security-scan/prod/infra/vpc/security-group/security_group_id" = "sg-ecs-123abc"
      "/tvo/security-scan/prod/infra/cloudmap/cloudmap_id"                 = "ns-123abc"
      "/tvo/security-scan/prod/infra/sqs/mcp/gateway/output/queue_arn"     = "arn:aws:sqs:us-east-2:123456789012:tvo-mcp-gateway-output"
      "/tvo/security-scan/prod/infra/sqs/mcp/gateway/output/queue_url"     = "https://sqs.us-east-2.amazonaws.com/123456789012/tvo-mcp-gateway-output"
      "/tvo/security-scan/prod/infra/dynamo/jobs-table-arn"                = "arn:aws:dynamodb:us-east-2:123456789012:table/tvo-mcp-jobs"
      "/tvo/security-scan/prod/infra/dynamo/jobs-table-name"               = "tvo-mcp-jobs"
      "/tvo/security-scan/prod/infra/s3/git-commit-files/bucket_arn"       = "arn:aws:s3:::tvo-mcp-git-commit-files"
      "/tvo/security-scan/prod/infra/s3/git-commit-files/bucket_name"      = "tvo-mcp-git-commit-files"
    }
  }
}

dependency "ecr" {
  config_path = "${get_parent_terragrunt_dir()}/aws/ecr"
  mock_outputs = {
    ecr_repository_url = "123456789012.dkr.ecr.us-east-2.amazonaws.com/tvo-mcp-gateway-service"
  }
}

include {
  path = find_in_parent_folders()
}

inputs = {
  cluster_name          = dependency.parameter.outputs.parameters["${local.base_path}/infra/ecs/cluster_name"]
  service_name          = local.service_name
  docker_image          = dependency.ecr.outputs.ecr_repository_url
  image_tag             = local.image_tag
  container_port        = 3000
  task_cpu              = 512
  task_memory           = 1024
  desired_count         = 1
  subnet_ids            = jsondecode(dependency.parameter.outputs.parameters["${local.base_path}/infra/vpc/subnets/private"])
  vpc_id                = dependency.parameter.outputs.parameters["${local.base_path}/infra/vpc/vpc_id"]
  security_group_ids    = [dependency.parameter.outputs.parameters["${local.base_path}/infra/vpc/security-group/security_group_id"]]
  assign_public_ip      = false
  
  environment_variables = [
    {
      name  = "NODE_ENV"
      value = "production"
    },
    {
      name  = "CLOUD_PROVIDER"
      value = "aws"
    },
    {
      name  = "AWS_STAGE"
      value = local.serverless.locals.stage
    },
    {
      name  = "AWS_REGION"
      value = local.serverless.locals.region
    },
    {
      name  = "AWS_EVENTBUS_NAME"
      value = dependency.parameter.outputs.parameters["${local.base_path}/infra/eventbridge/eventbus_name"]
    },
    {
      name  = "AWS_QUEUE_URL"
      value = dependency.parameter.outputs.parameters["${local.base_path}/infra/sqs/mcp/gateway/output/queue_url"]
    },
    {
      name  = "AWS_DYNAMODB_TABLE_NAME"
      value = dependency.parameter.outputs.parameters["${local.base_path}/infra/dynamo/jobs-table-name"]
    },
    {
      name  = "AWS_S3_BUCKET_NAME"
      value = dependency.parameter.outputs.parameters["${local.base_path}/infra/s3/git-commit-files/bucket_name"]
    },
  ]
  
  # Service Discovery con CloudMap para comunicación interna
  service_discovery = {
    namespace_id = dependency.parameter.outputs.parameters["${local.base_path}/infra/cloudmap/cloudmap_id"]
    dns = {
      name = "gateway"
      type = "A"
      ttl  = 60
    }
  }
  
  # Health check interno
  health_check = {
    command     = ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
    interval    = 30
    timeout     = 5
    retries     = 3
    startPeriod = 60
  }
  
  # Autoscaling
  autoscaling_config = {
    min_capacity = 1
    max_capacity = 4
    cpu = {
      target_value       = 80
      scale_in_cooldown  = 300
      scale_out_cooldown = 300
    }
    memory = {
      target_value       = 80
      scale_in_cooldown  = 300
      scale_out_cooldown = 300
    }
  }
  
  # IAM Policy para el task
  task_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "events:PutEvents"
        ]
        Resource = [
          dependency.parameter.outputs.parameters["${local.base_path}/infra/eventbridge/eventbus_arn"]
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:ChangeMessageVisibility",
          "sqs:GetQueueAttributes",
        ]
        Resource = [
          dependency.parameter.outputs.parameters["${local.base_path}/infra/sqs/mcp/gateway/output/queue_arn"]
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
        ]
        Resource = [
          dependency.parameter.outputs.parameters["${local.base_path}/infra/dynamo/jobs-table-arn"]
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket",
        ]
        Resource = [
          dependency.parameter.outputs.parameters["${local.base_path}/infra/s3/git-commit-files/bucket_arn"],
          "${dependency.parameter.outputs.parameters["${local.base_path}/infra/s3/git-commit-files/bucket_arn"]}/*"
        ]
      },
    ]
  })
  
  cloudwatch_log_group_name = "/aws/ecs/${local.service_name}"
  log_retention_days        = local.serverless.locals.log_retention
  force_new_deployment      = true
  
  tags = merge(local.common_tags, {
    Name        = local.service_name
    Environment = local.serverless.locals.stage
  })
}
