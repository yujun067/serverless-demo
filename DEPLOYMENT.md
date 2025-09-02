# Deployment Guide

This comprehensive guide covers deploying the Bitcoin Price Prediction Game to AWS using Infrastructure as Code with Terraform.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [Detailed Deployment](#detailed-deployment)
- [Configuration](#configuration)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Cleanup](#cleanup)

## Prerequisites

### Required Tools

Before deployment, ensure you have these tools installed:

- **Terraform** (>= 1.0) - Infrastructure as Code
- **AWS CLI** (>= 2.0) - AWS command line interface
- **Docker** (>= 20.0) - Container runtime for WebSocket service
- **Node.js** (>= 16.0) - JavaScript runtime
- **npm** (>= 7.0) - Node.js package manager

### AWS Requirements

1. **AWS Account**: Active AWS account with billing enabled
2. **AWS Credentials**: Configured AWS CLI with appropriate permissions
3. **IAM Permissions**: Your AWS user/role needs permissions for:
   - VPC, EC2, Subnets, Security Groups, NAT Gateway
   - Lambda, API Gateway, CloudWatch
   - DynamoDB, ElastiCache (Redis)
   - S3, CloudFront
   - ECS, ECR, Fargate
   - IAM roles and policies

### Installation Instructions

**macOS (using Homebrew):**
```bash
# Install all required tools
brew install terraform awscli docker node

# Start Docker Desktop
open -a Docker
```

**Ubuntu/Debian:**
```bash
# Install Terraform
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
sudo apt-get update && sudo apt-get install terraform

# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# Install Docker
sudo apt-get update && sudo apt-get install docker.io
sudo systemctl start docker && sudo usermod -aG docker $USER

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Windows:**
```powershell
# Install using Chocolatey
choco install terraform awscli docker-desktop nodejs

# Or download directly from official websites
```

### AWS Setup

```bash
# Configure AWS credentials
aws configure

# Verify configuration
aws sts get-caller-identity
```

Required AWS configuration:
- **Access Key ID**: Your AWS access key
- **Secret Access Key**: Your AWS secret key
- **Default Region**: eu-north-1 (or your preferred region)
- **Output Format**: json

## Architecture Overview

### Infrastructure Components


```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Lambda        │
│   (React SPA)   │◄──►│   (REST API)    │◄──►│   Functions     │
│   CloudFront    │    │                 │    │                 │
│   S3            │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                             │
         │                                             ▼
         │                                    ┌─────────────────┐
         │                                    │   DynamoDB      │
         │                                    │   (User Data)   │
         │                                    └─────────────────┘
         │                                             │
         ▼                                             ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ALB           │    │   WebSocket     │◄──►│   ElastiCache   │
│   (Load         │◄──►│   Service       │    │   (Redis)       │
│   Balancer)     │    │   (ECS Fargate) │    │   (Cache/Queue) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       
                                ▼                       
                       ┌─────────────────┐              
                       │   Binance API   │              
                       │   (WebSocket)   │              
                       │   (Price Data)  │              
                       └─────────────────┘              
                                                        
                                              
```

### AWS Services Used

- **VPC**: Isolated network environment with public/private subnets
- **API Gateway**: REST API endpoints with CORS configuration
- **Lambda**: Serverless functions for business logic
- **DynamoDB**: NoSQL database for user data and scores
- **ElastiCache**: Redis cache for session management and real-time data
- **ECS Fargate**: Containerized WebSocket service
- **ECR**: Container registry for WebSocket service images
- **S3**: Static website hosting for React frontend
- **CloudFront**: CDN for global content delivery
- **IAM**: Security roles and policies
- **CloudWatch**: Logging and monitoring

## Quick Start

### One-Command Deployment

```bash
# Clone repository and deploy everything
git clone <repository-url>
cd serverless-demo
./scripts/deploy.sh
```

This automated script will:
1. ✅ Validate prerequisites and AWS credentials
2. ✅ Deploy infrastructure with Terraform
3. ✅ Build and deploy Lambda functions
4. ✅ Build and deploy WebSocket service to ECS
5. ✅ Build and deploy React frontend
6. ✅ Display deployment summary with URLs

### Expected Output

```
🚀 Starting Bitcoin Price Prediction Game Deployment...

✅ Prerequisites check passed
✅ Infrastructure deployed successfully
✅ Lambda functions deployed
✅ WebSocket service deployed
✅ Frontend deployed

📋 Deployment Summary:
  🌐 Website URL: https://d1234567890abc.cloudfront.net
  🔌 API Gateway: https://abcdef1234.execute-api.eu-north-1.amazonaws.com/prod
  📡 WebSocket Service: http://bitcoin-game-alb-1234567890.eu-north-1.elb.amazonaws.com
  
🎉 Deployment completed successfully in 8m 32s
```

## Detailed Deployment

For development and troubleshooting, you can deploy components individually. These steps are **independent** and don't require sequential execution - deploy only what you need to update.

### Step 1: Infrastructure Deployment

Deploy the foundational AWS infrastructure:

```bash
# Deploy only infrastructure
./scripts/deploy.sh --infrastructure-only
```

**Infrastructure Deployed:**
- VPC with public/private subnets across 2 AZs
- NAT Gateway for private subnet internet access
- Security Groups for service isolation
- DynamoDB table with GSI for username lookup
- ElastiCache Redis cluster for caching
- ECS cluster for container services
- ECR repository for WebSocket service
- S3 bucket and CloudFront distribution
- IAM roles and policies

### Step 2: Lambda Functions

Build and deploy the serverless API functions:

```bash
# Deploy only Lambda functions
./scripts/deploy.sh --lambda-only
```

**Lambda Functions Deployed:**
- `user-registration`: User account creation with validation
- `user-login`: JWT-based authentication
- `get-user-score`: User statistics and game history
- `submit-guess`: Price prediction submission with Redis queuing
- `get-latest-price`: Current Bitcoin price from cache

### Step 3: WebSocket Service

Deploy the real-time price update service:

```bash
# Deploy only WebSocket service
./scripts/deploy.sh --websocket-only
```

**WebSocket Service Features:**
- Connects to Binance WebSocket for real-time price data
- Stores price data in Redis with TTL
- Provides SSE endpoint for browser connections
- Handles guess resolution with automated scoring
- Health check endpoint for load balancer

### Step 4: Frontend Deployment

Build and deploy the React application:

```bash
# Deploy only frontend
./scripts/deploy.sh --frontend-only
```

**Frontend Features:**
- Responsive design with TailwindCSS
- User authentication with JWT tokens
- Real-time price updates via SSE
- Game interface for making predictions
- User dashboard with score tracking

## Configuration

### Terraform Variables

Edit `terraform/terraform.tfvars` to customize deployment:

```hcl
# Project configuration
project_name = "bitcoin-prediction-game"
environment  = "dev"
aws_region   = "eu-north-1"

# Security configuration
jwt_secret = "your-super-secret-jwt-key-change-in-production"

# Infrastructure sizing
elasticache_node_type = "cache.t2.micro"
fargate_cpu          = 256
fargate_memory       = 512

# Networking
vpc_cidr             = "10.0.0.0/16"
public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs = ["10.0.10.0/24", "10.0.11.0/24"]
```

### Environment Variables

**Lambda Functions** (automatically configured by Terraform):
- `DYNAMODB_TABLE`: DynamoDB table name
- `JWT_SECRET`: Secret for JWT token signing
- `REDIS_HOST`: ElastiCache Redis endpoint
- `REDIS_PORT`: Redis port (6379)

**WebSocket Service** (configured in ECS task definition):
- `REDIS_HOST`: Redis endpoint
- `REDIS_PORT`: Redis port
- `DYNAMODB_TABLE`: DynamoDB table name
- `AWS_REGION`: AWS region
- `PORT`: Service port (3001)

### Frontend Configuration

The frontend automatically configures endpoint URLs during deployment using Terraform outputs:

**API Gateway (REST API):**
- URL automatically updated in `static/src/services/api.js` during build
- Used for user authentication, game actions, and data retrieval

**WebSocket Service (SSE):**
- ALB URL passed as `REACT_APP_SSE_URL` environment variable during React build
- Used for real-time Bitcoin price updates via Server-Sent Events



## Monitoring

### CloudWatch Logs

Monitor application logs in CloudWatch console or using AWS CLI. Key log groups:
- `/aws/lambda/bitcoin-prediction-game-dev-*` - Lambda function logs
- `/ecs/bitcoin-prediction-game-dev-websocket` - WebSocket service logs

### AWS Default Metrics

AWS automatically provides these key metrics to monitor:
- **Lambda duration and errors**: Function performance (AWS/Lambda namespace)
- **DynamoDB throttles**: Database capacity issues (AWS/DynamoDB namespace)
- **ElastiCache hit ratio**: Cache effectiveness (AWS/ElastiCache namespace)  
- **ECS service health**: Container status (AWS/ECS namespace)
- **API Gateway 4xx/5xx errors**: API issues (AWS/ApiGateway namespace)

### Health Checks

```bash
# API Gateway basic connectivity (OPTIONS request - no side effects)
curl -X OPTIONS https://your-api-gateway.execute-api.eu-north-1.amazonaws.com/prod/api-v1-register

# WebSocket service health (recommended for health checks)
curl -k https://your-alb-dns-name/health
```

### ECS Service Monitoring

Monitor ECS services through the AWS console or CLI:
- Check service health status and running tasks
- View service events and deployment history
- Monitor task CPU and memory utilization

## Troubleshooting

For deployment issues, refer to the deployment script logs and AWS CloudWatch for specific error messages. The deployment script includes comprehensive error handling and will provide guidance for common issues.



## Cost Optimization

### Estimated Monthly Costs (eu-north-1)

#### Personal Account (with AWS Free Tier)
| Service | Configuration | Monthly Cost |
|---------|---------------|--------------|
| ElastiCache | t2.micro | $10-20 *(no free tier)* |
| ECS Fargate | 256 CPU, 512 MiB | $5-15 *(reduced usage)* |
| Application Load Balancer | Standard ALB | $20-25 *(no free tier)* |
| DynamoDB | On-demand | $0-1 *(25GB free)* |
| Lambda | 128MB, <1M requests | $0 *(1M requests free)* |
| API Gateway | <1M requests | $0 *(1M calls free)* |
| S3 + CloudFront | <10GB transfer | $0-1 *(5GB + 1TB transfer free)* |
| **Personal Total** | | **$35-62** |

#### Business/Production Account
| Service | Configuration | Monthly Cost |
|---------|---------------|--------------|
| ElastiCache | t2.micro | $10-20 |
| ECS Fargate | 256 CPU, 512 MiB | $20-40 |
| Application Load Balancer | Standard ALB | $20-25 |
| DynamoDB | On-demand | $1-5 |
| Lambda | 128MB, <1M requests | $0.50-2 |
| API Gateway | <1M requests | $1-5 |
| S3 + CloudFront | <10GB transfer | $1-3 |
| **Business Total** | | **$55-100** |

### Cost Reduction Strategies

1. **Development Environment:**
   ```hcl
   # terraform/terraform.tfvars
   elasticache_node_type = "cache.t2.micro"  # Cheaper option
   fargate_cpu          = 256                # Minimum CPU
   fargate_memory       = 512                # Minimum memory
   ```

2. **Production Optimization:**
   - Enable auto-scaling for ECS services
   - Use CloudFront caching to reduce origin requests
   - Implement DynamoDB auto-scaling
   - Monitor and right-size Lambda memory allocation

3. **Resource Cleanup:**
   ```bash
   # Regular cleanup of unused resources
   ./scripts/cleanup.sh --local-only  # Keep infrastructure
   ```

## Security Best Practices

### Production Hardening

For production deployments, consider these security improvements:
- Change default JWT secrets in `terraform.tfvars`
- Enable HTTPS with ACM certificates for custom domains
- Configure VPC endpoints and restrictive security groups
- Enable CloudTrail and CloudWatch monitoring
- Implement proper backup and disaster recovery strategies

Refer to AWS security best practices documentation for detailed implementation guidance.



## Cleanup

### Complete Resource Removal

```bash
# Remove all AWS resources and local artifacts
./scripts/cleanup.sh
```

**⚠️ Warning:** This permanently deletes all resources and data!

### Safe Cleanup Options

```bash
# Remove only local build artifacts (keeps AWS resources)
./scripts/cleanup.sh --local-only
```

**Note:** Always use the cleanup script rather than manual commands to ensure proper resource management and avoid state inconsistencies.

## Advanced Configuration

### Custom Domain Setup

To use a custom domain instead of the default CloudFront and ALB URLs, you'll need to:
- Register a domain in Route 53 or your preferred registrar
- Request an SSL certificate through AWS Certificate Manager
- Update the Terraform configuration to include domain variables

Refer to AWS documentation for detailed custom domain configuration steps.

## Support and Resources

For issues during deployment:
1. Check CloudWatch logs for detailed error information
2. Use `terraform plan` to verify configuration changes
3. Deploy components separately using script parameters to isolate issues
4. Refer to AWS documentation for service-specific guidance

---

This deployment guide provides comprehensive instructions for deploying the Bitcoin Price Prediction Game. For additional help or production deployment considerations, consult the AWS Well-Architected Framework and implement appropriate security, monitoring, and backup strategies for your specific use case.