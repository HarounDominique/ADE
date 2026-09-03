import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

export type ReferenceImpact = {
  target: string;
  citers: readonly string[];
  broken: readonly string[];
};

export async function findReferenceImpact(root: string, target: string): Promise<ReferenceImpact> {
  const files = (await readdir(root)).filter((file) => file.endsWith(".md"));
  const citers: string[] = [];
  const broken: string[] = [];
  for (const file of files) {
    const content = await readFile(join(root, file), "utf8");
    if (!content.includes(target)) continue;
    citers.push(file);
    if (!content.match(new RegExp(`\\(${target.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}(?:#[^)]+)?\\)`))) broken.push(file);
  }
  return { target, citers: citers.sort(), broken: broken.sort() };
}

export async function listMarkdownReferences(root: string): Promise<readonly string[]> {
  const files = (await readdir(root)).filter((file) => file.endsWith(".md"));
  const references = new Set<string>();
  for (const file of files) {
    const content = await readFile(join(root, file), "utf8");
    for (const match of content.matchAll(/\]\((SPEC-[^)#]+\.md)(?:#[^)]+)?\)/g)) references.add(relative(root, join(root, match[1] ?? "")));
  }
  return [...references].sort();
}
