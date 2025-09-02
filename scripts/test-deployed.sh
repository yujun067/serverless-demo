#!/bin/bash

# Post-deployment functional tests using Jest framework
set -e

# Check if running in production mode
PRODUCTION_MODE=${1:-"test"}

if [ "$PRODUCTION_MODE" = "production" ]; then
    echo "🚀 Running in PRODUCTION MODE - will use existing data"
    USE_TEST_DATA=false
else
    echo "🧪 Running in TEST MODE - will use unique test data"  
    USE_TEST_DATA=true
fi

echo "⚡ Using Jest test framework for comprehensive end-to-end testing"
echo ""

# Show usage information if help requested
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    echo "Usage: $0 [MODE]"
    echo ""
    echo "Arguments:"
    echo "  MODE       test|production (default: test)"
    echo "             test: Creates unique test data"
    echo "             production: Uses existing data"
    echo ""
    echo "Examples:"
    echo "  $0                    # Test mode with Jest framework"
    echo "  $0 test              # Test mode with Jest framework (explicit)"
    echo "  $0 production        # Production mode with Jest framework"
    echo ""
    echo "Jest Framework Features:"
    echo "  • Enhanced test reporting and detailed output"
    echo "  • Better error messages and debugging information"
    echo "  • Structured test organization and categorization"
    echo "  • Performance metrics and timing information"
    echo "  • Extensible test framework for future enhancements"
    echo ""
    exit 0
fi

echo "🧪 Running Post-Deployment Functional Tests..."
echo ""

# Jest test runner function
run_jest_tests() {
    echo ""
    echo "🚀 Running Jest-based End-to-End Tests..."
    
    # Check if Node.js and npm are available
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js not found. Please install Node.js to run Jest tests."
        echo ""
        echo "📥 Installation Instructions:"
        echo "• macOS: brew install node"
        echo "• Ubuntu: sudo apt install nodejs npm"
        echo "• Windows: Download from https://nodejs.org/"
        echo ""
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo "❌ npm not found. Please install npm to run Jest tests."
        echo ""
        echo "📥 Installation Instructions:"
        echo "• Usually installed with Node.js"
        echo "• macOS: brew install npm"
        echo "• Ubuntu: sudo apt install npm"
        echo ""
        exit 1
    fi
    
    echo "✅ Node.js and npm found"
    
    # Navigate to Jest tests directory
    cd scripts/jest-tests
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing Jest test dependencies..."
        if ! npm install --silent; then
            echo "❌ Failed to install dependencies"
            echo ""
            echo "🔧 Troubleshooting:"
            echo "• Check internet connection"
            echo "• Try: rm -rf node_modules package-lock.json && npm install"
            echo "• Ensure Node.js version >= 16.x"
            cd ../..
            exit 1
        fi
        echo "✅ Dependencies installed successfully"
    fi
    
    # Set environment variables for Jest
    export TEST_MODE="$PRODUCTION_MODE"
    export NODE_ENV="test"
    
    # Run Jest tests
    echo ""
    echo "🧪 Executing Jest test suites..."
    echo ""
    
    local jest_exit_code=0
    local jest_output
    
    # Capture Jest output
    if jest_output=$(npm test 2>&1); then
        echo "$jest_output"
        echo ""
        echo "✅ All Jest tests completed successfully!"
        echo ""
        echo "📋 Test Results Summary:"
        echo "✅ Jest test suites executed successfully"
        echo "📈 Comprehensive test coverage with enhanced reporting"
        echo ""
        echo "📋 Next Steps:"
        # Get URLs from Terraform outputs for summary
        local frontend_url
        frontend_url=$(cd ../../terraform && terraform output -raw website_url 2>/dev/null || echo "")
        
        if [ -n "$frontend_url" ]; then
            echo "1. Access your application: $frontend_url"
        else
            echo "1. Frontend URL not available - check CloudFront deployment"
        fi
        echo "2. Monitor CloudWatch logs: /aws/lambda/bitcoin-prediction-game-*"
        echo "3. Test user interactions manually"
        echo "4. Set up monitoring and alerting for production"
        echo ""
        echo "🧪 Jest Test Coverage:"
        echo "• API Validation: Comprehensive input validation and security tests"
        echo "• Business Logic: Game rules and authentication workflow tests"
        echo "• Error Handling: Resilience and error response tests"
        echo "• Real-time Features: WebSocket and SSE functionality tests"
        echo "• Performance: Load and response time testing"
        echo ""
        echo "💡 For detailed test reports, check:"
        echo "• Test results: scripts/jest-tests/test-results/"
        echo "• Individual test runs: cd scripts/jest-tests && npm run test:api"
        echo "• Coverage report: cd scripts/jest-tests && npm run test:coverage"
        
    else
        jest_exit_code=$?
        echo "$jest_output"
        echo ""
        
        # Parse Jest results for partial success
        if echo "$jest_output" | grep -q "Tests:.*passed"; then
            local passed_tests=$(echo "$jest_output" | grep -o "[0-9]\+ passed" | grep -o "[0-9]\+" | head -1)
            local failed_tests=$(echo "$jest_output" | grep -o "[0-9]\+ failed" | grep -o "[0-9]\+" | head -1)
            
            if [ -n "$passed_tests" ] && [ "$passed_tests" -gt 0 ]; then
                echo "⚠️  Jest tests completed with some failures: $passed_tests passed, ${failed_tests:-0} failed"
                echo ""
                echo "🔧 Troubleshooting Failed Tests:"
                echo "• Check CloudWatch logs for Lambda function errors"
                echo "• Verify API Gateway and WebSocket service deployment"
                echo "• Ensure DynamoDB and Redis connectivity"
                echo "• Check VPC and security group settings"
                echo ""
                echo "💡 Debug Commands:"
                echo "• Run specific test suite: npm run test:api"
                echo "• Run with verbose output: npm test -- --verbose"
                echo "• Check test logs: cat test-results/junit.xml"
            else
                echo "❌ Jest tests failed to execute properly"
                echo ""
                echo "🔧 Troubleshooting:"
                echo "• Check deployment status: terraform plan"
                echo "• Verify AWS credentials and permissions"
                echo "• Check network connectivity to deployed services"
            fi
        else
            echo "❌ Jest tests failed to execute"
            echo ""
            echo "🔧 Common Issues:"
            echo "• API Gateway URL not found - ensure deployment completed"
            echo "• Node.js/npm version compatibility issues"
            echo "• Network connectivity problems"
            echo "• Missing AWS infrastructure components"
            echo ""
            echo "💡 Debug Steps:"
            echo "1. Check Terraform outputs: cd terraform && terraform output"
            echo "2. Verify Node.js version: node --version (should be >= 16.x)"
            echo "3. Reinstall dependencies: rm -rf node_modules && npm install"
            echo "4. Run tests manually: cd scripts/jest-tests && npm test"
        fi
    fi
    
    # Return to original directory
    cd ../..
    
    return $jest_exit_code
}

# Main execution
echo "🔍 Checking deployment status..."

# Get API Gateway URL from Terraform output
API_URL=$(cd terraform && terraform output -raw api_gateway_url 2>/dev/null || echo "")

if [ -z "$API_URL" ]; then
    echo "❌ API Gateway URL not found. Please deploy the infrastructure first."
    echo ""
    echo "🚀 Deployment Commands:"
    echo "cd terraform"
    echo "terraform init"
    echo "terraform plan"
    echo "terraform apply"
    echo ""
    exit 1
fi

echo "🔗 API Gateway URL: $API_URL"

# Get additional URLs for summary
ALB_URL=$(cd terraform && terraform output -raw websocket_alb_dns_name 2>/dev/null || echo "")
if [ -n "$ALB_URL" ]; then
    echo "🔗 WebSocket ALB URL: $ALB_URL"
else
    echo "⚠️  WebSocket ALB URL not available"
fi

FRONTEND_URL=$(cd terraform && terraform output -raw website_url 2>/dev/null || echo "")
if [ -n "$FRONTEND_URL" ]; then
    echo "🌐 Frontend URL: $FRONTEND_URL"
else
    echo "⚠️  CloudFront URL not available"
fi

echo ""

# Run Jest tests
if run_jest_tests; then
    echo ""
    echo "🎉 End-to-End Testing Completed Successfully!"
    echo ""
    echo "🚀 Your Bitcoin Price Prediction Game is ready for use!"
    exit 0
else
    echo ""
    echo "⚠️  Some tests failed. Please review the output above for details."
    echo ""
    echo "🔧 Quick Fixes:"
    echo "• Wait a few minutes for AWS services to fully initialize"
    echo "• Re-run tests: $0 $PRODUCTION_MODE"
    echo "• Check AWS Console for service status"
    echo ""
    exit 1
fi