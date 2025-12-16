/**
 * Example: Using openapi-diff (Atlassian) for OpenAPI Diff
 *
 * openapi-diff is a TypeScript-based CLI and library for comparing
 * Swagger 2.0 and OpenAPI 3.0 specifications.
 *
 * Features:
 * - TypeScript-based (97.9% of codebase)
 * - Classifies changes as breaking, non-breaking, unclassified
 * - CLI tool with exit codes for CI/CD integration
 * - Programmatic API available
 * - Supports both JSON and YAML files
 * - Supports URLs as input
 *
 * Installation: npm install openapi-diff --save-dev
 *
 * @see https://bitbucket.org/atlassian/openapi-diff
 * @see https://www.npmjs.com/package/openapi-diff
 */

import openapiDiff from "openapi-diff";
import type {
  OpenApiDiffOptions,
  DiffOutcome,
  DiffOutcomeFailure,
  SpecDiff,
} from "openapi-diff";
import { readFileSync } from "fs";

// Helper to format diff results
function formatSpecDiff(diff: SpecDiff, indent: string = "  "): string {
  const lines: string[] = [];

  if (diff.sourceSpecEntityDetails.length > 0) {
    lines.push(`${indent}Source locations:`);
    diff.sourceSpecEntityDetails.forEach((detail) => {
      lines.push(`${indent}  - ${detail.location} (${detail.value || "N/A"})`);
    });
  }

  if (diff.destinationSpecEntityDetails.length > 0) {
    lines.push(`${indent}Destination locations:`);
    diff.destinationSpecEntityDetails.forEach((detail) => {
      lines.push(`${indent}  - ${detail.location} (${detail.value || "N/A"})`);
    });
  }

  return lines.join("\n");
}

async function main() {
  console.log("=".repeat(70));
  console.log("OpenAPI Diff Example using openapi-diff (Atlassian)");
  console.log("=".repeat(70));

  // Load OpenAPI specifications as strings
  const specV1Content = readFileSync("./openapi-v1.yaml", "utf-8");
  const specV2Content = readFileSync("./openapi-v2.yaml", "utf-8");

  console.log("\nComparing OpenAPI v1.0.0 -> v2.0.0\n");

  try {
    // Run the diff
    // The library accepts file content as strings with format hints
    const result: DiffOutcome = await openapiDiff.diffSpecs({
      sourceSpec: {
        content: specV1Content,
        location: "openapi-v1.yaml",
        format: "openapi3", // 'openapi3' or 'swagger2'
      },
      destinationSpec: {
        content: specV2Content,
        location: "openapi-v2.yaml",
        format: "openapi3",
      },
    });

    // Check result type
    if (result.breakingDifferencesFound) {
      // Type narrowing: result is DiffOutcomeFailure
      const failureResult = result as DiffOutcomeFailure;

      console.log("-".repeat(70));
      console.log("SUMMARY");
      console.log("-".repeat(70));
      console.log(
        `\x1b[31mBREAKING CHANGES DETECTED!\x1b[0m`
      );
      console.log(
        `Breaking differences: ${failureResult.breakingDifferences.length}`
      );
      console.log(
        `Non-breaking differences: ${failureResult.nonBreakingDifferences.length}`
      );
      console.log(
        `Unclassified differences: ${failureResult.unclassifiedDifferences.length}`
      );

      // Breaking Changes Details
      if (failureResult.breakingDifferences.length > 0) {
        console.log("\n" + "-".repeat(70));
        console.log("BREAKING CHANGES");
        console.log("-".repeat(70));

        failureResult.breakingDifferences.forEach((diff, index) => {
          console.log(`\n${index + 1}. \x1b[31m${diff.code}\x1b[0m`);

          // Group by action for readability
          switch (diff.code) {
            case "path.removed":
              console.log("   A path was removed from the API");
              break;
            case "method.removed":
              console.log("   An HTTP method was removed from a path");
              break;
            case "request.body.scope.changed":
              console.log("   Request body requirements changed");
              break;
            case "response.body.scope.changed":
              console.log("   Response body structure changed");
              break;
            case "request.property.added":
              console.log("   A required property was added to request");
              break;
            case "request.property.removed":
              console.log("   A property was removed from request schema");
              break;
            case "response.property.removed":
              console.log("   A property was removed from response schema");
              break;
            case "parameter.added":
              console.log("   A required parameter was added");
              break;
            case "parameter.removed":
              console.log("   A parameter was removed");
              break;
            case "parameter.type.changed":
              console.log("   A parameter type was changed");
              break;
            default:
              console.log(`   ${diff.code}`);
          }

          console.log(formatSpecDiff(diff));
        });
      }

      // Non-Breaking Changes Details
      if (failureResult.nonBreakingDifferences.length > 0) {
        console.log("\n" + "-".repeat(70));
        console.log("NON-BREAKING CHANGES");
        console.log("-".repeat(70));

        failureResult.nonBreakingDifferences.slice(0, 5).forEach((diff, index) => {
          console.log(`\n${index + 1}. \x1b[32m${diff.code}\x1b[0m`);
          console.log(formatSpecDiff(diff));
        });

        if (failureResult.nonBreakingDifferences.length > 5) {
          console.log(
            `\n   ... and ${failureResult.nonBreakingDifferences.length - 5} more`
          );
        }
      }

      // Unclassified Changes
      if (failureResult.unclassifiedDifferences.length > 0) {
        console.log("\n" + "-".repeat(70));
        console.log("UNCLASSIFIED CHANGES");
        console.log("-".repeat(70));

        failureResult.unclassifiedDifferences.slice(0, 5).forEach((diff, index) => {
          console.log(`\n${index + 1}. \x1b[90m${diff.code}\x1b[0m`);
          console.log(formatSpecDiff(diff));
        });

        if (failureResult.unclassifiedDifferences.length > 5) {
          console.log(
            `\n   ... and ${failureResult.unclassifiedDifferences.length - 5} more`
          );
        }
      }
    } else {
      // No breaking changes
      console.log("-".repeat(70));
      console.log("SUMMARY");
      console.log("-".repeat(70));
      console.log(
        `\x1b[32mNo breaking changes detected!\x1b[0m`
      );

      if ("nonBreakingDifferences" in result) {
        console.log(
          `Non-breaking differences: ${result.nonBreakingDifferences.length}`
        );
        console.log(
          `Unclassified differences: ${result.unclassifiedDifferences.length}`
        );
      }
    }

    // CI/CD Integration Example
    console.log("\n" + "=".repeat(70));
    console.log("CI/CD Integration Example");
    console.log("=".repeat(70));

    if (result.breakingDifferencesFound) {
      console.log(
        "\n\x1b[31mCI/CD: Would exit with code 1 (breaking changes found)\x1b[0m"
      );
      console.log("\nUsage in package.json:");
      console.log('  "scripts": {');
      console.log(
        '    "api:check": "openapi-diff ./openapi-v1.yaml ./openapi-v2.yaml"'
      );
      console.log("  }");
      console.log("\nThe CLI will exit with code 1 if breaking changes exist.");
      // process.exit(1); // Uncomment to actually fail in CI
    } else {
      console.log(
        "\n\x1b[32mCI/CD: Would exit with code 0 (no breaking changes)\x1b[0m"
      );
    }
  } catch (error) {
    console.error("Error comparing specs:", error);
    process.exit(1);
  }

  // Alternative: Using CLI directly
  console.log("\n" + "=".repeat(70));
  console.log("CLI Usage");
  console.log("=".repeat(70));
  console.log("\nTo use the CLI directly:");
  console.log("  npx openapi-diff ./openapi-v1.yaml ./openapi-v2.yaml");
  console.log("\nOr with URLs:");
  console.log(
    "  npx openapi-diff https://api.example.com/v1/openapi.json https://api.example.com/v2/openapi.json"
  );
  console.log("\nCI/CD pipeline example (GitHub Actions):");
  console.log(`
  - name: Check for breaking API changes
    run: |
      npx openapi-diff \\
        ./api/openapi-current.yaml \\
        ./api/openapi-proposed.yaml
`);

  console.log("=".repeat(70));
  console.log("Example completed!");
  console.log("=".repeat(70));
}

// Run if executed directly
main().catch(console.error);
