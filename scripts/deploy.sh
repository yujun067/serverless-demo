#!/bin/bash

# Bitcoin Price Prediction Game - Complete Deployment Script
# This script handles the entire deployment process from start to finish

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check required tools
    command -v terraform >/dev/null 2>&1 || missing_tools+=("terraform")
    command -v aws >/dev/null 2>&1 || missing_tools+=("aws")
    command -v docker >/dev/null 2>&1 || missing_tools+=("docker")
    command -v node >/dev/null 2>&1 || missing_tools+=("node")
    command -v npm >/dev/null 2>&1 || missing_tools+=("npm")
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_status "Please install the missing tools and try again."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        print_error "AWS credentials not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    # Check Docker
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    print_success "All prerequisites are met"
}

# Deploy infrastructure with Terraform
deploy_infrastructure() {
    print_status "Step 1: Deploying infrastructure with Terraform..."
    
    cd terraform
    
    # Initialize Terraform if needed
    if [ ! -d ".terraform" ]; then
        print_status "Initializing Terraform..."
        terraform init
    fi
    
    # Plan and apply
    print_status "Planning Terraform deployment..."
    terraform plan -out=tfplan
    
    print_status "Applying Terraform configuration..."
    terraform apply tfplan
    
    # Clean up plan file
    rm -f tfplan
    
    cd ..
    
    print_success "Infrastructure deployed successfully"
}

# Build and deploy Lambda functions
deploy_lambda() {
    print_status "Step 2: Building and deploying Lambda functions..."
    
    # Check if we're in the right directory
    if [ ! -d "lambda" ]; then
        print_error "lambda directory not found. Please run this script from the project root."
        exit 1
    fi
    
    # Change to lambda directory
    cd lambda
    
    # Clean previous builds
    print_status "Cleaning previous builds..."
    rm -rf dist
    mkdir -p dist
    
    # Install dependencies in root
    print_status "Installing root dependencies..."
    npm install
    
    # Build all functions
    print_status "Building Lambda functions..."
    
    # Function names
    FUNCTIONS=("user-registration" "user-login" "get-user-score" "submit-guess" "get-latest-price")
    
    for func in "${FUNCTIONS[@]}"; do
        print_status "Building $func function..."
        
        if [ ! -d "functions/$func" ]; then
            print_error "Function directory functions/$func not found"
            exit 1
        fi
        
        # Copy shared utils to function directory
        cp -r shared functions/$func/
        
        # Install dependencies for this function
        cd functions/$func
        npm install --production
        
        # Create deployment package
        zip -r ../../dist/$func.zip . -x "node_modules/.cache/*" "*.log"
        
        cd ../..
        
        print_success "Built $func.zip"
    done
    
    # Clean up shared utils from function directories
    print_status "Cleaning up temporary files..."
    for func in "${FUNCTIONS[@]}"; do
        rm -rf functions/$func/shared
    done
    
    print_success "All Lambda functions built successfully!"
    
    # Show package sizes
    echo ""
    print_status "Package sizes:"
    for func in "${FUNCTIONS[@]}"; do
        size=$(du -h dist/$func.zip | cut -f1)
        echo "  $func.zip: $size"
    done
    
    cd ..
    
    # Update Lambda functions
    print_status "Updating Lambda functions..."
    
    # Get the project prefix from Terraform
    cd terraform
    PROJECT_PREFIX=$(terraform output -raw project_prefix 2>/dev/null || echo "bitcoin-prediction-game-dev")
    cd ..
    
    print_status "Using project prefix: $PROJECT_PREFIX"
    
    # Update all functions
    for func_name in "${FUNCTIONS[@]}"; do
        zip_file="$func_name"
        function_name="${PROJECT_PREFIX}-${func_name}"
        
        print_status "Updating $function_name..."
        
        if [ ! -f "lambda/dist/$zip_file.zip" ]; then
            print_error "Deployment package lambda/dist/$zip_file.zip not found"
            exit 1
        fi
        
        # Update the Lambda function
        aws lambda update-function-code \
            --function-name "$function_name" \
            --zip-file "fileb://lambda/dist/$zip_file.zip" \
            --output json > /dev/null
        
        if [ $? -eq 0 ]; then
            print_success "Updated $function_name"
        else
            print_error "Failed to update $function_name"
            exit 1
        fi
    done
    
    print_success "Lambda functions deployed successfully!"
}

# Build and deploy WebSocket service
deploy_websocket() {
    print_status "Step 3: Building and deploying WebSocket service..."
    
    # Check prerequisites
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Get AWS account ID and region
    print_status "Getting AWS account information..."
    
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
    AWS_REGION=$(aws configure get region 2>/dev/null || echo "${AWS_DEFAULT_REGION:-}")
    
    if [ -z "$AWS_ACCOUNT_ID" ] || [ -z "$AWS_REGION" ]; then
        print_error "Failed to get AWS account information"
        print_error "Please ensure AWS credentials are configured and region is set"
        exit 1
    fi
    
    print_success "AWS Account ID: $AWS_ACCOUNT_ID"
    print_success "AWS Region: $AWS_REGION"
    
    # Get Terraform outputs
    print_status "Getting Terraform outputs..."
    
    cd terraform
    
    # Get ECR repository URL
    ECR_REPOSITORY_URL=$(terraform output -raw ecr_repository_url 2>/dev/null || echo "")
    
    if [ -z "$ECR_REPOSITORY_URL" ]; then
        print_error "Failed to get ECR repository URL from Terraform output"
        print_info "Make sure Terraform has been deployed and the output is available"
        exit 1
    fi
    
    # Extract repository name
    ECR_REPOSITORY_NAME=$(echo "$ECR_REPOSITORY_URL" | sed 's|.*/||')
    
    print_success "ECR Repository URL: $ECR_REPOSITORY_URL"
    print_success "ECR Repository Name: $ECR_REPOSITORY_NAME"
    
    cd ..
    
    # Login to ECR
    print_status "Logging in to ECR..."
    
    aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
    
    print_success "Successfully logged in to ECR"
    
    # Build Docker image
    print_status "Building Docker image..."
    
    cd websocket-service
    
    # Build the image
    docker build -t "$ECR_REPOSITORY_NAME:latest" .
    
    # Tag the image for ECR
    docker tag "$ECR_REPOSITORY_NAME:latest" "$ECR_REPOSITORY_URL:latest"
    
    print_success "Docker image built successfully"
    
    cd ..
    
    # Push Docker image to ECR
    print_status "Pushing Docker image to ECR..."
    
    docker push "$ECR_REPOSITORY_URL:latest"
    
    print_success "Docker image pushed successfully to ECR"
    print_status "ECS service will automatically pull the new image on next deployment"
    print_status "To force a new deployment, run: terraform apply"
    
    print_success "WebSocket service deployed successfully"
}

# Build and deploy frontend
deploy_frontend() {
    print_status "Step 4: Building and deploying frontend..."
    
    # Check if we're in the right directory
    if [ ! -d "static" ] || [ ! -d "terraform" ]; then
        print_error "Required directories not found. Please run this script from the project root."
        exit 1
    fi
    
    # Step 1: Get Terraform outputs
    print_status "Step 1: Retrieving Terraform outputs..."
    
    # Check if we're in the terraform directory or need to change to it
    if [ -f "terraform/terraform.tfstate" ]; then
        cd terraform
    elif [ -f "terraform.tfstate" ]; then
        # Already in terraform directory
        :
    else
        print_error "Terraform state not found. Please run 'terraform apply' first."
        exit 1
    fi
    
    # Get the required values from terraform output
    print_status "Getting API Gateway URL..."
    API_GATEWAY_URL=$(terraform output -raw api_gateway_url)
    print_success "API Gateway URL: $API_GATEWAY_URL"
    
    print_status "Getting S3 bucket name..."
    S3_BUCKET_NAME=$(terraform output -raw website_bucket_name)
    print_success "S3 Bucket Name: $S3_BUCKET_NAME"
    
    print_status "Getting CloudFront distribution ID..."
    CLOUDFRONT_DISTRIBUTION_ID=$(terraform output -raw cloudfront_distribution_id)
    print_success "CloudFront Distribution ID: $CLOUDFRONT_DISTRIBUTION_ID"
    
    print_status "Getting WebSocket ALB DNS name..."
    WEBSOCKET_ALB_DNS=$(terraform output -raw websocket_alb_dns_name)
    print_success "WebSocket ALB DNS: $WEBSOCKET_ALB_DNS"
    
    # Go back to project root
    cd ..
    
    # Step 2: Update API URL in the frontend code
    print_status "Step 2: Updating API URL in frontend code..."
    
    # Create a backup of the original file
    cp static/src/services/api.js static/src/services/api.js.backup
    
    # Update the API URL using sed
    sed -i.bak "s|https://your-api-gateway-url.execute-api.eu-north-1.amazonaws.com/prod|$API_GATEWAY_URL|g" static/src/services/api.js
    
    # Verify the change
    if grep -q "$API_GATEWAY_URL" static/src/services/api.js; then
        print_success "API URL updated successfully"
    else
        print_error "Failed to update API URL"
        exit 1
    fi
    
    # Step 3: Build the frontend
    print_status "Step 3: Building the frontend..."
    
    # Change to static directory
    cd static
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    # Install dependencies
    print_status "Installing dependencies..."
    npm install
    
    # Build the application with environment variables
    print_status "Building React application with SSE URL environment variable..."
    REACT_APP_SSE_URL="https://$WEBSOCKET_ALB_DNS/sse/price" npm run build
    
    # Check if build was successful
    if [ ! -d "build" ]; then
        print_error "Build failed. build directory not found."
        exit 1
    fi
    
    print_success "Frontend built successfully!"
    
    cd ..
    
    # Step 4: Deploy to S3
    print_status "Step 4: Deploying to S3..."
    
    print_status "Syncing build files to S3 bucket: $S3_BUCKET_NAME"
    aws s3 sync static/build/ s3://$S3_BUCKET_NAME --delete
    
    if [ $? -eq 0 ]; then
        print_success "Successfully deployed to S3"
    else
        print_error "Failed to deploy to S3"
        exit 1
    fi
    
    # Step 5: Invalidate CloudFront cache
    print_status "Step 5: Invalidating CloudFront cache..."
    
    print_status "Creating CloudFront invalidation for distribution: $CLOUDFRONT_DISTRIBUTION_ID"
    aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths "/*"
    
    if [ $? -eq 0 ]; then
        print_success "CloudFront cache invalidation created successfully"
    else
        print_warning "Failed to create CloudFront invalidation. You may need to manually invalidate the cache."
    fi
    
    # Step 6: Cleanup
    print_status "Step 6: Cleaning up temporary files..."
    
    # Remove backup files
    rm -f static/src/services/api.js.backup
    rm -f static/src/services/api.js.bak
    
    print_success "Cleanup completed"
    
    print_success "Frontend deployed successfully"
}

# Display deployment summary
show_summary() {
    print_status "Step 5: Deployment Summary..."
    
    cd terraform
    
    echo ""
    print_success "Deployment completed successfully!"
    echo ""
    echo "Deployment Summary:"
    echo "  Website URL: $(terraform output -raw website_url)"
    echo "  API Gateway URL: $(terraform output -raw api_gateway_url)"
    echo "  WebSocket ALB: $(terraform output -raw websocket_alb_dns_name)"
    echo "  DynamoDB Table: $(terraform output -raw dynamodb_table_name)"
    echo "  Redis Endpoint: $(terraform output -raw elasticache_endpoint)"
    echo ""
    echo "Next Steps:"
    echo "  1. Test the website at: $(terraform output -raw website_url)"
    echo "  2. Monitor logs in CloudWatch"
    echo "  3. Check ECS service status in AWS Console"
    echo ""
    
    cd ..
}

# Main deployment function
main() {
    print_status "Starting Bitcoin Price Prediction Game deployment..."
    echo ""
    
    # Check if we're in the right directory
    if [ ! -d "terraform" ] || [ ! -d "lambda" ] || [ ! -d "static" ]; then
        print_error "Required directories not found. Please run this script from the project root."
        exit 1
    fi
    
    # Run deployment steps
    check_prerequisites
    deploy_infrastructure
    deploy_lambda
    deploy_websocket
    deploy_frontend
    show_summary
}

# Handle script arguments
case "${1:-}" in
    --infrastructure-only)
        check_prerequisites
        deploy_infrastructure
        ;;
    --lambda-only)
        check_prerequisites
        deploy_lambda
        ;;
    --websocket-only)
        check_prerequisites
        deploy_websocket
        ;;
    --frontend-only)
        check_prerequisites
        deploy_frontend
        ;;
    --help|-h)
        echo "Usage: $0 [OPTION]"
        echo ""
        echo "Options:"
        echo "  --infrastructure-only  Deploy only infrastructure with Terraform"
        echo "  --lambda-only         Deploy only Lambda functions"
        echo "  --websocket-only      Deploy only WebSocket service"
        echo "  --frontend-only       Deploy only frontend"
        echo "  --help, -h           Show this help message"
        echo ""
        echo "Default: Deploy everything (infrastructure + Lambda + WebSocket + frontend)"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac
