#!/bin/bash

# Bitcoin Price Prediction Game - Cleanup Script
# This script destroys all deployed resources

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

# Confirm cleanup
confirm_cleanup() {
    echo ""
    print_warning "⚠️  WARNING: This will destroy ALL deployed resources!"
    echo ""
    echo "This includes:"
    echo "  • VPC and networking resources"
    echo "  • Lambda functions"
    echo "  • API Gateway"
    echo "  • DynamoDB table"
    echo "  • ElastiCache Redis cluster"
    echo "  • ECS cluster and services"
    echo "  • S3 bucket and CloudFront distribution"
    echo "  • All associated IAM roles and policies"
    echo ""
    echo "This action is IRREVERSIBLE!"
    echo ""
    
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirmation
    
    if [ "$confirmation" != "yes" ]; then
        print_status "Cleanup cancelled"
        exit 0
    fi
}

# Cleanup infrastructure
cleanup_infrastructure() {
    print_status "Destroying infrastructure with Terraform..."
    
    cd terraform
    
    # Check if terraform state exists
    if [ ! -f "terraform.tfstate" ]; then
        print_warning "No Terraform state found. Infrastructure may already be destroyed."
        cd ..
        return
    fi
    
    # Destroy infrastructure
    print_status "Planning destruction..."
    terraform plan -destroy -out=destroy_plan
    
    print_status "Destroying infrastructure..."
    terraform apply destroy_plan
    
    # Clean up plan file
    rm -f destroy_plan
    
    cd ..
    
    print_success "Infrastructure destroyed successfully"
}

# Cleanup local build artifacts
cleanup_local() {
    print_status "Cleaning up local build artifacts..."
    
    # Clean Lambda build artifacts
    if [ -d "lambda/dist" ]; then
        rm -rf lambda/dist
        print_success "Cleaned Lambda build artifacts"
    fi
    
    # Clean frontend build artifacts
    if [ -d "static/build" ]; then
        rm -rf static/build
        print_success "Cleaned frontend build artifacts"
    fi
    
    # Clean Terraform files
    if [ -d "terraform/.terraform" ]; then
        rm -rf terraform/.terraform
        print_success "Cleaned Terraform cache"
    fi
    
    if [ -f "terraform/.terraform.lock.hcl" ]; then
        rm -f terraform/.terraform.lock.hcl
        print_success "Cleaned Terraform lock file"
    fi
}

# Main cleanup function
main() {
    print_status "Starting cleanup process..."
    
    # Check if we're in the right directory
    if [ ! -d "terraform" ]; then
        print_error "terraform directory not found. Please run this script from the project root."
        exit 1
    fi
    
    # Confirm cleanup
    confirm_cleanup
    
    # Run cleanup steps
    cleanup_infrastructure
    cleanup_local
    
    echo ""
    print_success "🎉 Cleanup completed successfully!"
    echo ""
    print_status "All resources have been destroyed and local artifacts cleaned up."
}

# Handle script arguments
case "${1:-}" in
    --local-only)
        print_status "Cleaning up local build artifacts only..."
        cleanup_local
        print_success "Local cleanup completed"
        ;;
    --help|-h)
        echo "Usage: $0 [OPTION]"
        echo ""
        echo "Options:"
        echo "  --local-only  Clean up only local build artifacts (no infrastructure destruction)"
        echo "  --help, -h   Show this help message"
        echo ""
        echo "Default: Destroy all infrastructure and clean local artifacts"
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
