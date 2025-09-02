const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Configuration
const FUNCTIONS_DIR = path.join(__dirname, "functions");
const SHARED_DIR = path.join(__dirname, "shared");
const DIST_DIR = path.join(__dirname, "dist");

// Ensure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// Get all function directories
const functionDirs = fs
  .readdirSync(FUNCTIONS_DIR)
  .filter((dir) => fs.statSync(path.join(FUNCTIONS_DIR, dir)).isDirectory());

console.log("🚀 Starting optimized build process...");
console.log(
  `📁 Found ${functionDirs.length} functions:`,
  functionDirs.join(", ")
);

// Build each function
functionDirs.forEach((functionName) => {
  console.log(`\n🔨 Building ${functionName}...`);

  const functionDir = path.join(FUNCTIONS_DIR, functionName);
  const tempBuildDir = path.join(DIST_DIR, `${functionName}-temp`);
  const zipPath = path.join(DIST_DIR, `${functionName}.zip`);

  try {
    // Clean up previous temp directory
    if (fs.existsSync(tempBuildDir)) {
      fs.rmSync(tempBuildDir, { recursive: true, force: true });
    }

    // Create temp build directory
    fs.mkdirSync(tempBuildDir, { recursive: true });

    // Copy function files
    console.log(`  📋 Copying function files...`);
    fs.cpSync(functionDir, tempBuildDir, { recursive: true });

    // Copy shared modules
    console.log(`  🔗 Copying shared modules...`);
    fs.cpSync(SHARED_DIR, path.join(tempBuildDir, "shared"), {
      recursive: true,
    });

    // Copy root package.json dependencies to function
    console.log(`  Installing dependencies...`);
    const rootPackageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, "package.json"), "utf8")
    );
    const functionPackageJson = JSON.parse(
      fs.readFileSync(path.join(functionDir, "package.json"), "utf8")
    );

    // Merge dependencies (function-specific dependencies take precedence)
    const mergedDependencies = {
      ...rootPackageJson.dependencies,
      ...functionPackageJson.dependencies,
    };

    // Update function package.json with merged dependencies
    const updatedPackageJson = {
      ...functionPackageJson,
      dependencies: mergedDependencies,
    };

    fs.writeFileSync(
      path.join(tempBuildDir, "package.json"),
      JSON.stringify(updatedPackageJson, null, 2)
    );

    // Install dependencies
    execSync("npm install --production", {
      cwd: tempBuildDir,
      stdio: "inherit",
    });

    // Create zip file
    console.log(`  Creating deployment package...`);
    execSync(`zip -r "${zipPath}" .`, {
      cwd: tempBuildDir,
      stdio: "inherit",
    });

    // Clean up temp directory
    fs.rmSync(tempBuildDir, { recursive: true, force: true });

    console.log(`  ${functionName} built successfully: ${zipPath}`);
  } catch (error) {
    console.error(`  Failed to build ${functionName}:`, error.message);
    // Clean up on error
    if (fs.existsSync(tempBuildDir)) {
      fs.rmSync(tempBuildDir, { recursive: true, force: true });
    }
    process.exit(1);
  }
});

console.log("\n🎉 All functions built successfully!");
console.log(`Deployment packages available in: ${DIST_DIR}`);
