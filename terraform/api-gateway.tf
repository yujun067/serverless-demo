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

  # Simple endpoints (single level)
  simple_endpoints = {
    submit_guess = {
      path_part    = "guess"
      http_method  = "POST"
      lambda_name  = "submit_guess"
      cors_methods = "POST,OPTIONS"
    }
    get_latest_price = {
      path_part    = "price"
      http_method  = "GET"
      lambda_name  = "get_latest_price"
      cors_methods = "GET,OPTIONS"
    }
    user_registration = {
      path_part    = "register"
      http_method  = "POST"
      lambda_name  = "user_registration"
      cors_methods = "POST,OPTIONS"
    }
    user_login = {
      path_part    = "login"
      http_method  = "POST"
      lambda_name  = "user_login"
      cors_methods = "POST,OPTIONS"
    }
  }

  # Nested endpoints (/user/score)
  nested_endpoints = {
    get_user_score = {
      parent_path  = "user"
      path_part    = "score"
      http_method  = "GET"
      lambda_name  = "get_user_score"
      cors_methods = "GET,OPTIONS"
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

# Simple endpoints (single level)
resource "aws_api_gateway_resource" "simple_endpoints" {
  for_each    = local.simple_endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = each.value.path_part
}

# Parent resource for nested endpoints (/user)
resource "aws_api_gateway_resource" "user" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "user"
}

# Nested endpoints (/user/score)
resource "aws_api_gateway_resource" "nested_endpoints" {
  for_each    = local.nested_endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.user.id
  path_part   = each.value.path_part
}

# Methods for simple endpoints
resource "aws_api_gateway_method" "simple_endpoints" {
  for_each      = local.simple_endpoints
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.simple_endpoints[each.key].id
  http_method   = each.value.http_method
  authorization = "NONE"
}

# Methods for nested endpoints
resource "aws_api_gateway_method" "nested_endpoints" {
  for_each      = local.nested_endpoints
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.nested_endpoints[each.key].id
  http_method   = each.value.http_method
  authorization = "NONE"
}

# Integrations for simple endpoints
resource "aws_api_gateway_integration" "simple_endpoints" {
  for_each    = local.simple_endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.simple_endpoints[each.key].id
  http_method = aws_api_gateway_method.simple_endpoints[each.key].http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = local.lambda_arns[each.value.lambda_name]
}

# Integrations for nested endpoints
resource "aws_api_gateway_integration" "nested_endpoints" {
  for_each    = local.nested_endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.nested_endpoints[each.key].id
  http_method = aws_api_gateway_method.nested_endpoints[each.key].http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = local.lambda_arns[each.value.lambda_name]
}

# Method responses for simple endpoints
resource "aws_api_gateway_method_response" "simple_endpoints" {
  for_each    = local.simple_endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.simple_endpoints[each.key].id
  http_method = aws_api_gateway_method.simple_endpoints[each.key].http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"      = true
    "method.response.header.Access-Control-Allow-Methods"     = true
    "method.response.header.Access-Control-Allow-Headers"     = true
    "method.response.header.Access-Control-Allow-Credentials" = true
    "method.response.header.Access-Control-Max-Age"           = true
  }
}

# Method responses for nested endpoints
resource "aws_api_gateway_method_response" "nested_endpoints" {
  for_each    = local.nested_endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.nested_endpoints[each.key].id
  http_method = aws_api_gateway_method.nested_endpoints[each.key].http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"      = true
    "method.response.header.Access-Control-Allow-Methods"     = true
    "method.response.header.Access-Control-Allow-Headers"     = true
    "method.response.header.Access-Control-Allow-Credentials" = true
    "method.response.header.Access-Control-Max-Age"           = true
  }
}

# Integration responses for simple endpoints
resource "aws_api_gateway_integration_response" "simple_endpoints" {
  for_each    = local.simple_endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.simple_endpoints[each.key].id
  http_method = aws_api_gateway_method.simple_endpoints[each.key].http_method
  status_code = aws_api_gateway_method_response.simple_endpoints[each.key].status_code

  depends_on = [
    aws_api_gateway_integration.simple_endpoints
  ]

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

# Integration responses for nested endpoints
resource "aws_api_gateway_integration_response" "nested_endpoints" {
  for_each    = local.nested_endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.nested_endpoints[each.key].id
  http_method = aws_api_gateway_method.nested_endpoints[each.key].http_method
  status_code = aws_api_gateway_method_response.nested_endpoints[each.key].status_code

  depends_on = [
    aws_api_gateway_integration.nested_endpoints
  ]

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

# OPTIONS methods for simple endpoints (CORS)
resource "aws_api_gateway_method" "simple_options" {
  for_each      = local.simple_endpoints
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.simple_endpoints[each.key].id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# OPTIONS methods for nested endpoints (CORS)
resource "aws_api_gateway_method" "nested_options" {
  for_each      = local.nested_endpoints
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.nested_endpoints[each.key].id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# OPTIONS integrations for simple endpoints
resource "aws_api_gateway_integration" "simple_options" {
  for_each    = local.simple_endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.simple_endpoints[each.key].id
  http_method = aws_api_gateway_method.simple_options[each.key].http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

# OPTIONS integrations for nested endpoints
resource "aws_api_gateway_integration" "nested_options" {
  for_each    = local.nested_endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.nested_endpoints[each.key].id
  http_method = aws_api_gateway_method.nested_options[each.key].http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

# OPTIONS method responses for simple endpoints
resource "aws_api_gateway_method_response" "simple_options" {
  for_each    = local.simple_endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.simple_endpoints[each.key].id
  http_method = aws_api_gateway_method.simple_options[each.key].http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"      = true
    "method.response.header.Access-Control-Allow-Methods"     = true
    "method.response.header.Access-Control-Allow-Headers"     = true
    "method.response.header.Access-Control-Allow-Credentials" = true
    "method.response.header.Access-Control-Max-Age"           = true
  }
}

# OPTIONS method responses for nested endpoints
resource "aws_api_gateway_method_response" "nested_options" {
  for_each    = local.nested_endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.nested_endpoints[each.key].id
  http_method = aws_api_gateway_method.nested_options[each.key].http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"      = true
    "method.response.header.Access-Control-Allow-Methods"     = true
    "method.response.header.Access-Control-Allow-Headers"     = true
    "method.response.header.Access-Control-Allow-Credentials" = true
    "method.response.header.Access-Control-Max-Age"           = true
  }
}

# OPTIONS integration responses for simple endpoints
resource "aws_api_gateway_integration_response" "simple_options" {
  for_each    = local.simple_endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.simple_endpoints[each.key].id
  http_method = aws_api_gateway_method.simple_options[each.key].http_method
  status_code = aws_api_gateway_method_response.simple_options[each.key].status_code

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

# OPTIONS integration responses for nested endpoints
resource "aws_api_gateway_integration_response" "nested_options" {
  for_each    = local.nested_endpoints
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.nested_endpoints[each.key].id
  http_method = aws_api_gateway_method.nested_options[each.key].http_method
  status_code = aws_api_gateway_method_response.nested_options[each.key].status_code

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
    aws_api_gateway_resource.simple_endpoints,
    aws_api_gateway_resource.user,
    aws_api_gateway_resource.nested_endpoints,
    aws_api_gateway_method.simple_endpoints,
    aws_api_gateway_method.nested_endpoints,
    aws_api_gateway_integration.simple_endpoints,
    aws_api_gateway_integration.nested_endpoints,
    aws_api_gateway_method_response.simple_endpoints,
    aws_api_gateway_method_response.nested_endpoints,
    aws_api_gateway_integration_response.simple_endpoints,
    aws_api_gateway_integration_response.nested_endpoints,
    aws_api_gateway_method.simple_options,
    aws_api_gateway_method.nested_options,
    aws_api_gateway_integration.simple_options,
    aws_api_gateway_integration.nested_options,
    aws_api_gateway_method_response.simple_options,
    aws_api_gateway_method_response.nested_options,
    aws_api_gateway_integration_response.simple_options,
    aws_api_gateway_integration_response.nested_options
  ]

  rest_api_id = aws_api_gateway_rest_api.main.id
  stage_name  = "prod"

  triggers = {
    redeployment = sha1(jsonencode({
      simple_endpoints = local.simple_endpoints
      nested_endpoints = local.nested_endpoints
      cors_headers     = local.cors_headers
    }))
  }

  lifecycle {
    create_before_destroy = true
  }
}
