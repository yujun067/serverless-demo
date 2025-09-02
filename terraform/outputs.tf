output "website_bucket_name" {
  description = "Name of the S3 bucket hosting the website"
  value       = aws_s3_bucket.website.bucket
}

output "website_endpoint" {
  description = "S3 website endpoint"
  value       = aws_s3_bucket_website_configuration.website.website_endpoint
}

output "website_url" {
  description = "Full URL of the website"
  value       = "https://${aws_cloudfront_distribution.website.domain_name}"
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table"
  value       = aws_dynamodb_table.user_scores.name
}

output "elasticache_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = aws_elasticache_cluster.main.cache_nodes[0].address
}

output "elasticache_port" {
  description = "ElastiCache Redis port"
  value       = aws_elasticache_cluster.main.cache_nodes[0].port
}

output "ecr_repository_url" {
  description = "ECR repository URL for WebSocket service"
  value       = aws_ecr_repository.websocket.repository_url
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "lambda_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda.arn
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.website.id
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.website.domain_name
}

output "api_gateway_url" {
  description = "API Gateway URL"
  value       = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${var.aws_region}.amazonaws.com/prod"
}

output "api_gateway_id" {
  description = "API Gateway ID"
  value       = aws_api_gateway_rest_api.main.id
}

output "websocket_service_name" {
  description = "Name of the WebSocket ECS service"
  value       = aws_ecs_service.websocket.name
}

output "websocket_task_definition_arn" {
  description = "ARN of the WebSocket task definition"
  value       = aws_ecs_task_definition.websocket.arn
}

output "websocket_log_group_name" {
  description = "Name of the CloudWatch log group for WebSocket service"
  value       = aws_cloudwatch_log_group.websocket.name
}

output "websocket_alb_dns_name" {
  description = "DNS name of the WebSocket ALB"
  value       = aws_lb.websocket.dns_name
}

output "sse_endpoint_url" {
  description = "SSE endpoint URL for WebSocket service"
  value       = "https://${aws_lb.websocket.dns_name}/sse/price"
}

output "project_prefix" {
  description = "Project prefix used for resource naming"
  value       = local.name_prefix
}
