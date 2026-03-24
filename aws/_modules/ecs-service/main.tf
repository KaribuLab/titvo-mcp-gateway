data "aws_region" "current" {}

data "aws_ecs_cluster" "cluster" {
  cluster_name = var.cluster_name
}

# IAM Role for Task Execution (pulling images, logging)
resource "aws_iam_role" "task_execution_role" {
  name = "${var.service_name}-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy_attachment" "task_execution_role_policy" {
  role       = aws_iam_role.task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# IAM Role for Task (application permissions)
resource "aws_iam_role" "task_role" {
  name = "${var.service_name}-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "task_policy" {
  count = var.task_policy_json != null ? 1 : 0

  name   = "${var.service_name}-task-policy"
  role   = aws_iam_role.task_role.id
  policy = var.task_policy_json
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "service" {
  name              = var.cloudwatch_log_group_name
  retention_in_days = var.log_retention_days
  tags              = var.tags
}

# ECS Task Definition
resource "aws_ecs_task_definition" "service" {
  family                   = var.service_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.task_execution_role.arn
  task_role_arn            = aws_iam_role.task_role.arn

  container_definitions = jsonencode([
    {
      name      = var.service_name
      image     = "${var.docker_image}:${var.image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = var.environment_variables
      secrets     = length(var.secrets) > 0 ? var.secrets : null

      healthCheck = {
        command     = var.health_check.command
        interval    = var.health_check.interval
        timeout     = var.health_check.timeout
        retries     = var.health_check.retries
        startPeriod = var.health_check.startPeriod
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.service.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = var.tags
}

# Service Discovery Service (optional)
resource "aws_service_discovery_service" "service" {
  count = var.service_discovery != null ? 1 : 0

  name = var.service_discovery.dns.name

  dns_config {
    namespace_id = var.service_discovery.namespace_id

    dns_records {
      ttl  = var.service_discovery.dns.ttl
      type = var.service_discovery.dns.type
    }

    routing_policy = "MULTIVALUE"
  }

  tags = var.tags
}

resource "aws_security_group" "service" {
  vpc_id      = var.vpc_id
  name        = "${var.service_name}-sg"
  description = "SG for ${var.service_name}"
}

resource "aws_vpc_security_group_ingress_rule" "from_allowed_sgs_3000" {
  for_each = toset(var.security_group_ids)
  security_group_id            = aws_security_group.service.id
  referenced_security_group_id = each.value
  ip_protocol                  = "tcp"
  from_port                    = var.container_port
  to_port                      = var.container_port
  description                  = "Allow ${var.container_port} from ${each.value}"
}

resource "aws_vpc_security_group_egress_rule" "all_outbound_ipv4" {
  security_group_id = aws_security_group.service.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
  description       = "Allow all outbound IPv4"
}

resource "aws_vpc_security_group_egress_rule" "all_outbound_ipv6" {
  security_group_id = aws_security_group.service.id
  ip_protocol       = "-1"
  cidr_ipv6         = "::/0"
  description       = "Allow all outbound IPv6"
}

# ECS Service
resource "aws_ecs_service" "service" {
  name            = var.service_name
  cluster         = data.aws_ecs_cluster.cluster.arn
  task_definition = aws_ecs_task_definition.service.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = var.assign_public_ip
  }

  dynamic "service_registries" {
    for_each = var.service_discovery != null ? [1] : []
    content {
      registry_arn = aws_service_discovery_service.service[0].arn
    }
  }

  force_new_deployment = var.force_new_deployment

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = var.tags
}

# Auto Scaling Target
resource "aws_appautoscaling_target" "service" {
  count = var.autoscaling_config != null ? 1 : 0

  max_capacity       = var.autoscaling_config.max_capacity
  min_capacity       = var.autoscaling_config.min_capacity
  resource_id        = "service/${var.cluster_name}/${aws_ecs_service.service.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# CPU Auto Scaling Policy
resource "aws_appautoscaling_policy" "cpu" {
  count = var.autoscaling_config != null ? 1 : 0

  name               = "${var.service_name}-cpu-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.service[0].resource_id
  scalable_dimension = aws_appautoscaling_target.service[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.service[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = var.autoscaling_config.cpu.target_value
    scale_in_cooldown  = var.autoscaling_config.cpu.scale_in_cooldown
    scale_out_cooldown = var.autoscaling_config.cpu.scale_out_cooldown
  }
}

# Memory Auto Scaling Policy
resource "aws_appautoscaling_policy" "memory" {
  count = var.autoscaling_config != null ? 1 : 0

  name               = "${var.service_name}-memory-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.service[0].resource_id
  scalable_dimension = aws_appautoscaling_target.service[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.service[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = var.autoscaling_config.memory.target_value
    scale_in_cooldown  = var.autoscaling_config.memory.scale_in_cooldown
    scale_out_cooldown = var.autoscaling_config.memory.scale_out_cooldown
  }
}

