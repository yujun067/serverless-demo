project_name          = "bitcoin-prediction-game"
environment           = "dev"
aws_region            = "eu-north-1"
vpc_cidr              = "10.0.0.0/16"
public_subnet_cidrs   = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs  = ["10.0.10.0/24", "10.0.11.0/24"]
elasticache_node_type = "cache.t3.micro"
fargate_cpu           = 256
fargate_memory        = 512
# jwt_secret must be set via environment variable or command line
# Example: export TF_VAR_jwt_secret="your-32-character-secret-key-here"
# jwt_secret = "your-32-character-secret-key-here"
