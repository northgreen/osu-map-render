import * as fs from "fs";
import * as path from "path";
import { parseStoryboardFile } from "../src/lib/sbParser";

function main() {
  const publicDir = path.join(process.cwd(), "public");
  const osbPath = path.join(publicDir, "storyboard.osb");

  console.log("Parsing storyboard...");

  const storyboard = parseStoryboardFile(osbPath);

  if (!storyboard) {
    console.error("Failed to parse storyboard");
    process.exit(1);
  }

  // Write parsed storyboard to JSON
  const outputPath = path.join(
    process.cwd(),
    "src",
    "generated",
    "storyboard.json",
  );
  fs.writeFileSync(outputPath, JSON.stringify(storyboard, null, 2));

  console.log(`Parsed ${storyboard.objects.length} storyboard objects`);
  console.log(`Duration: ${storyboard.duration}ms`);
  console.log(`Saved to ${outputPath}`);

  // Print summary
  const byLayer: Record<string, number> = {};
  for (const obj of storyboard.objects) {
    byLayer[obj.layer] = (byLayer[obj.layer] || 0) + 1;
  }

  console.log("\nObjects by layer:");
  for (const [layer, count] of Object.entries(byLayer)) {
    console.log(`  ${layer}: ${count}`);
  }
}

main();
