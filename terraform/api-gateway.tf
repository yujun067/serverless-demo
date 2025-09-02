resource "aws_api_gateway_rest_api" "main" {
  name        = "${local.name_prefix}-api"
  description = "Bitcoin Price Prediction Game API"
  tags        = local.common_tags
}

locals {
  cors_headers = {
    "Access-Control-Allow-Headers"     = "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With"
    "Access-Control-Allow-Origin"      = "*"
    "Access-Control-Allow-Credentials" = "true"
    "Access-Control-Max-Age"           = "86400"
  }

  endpoints = {
    get_user_score = {
      path_part    = "api-v1-user-score"
      http_method  = "GET"
      lambda_name  = "get_user_score"
      cors_methods = "GET,OPTIONS"
    }
    submit_guess = {
      path_part    = "api-v1-guess"
      http_method  = "POST"
      lambda_name  = "submit_guess"
      cors_methods = "POST,OPTIONS"
    }
    get_latest_price = {
      path_part    = "api-v1-price"
      http_method  = "GET"
      lambda_name  = "get_latest_price"
      cors_methods = "GET,OPTIONS"
    }
    user_registration = {
      path_part    = "api-v1-register"
      http_method  = "POST"
      lambda_name  = "user_registration"
      cors_methods = "POST,OPTIONS"
    }
    user_login = {
      path_part    = "api-v1-login"
      http_method  = "POST"
      lambda_name  = "user_login"
      cors_methods = "POST,OPTIONS"
    }
  }

  lambda_arns = {
    get_user_score    = aws_lambda_function.get_user_score.invoke_arn
    submit_guess      = aws_lambda_function.submit_guess.invoke_arn
    get_latest_price  = aws_lambda_function.get_latest_price.invoke_arn
    user_registration = aws_lambda_function.user_registration.invoke_arn
    user_login        = aws_lambda_function.user_login.invoke_arn
  }
}

resource "aws_api_gateway_resource" "endpoints" {
  for_each    = local.endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = each.value.path_part
}

resource "aws_api_gateway_method" "endpoints" {
  for_each      = local.endpoints
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.endpoints[each.key].id
  http_method   = each.value.http_method
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "endpoints" {
  for_each    = local.endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.endpoints[each.key].id
  http_method = aws_api_gateway_method.endpoints[each.key].http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = local.lambda_arns[each.value.lambda_name]
}

resource "aws_api_gateway_method_response" "endpoints" {
  for_each    = local.endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.endpoints[each.key].id
  http_method = aws_api_gateway_method.endpoints[each.key].http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"      = true
    "method.response.header.Access-Control-Allow-Methods"     = true
    "method.response.header.Access-Control-Allow-Headers"     = true
    "method.response.header.Access-Control-Allow-Credentials" = true
    "method.response.header.Access-Control-Max-Age"           = true
  }
}

resource "aws_api_gateway_integration_response" "endpoints" {
  for_each    = local.endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.endpoints[each.key].id
  http_method = aws_api_gateway_method.endpoints[each.key].http_method
  status_code = aws_api_gateway_method_response.endpoints[each.key].status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"      = "'*'"
    "method.response.header.Access-Control-Allow-Methods"     = "'${each.value.cors_methods}'"
    "method.response.header.Access-Control-Allow-Headers"     = "'${local.cors_headers["Access-Control-Allow-Headers"]}'"
    "method.response.header.Access-Control-Allow-Credentials" = "'${local.cors_headers["Access-Control-Allow-Credentials"]}'"
    "method.response.header.Access-Control-Max-Age"           = "'${local.cors_headers["Access-Control-Max-Age"]}'"
  }

  response_templates = {
    "application/json" = "{}"
  }
}

resource "aws_api_gateway_method" "options" {
  for_each      = local.endpoints
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.endpoints[each.key].id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options" {
  for_each    = local.endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.endpoints[each.key].id
  http_method = aws_api_gateway_method.options[each.key].http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "options" {
  for_each    = local.endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.endpoints[each.key].id
  http_method = aws_api_gateway_method.options[each.key].http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"      = true
    "method.response.header.Access-Control-Allow-Methods"     = true
    "method.response.header.Access-Control-Allow-Headers"     = true
    "method.response.header.Access-Control-Allow-Credentials" = true
    "method.response.header.Access-Control-Max-Age"           = true
  }
}

resource "aws_api_gateway_integration_response" "options" {
  for_each    = local.endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.endpoints[each.key].id
  http_method = aws_api_gateway_method.options[each.key].http_method
  status_code = aws_api_gateway_method_response.options[each.key].status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"      = "'*'"
    "method.response.header.Access-Control-Allow-Methods"     = "'${each.value.cors_methods}'"
    "method.response.header.Access-Control-Allow-Headers"     = "'${local.cors_headers["Access-Control-Allow-Headers"]}'"
    "method.response.header.Access-Control-Allow-Credentials" = "'${local.cors_headers["Access-Control-Allow-Credentials"]}'"
    "method.response.header.Access-Control-Max-Age"           = "'${local.cors_headers["Access-Control-Max-Age"]}'"
  }

  response_templates = {
    "application/json" = "{}"
  }
}

resource "aws_api_gateway_deployment" "main" {
  depends_on = [
    aws_api_gateway_resource.endpoints,
    aws_api_gateway_method.endpoints,
    aws_api_gateway_integration.endpoints,
    aws_api_gateway_method_response.endpoints,
    aws_api_gateway_integration_response.endpoints,
    aws_api_gateway_method.options,
    aws_api_gateway_integration.options,
    aws_api_gateway_method_response.options,
    aws_api_gateway_integration_response.options
  ]

  rest_api_id = aws_api_gateway_rest_api.main.id
  stage_name  = "prod"

  triggers = {
    redeployment = sha1(jsonencode({
      endpoints    = local.endpoints
      cors_headers = local.cors_headers
    }))
  }

  lifecycle {
    create_before_destroy = true
  }
}
