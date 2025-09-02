# Lambda Functions
# Lambda function definitions and permissions

# User Registration Lambda Function
resource "aws_lambda_function" "user_registration" {
  filename      = "../lambda/dist/user-registration.zip"
  function_name = "${local.name_prefix}-user-registration"
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 30
  memory_size   = 256

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.user_scores.name
      REDIS_HOST     = aws_elasticache_cluster.main.cache_nodes[0].address
      REDIS_PORT     = tostring(aws_elasticache_cluster.main.cache_nodes[0].port)
      JWT_SECRET     = var.jwt_secret
    }
  }

  tags = local.common_tags
}

# User Login Lambda Function
resource "aws_lambda_function" "user_login" {
  filename      = "../lambda/dist/user-login.zip"
  function_name = "${local.name_prefix}-user-login"
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 30
  memory_size   = 256

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.user_scores.name
      REDIS_HOST     = aws_elasticache_cluster.main.cache_nodes[0].address
      REDIS_PORT     = tostring(aws_elasticache_cluster.main.cache_nodes[0].port)
      JWT_SECRET     = var.jwt_secret
    }
  }

  tags = local.common_tags
}

# Get User Score Lambda Function
resource "aws_lambda_function" "get_user_score" {
  filename      = "../lambda/dist/get-user-score.zip"
  function_name = "${local.name_prefix}-get-user-score"
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 30
  memory_size   = 256

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.user_scores.name
      REDIS_HOST     = aws_elasticache_cluster.main.cache_nodes[0].address
      REDIS_PORT     = tostring(aws_elasticache_cluster.main.cache_nodes[0].port)
      JWT_SECRET     = var.jwt_secret
    }
  }

  tags = local.common_tags
}

# Submit Guess Lambda Function
resource "aws_lambda_function" "submit_guess" {
  filename      = "../lambda/dist/submit-guess.zip"
  function_name = "${local.name_prefix}-submit-guess"
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 30
  memory_size   = 256

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.user_scores.name
      REDIS_HOST     = aws_elasticache_cluster.main.cache_nodes[0].address
      REDIS_PORT     = tostring(aws_elasticache_cluster.main.cache_nodes[0].port)
      JWT_SECRET     = var.jwt_secret
    }
  }

  tags = local.common_tags
}

# Get Latest Price Lambda Function
resource "aws_lambda_function" "get_latest_price" {
  filename      = "../lambda/dist/get-latest-price.zip"
  function_name = "${local.name_prefix}-get-latest-price"
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 30
  memory_size   = 256

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.user_scores.name
      REDIS_HOST     = aws_elasticache_cluster.main.cache_nodes[0].address
      REDIS_PORT     = tostring(aws_elasticache_cluster.main.cache_nodes[0].port)
      JWT_SECRET     = var.jwt_secret
    }
  }

  tags = local.common_tags
}

# Lambda Permissions for API Gateway
resource "aws_lambda_permission" "api_gateway_user_registration" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.user_registration.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_user_login" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.user_login.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_get_user_score" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_user_score.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_submit_guess" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.submit_guess.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "api_gateway_get_latest_price" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_latest_price.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}
