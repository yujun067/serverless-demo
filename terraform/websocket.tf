# WebSocket Service Infrastructure
# ECS, ECR, Application Load Balancer

# ECR Repository for WebSocket Service
resource "aws_ecr_repository" "websocket" {
  name                 = "${local.name_prefix}-websocket"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.common_tags
}

# ECS Task Definition for WebSocket Service
resource "aws_ecs_task_definition" "websocket" {
  family                   = "${local.name_prefix}-websocket"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.fargate_cpu
  memory                   = var.fargate_memory
  execution_role_arn       = aws_iam_role.fargate_execution.arn
  task_role_arn            = aws_iam_role.fargate_task.arn

  container_definitions = jsonencode([
    {
      name  = "websocket-service"
      image = "${aws_ecr_repository.websocket.repository_url}:latest"

      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "REDIS_HOST"
          value = aws_elasticache_cluster.main.cache_nodes[0].address
        },
        {
          name  = "REDIS_PORT"
          value = tostring(aws_elasticache_cluster.main.cache_nodes[0].port)
        },
        {
          name  = "DYNAMODB_TABLE"
          value = aws_dynamodb_table.user_scores.name
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.websocket.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }

      essential = true
    }
  ])

  tags = local.common_tags
}

# Application Load Balancer
resource "aws_lb" "websocket" {
  name               = "bitcoin-game-websocket-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
  idle_timeout       = 300 # 5 minutes for long-lived connections

  enable_deletion_protection = false

  tags = local.common_tags
}

# ALB Target Group
resource "aws_lb_target_group" "websocket" {
  name        = "bitcoin-game-websocket-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  # Enable connection draining for graceful shutdowns
  deregistration_delay = 30

  tags = local.common_tags
}

# Self-signed certificate for ALB
resource "tls_private_key" "websocket" {
  algorithm = "RSA"
  rsa_bits  = 2048
}

resource "tls_self_signed_cert" "websocket" {
  private_key_pem = tls_private_key.websocket.private_key_pem

  subject {
    common_name  = aws_lb.websocket.dns_name
    organization = "Bitcoin Prediction Game"
  }

  validity_period_hours = 8760 # 1 year

  allowed_uses = [
    "key_encipherment",
    "digital_signature",
    "server_auth",
  ]
}

resource "aws_acm_certificate" "websocket" {
  private_key      = tls_private_key.websocket.private_key_pem
  certificate_body = tls_self_signed_cert.websocket.cert_pem

  tags = local.common_tags
}

# ALB HTTP Listener (redirect to HTTPS)
resource "aws_lb_listener" "websocket_http" {
  load_balancer_arn = aws_lb.websocket.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ALB HTTPS Listener
resource "aws_lb_listener" "websocket_https" {
  load_balancer_arn = aws_lb.websocket.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = aws_acm_certificate.websocket.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.websocket.arn
  }
}

# ECS Service
resource "aws_ecs_service" "websocket" {
  name            = "${local.name_prefix}-websocket-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.websocket.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.fargate.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.websocket.arn
    container_name   = "websocket-service"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.websocket_https]

  tags = local.common_tags
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "websocket" {
  name              = "/ecs/${local.name_prefix}-websocket"
  retention_in_days = 7

  tags = local.common_tags
}
