/**
 * Example: Using api-smart-diff for OpenAPI Diff
 *
 * api-smart-diff is a TypeScript library for comparing JSON-based API documents.
 *
 * Features:
 * - Pure TypeScript (99.3% of codebase)
 * - Supports OpenAPI 3.0, AsyncAPI 2.x, JsonSchema, GraphQL, Swagger 2.0
 * - Classifies changes as breaking, non-breaking, deprecated, annotation
 * - Human-readable change descriptions
 * - Resolves $ref pointers including circular references
 * - Works in Node.js and browser environments
 *
 * Installation: npm install api-smart-diff
 *
 * @see https://github.com/udamir/api-smart-diff
 * @see https://www.npmjs.com/package/api-smart-diff
 */

import { apiCompare, apiDiff, apiMerge } from "api-smart-diff";
import type { Diff, CompareOptions, DiffAction } from "api-smart-diff";
import { readFileSync } from "fs";
import { parse } from "yaml";

// Helper to load and parse YAML files
function loadYamlSpec(filePath: string): object {
  const content = readFileSync(filePath, "utf-8");
  return parse(content);
}

// Helper to format diff action for display
function formatAction(action: DiffAction): string {
  const icons: Record<DiffAction, string> = {
    add: "+",
    remove: "-",
    replace: "~",
    rename: "->",
    test: "?",
  };
  return icons[action] || action;
}

// Helper to format change type for display
function formatChangeType(type?: string): string {
  const colors: Record<string, string> = {
    breaking: "\x1b[31m[BREAKING]\x1b[0m",
    "non-breaking": "\x1b[32m[NON-BREAKING]\x1b[0m",
    deprecated: "\x1b[33m[DEPRECATED]\x1b[0m",
    annotation: "\x1b[36m[ANNOTATION]\x1b[0m",
    unclassified: "\x1b[90m[UNCLASSIFIED]\x1b[0m",
  };
  return colors[type || "unclassified"] || `[${type}]`;
}

async function main() {
  console.log("=".repeat(70));
  console.log("OpenAPI Diff Example using api-smart-diff");
  console.log("=".repeat(70));

  // Load OpenAPI specifications
  const specV1 = loadYamlSpec("./openapi-v1.yaml");
  const specV2 = loadYamlSpec("./openapi-v2.yaml");

  console.log("\nComparing OpenAPI v1.0.0 -> v2.0.0\n");

  // Option 1: Using apiCompare (recommended for most use cases)
  // Returns both diffs and a merged document with change metadata
  const options: CompareOptions = {
    // Specify the format for better diff classification
    // Options: "openapi3", "openapi3.1", "asyncapi2", "asyncapi3", "jsonSchema", "graphApi"
  };

  const { diffs, merged } = apiCompare(specV1, specV2, options);

  // Categorize changes
  const breakingChanges = diffs.filter((d) => d.type === "breaking");
  const nonBreakingChanges = diffs.filter((d) => d.type === "non-breaking");
  const deprecatedChanges = diffs.filter((d) => d.type === "deprecated");
  const annotationChanges = diffs.filter((d) => d.type === "annotation");
  const unclassifiedChanges = diffs.filter(
    (d) => !d.type || d.type === "unclassified"
  );

  // Summary
  console.log("-".repeat(70));
  console.log("SUMMARY");
  console.log("-".repeat(70));
  console.log(`Total changes detected: ${diffs.length}`);
  console.log(`  - Breaking changes:     ${breakingChanges.length}`);
  console.log(`  - Non-breaking changes: ${nonBreakingChanges.length}`);
  console.log(`  - Deprecated:           ${deprecatedChanges.length}`);
  console.log(`  - Annotations:          ${annotationChanges.length}`);
  console.log(`  - Unclassified:         ${unclassifiedChanges.length}`);

  // Breaking Changes Details
  if (breakingChanges.length > 0) {
    console.log("\n" + "-".repeat(70));
    console.log("BREAKING CHANGES (require client updates)");
    console.log("-".repeat(70));
    breakingChanges.forEach((diff, index) => {
      console.log(
        `\n${index + 1}. ${formatChangeType(diff.type)} ${formatAction(diff.action)}`
      );
      console.log(`   Path: ${diff.path.join("/")}`);
      if (diff.description) {
        console.log(`   Description: ${diff.description}`);
      }
      if (diff.before !== undefined) {
        console.log(`   Before: ${JSON.stringify(diff.before)}`);
      }
      if (diff.after !== undefined) {
        console.log(`   After:  ${JSON.stringify(diff.after)}`);
      }
    });
  }

  // Non-Breaking Changes Details
  if (nonBreakingChanges.length > 0) {
    console.log("\n" + "-".repeat(70));
    console.log("NON-BREAKING CHANGES (backward compatible)");
    console.log("-".repeat(70));
    nonBreakingChanges.slice(0, 10).forEach((diff, index) => {
      console.log(
        `\n${index + 1}. ${formatChangeType(diff.type)} ${formatAction(diff.action)}`
      );
      console.log(`   Path: ${diff.path.join("/")}`);
      if (diff.description) {
        console.log(`   Description: ${diff.description}`);
      }
    });
    if (nonBreakingChanges.length > 10) {
      console.log(`\n   ... and ${nonBreakingChanges.length - 10} more`);
    }
  }

  // Option 2: Using apiDiff directly (lower-level API)
  // Returns just the array of diffs without merging
  console.log("\n" + "=".repeat(70));
  console.log("Alternative: Using apiDiff() directly");
  console.log("=".repeat(70));

  const rawDiffs = apiDiff(specV1, specV2);
  console.log(`\napiDiff() returned ${rawDiffs.length} raw differences`);

  // Option 3: Using apiMerge (get merged doc with embedded change info)
  console.log("\n" + "=".repeat(70));
  console.log("Alternative: Using apiMerge() for merged document");
  console.log("=".repeat(70));

  const mergedDoc = apiMerge(specV1, specV2);
  console.log(`\nMerged document contains change metadata in $diff properties`);
  console.log(
    `This is useful for visual diff rendering in documentation tools`
  );

  // Practical example: CI/CD integration check
  console.log("\n" + "=".repeat(70));
  console.log("CI/CD Integration Example");
  console.log("=".repeat(70));

  const hasBreakingChanges = breakingChanges.length > 0;

  if (hasBreakingChanges) {
    console.log(
      "\n\x1b[31mWARNING: Breaking changes detected!\x1b[0m"
    );
    console.log("Consider:");
    console.log("  1. Bumping the major version");
    console.log("  2. Providing migration guides");
    console.log("  3. Deprecation period for removed features");
    console.log("\nIn CI/CD, you might want to:");
    console.log("  - Block merges to main branch");
    console.log("  - Require explicit approval");
    console.log("  - Generate changelog automatically");
    // process.exit(1); // Uncomment to fail CI on breaking changes
  } else {
    console.log("\n\x1b[32mNo breaking changes detected.\x1b[0m");
    console.log("Safe to release as minor/patch version.");
  }

  console.log("\n" + "=".repeat(70));
  console.log("Example completed!");
  console.log("=".repeat(70));
}

// Export for programmatic use
export { loadYamlSpec, formatChangeType, formatAction };

// Run if executed directly
main().catch(console.error);
