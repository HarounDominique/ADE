/** Abbreviation-triggered snippet content and translation, shared by both
    editor engines. `${name}` marks a placeholder field (repeats of the same
    name are linked/mirrored fields); `${}` marks the final cursor stop after
    Tab-ing through the rest. This is CodeMirror's own native snippet syntax,
    so only Monaco's side needs translating -- see toMonacoSnippet below. */
export const snippetCatalog = {
  Java: {
    structural: [
      { label: 'if', detail: 'if statement', template: 'if (${condition}) {\n\t${}\n}' },
      { label: 'for', detail: 'indexed for loop', template: 'for (int ${i} = 0; ${i} < ${limit}; ${i}++) {\n\t${}\n}' },
      { label: 'while', detail: 'while loop', template: 'while (${condition}) {\n\t${}\n}' },
      { label: 'fun', detail: 'method', template: '${returnType} ${name}(${params}) {\n\t${}\n}' },
      { label: 'class', detail: 'class', template: 'class ${Name} {\n\t${}\n}' },
    ],
    idioms: [
      { label: 'sout', detail: 'System.out.println', template: 'System.out.println(${});' },
      { label: 'psvm', detail: 'public static void main', template: 'public static void main(String[] args) {\n\t${}\n}' },
    ],
  },
  Go: {
    structural: [
      { label: 'if', detail: 'if statement', template: 'if ${condition} {\n\t${}\n}' },
      { label: 'for', detail: 'indexed for loop', template: 'for ${i} := 0; ${i} < ${limit}; ${i}++ {\n\t${}\n}' },
      { label: 'while', detail: 'for as while', template: 'for ${condition} {\n\t${}\n}' },
      { label: 'fun', detail: 'function', template: 'func ${name}(${params}) {\n\t${}\n}' },
      { label: 'struct', detail: 'struct', template: 'type ${Name} struct {\n\t${}\n}' },
    ],
    idioms: [
      { label: 'main', detail: 'main function', template: 'func main() {\n\t${}\n}' },
      { label: 'iferr', detail: 'error check', template: 'if err != nil {\n\treturn ${err}\n}' },
    ],
  },
  Python: {
    structural: [],
    idioms: [
      { label: 'main', detail: '__main__ guard', template: 'if __name__ == "__main__":\n\t${}' },
    ],
  },
  JavaScript: {
    structural: [],
    idioms: [{ label: 'clg', detail: 'console.log', template: 'console.log(${});' }],
  },
  TypeScript: {
    structural: [],
    idioms: [{ label: 'clg', detail: 'console.log', template: 'console.log(${});' }],
  },
  'C++': {
    structural: [
      { label: 'if', detail: 'if statement', template: 'if (${condition}) {\n\t${}\n}' },
      { label: 'for', detail: 'indexed for loop', template: 'for (int ${i} = 0; ${i} < ${limit}; ${i}++) {\n\t${}\n}' },
      { label: 'while', detail: 'while loop', template: 'while (${condition}) {\n\t${}\n}' },
      { label: 'fun', detail: 'function', template: '${returnType} ${name}(${params}) {\n\t${}\n}' },
      { label: 'class', detail: 'class', template: 'class ${Name} {\npublic:\n\t${}\n};' },
    ],
    idioms: [
      { label: 'main', detail: 'main function', template: 'int main() {\n\t${}\n\treturn 0;\n}' },
    ],
  },
  C: {
    structural: [
      { label: 'if', detail: 'if statement', template: 'if (${condition}) {\n\t${}\n}' },
      { label: 'for', detail: 'indexed for loop', template: 'for (int ${i} = 0; ${i} < ${limit}; ${i}++) {\n\t${}\n}' },
      { label: 'while', detail: 'while loop', template: 'while (${condition}) {\n\t${}\n}' },
      { label: 'fun', detail: 'function', template: '${returnType} ${name}(${params}) {\n\t${}\n}' },
      { label: 'struct', detail: 'struct', template: 'struct ${Name} {\n\t${}\n};' },
    ],
    idioms: [
      { label: 'main', detail: 'main function', template: 'int main(void) {\n\t${}\n\treturn 0;\n}' },
    ],
  },
  'C#': {
    structural: [
      { label: 'if', detail: 'if statement', template: 'if (${condition}) {\n\t${}\n}' },
      { label: 'for', detail: 'indexed for loop', template: 'for (int ${i} = 0; ${i} < ${limit}; ${i}++) {\n\t${}\n}' },
      { label: 'while', detail: 'while loop', template: 'while (${condition}) {\n\t${}\n}' },
      { label: 'fun', detail: 'method', template: '${returnType} ${Name}(${params})\n{\n\t${}\n}' },
      { label: 'class', detail: 'class', template: 'class ${Name}\n{\n\t${}\n}' },
    ],
    idioms: [
      { label: 'main', detail: 'Main method', template: 'static void Main(string[] args)\n{\n\t${}\n}' },
    ],
  },
  PHP: {
    structural: [
      { label: 'if', detail: 'if statement', template: 'if (${condition}) {\n\t${}\n}' },
      { label: 'for', detail: 'indexed for loop', template: 'for ($${i} = 0; $${i} < $${limit}; $${i}++) {\n\t${}\n}' },
      { label: 'while', detail: 'while loop', template: 'while (${condition}) {\n\t${}\n}' },
      { label: 'fun', detail: 'function', template: 'function ${name}(${params}) {\n\t${}\n}' },
      { label: 'class', detail: 'class', template: 'class ${Name} {\n\t${}\n}' },
    ],
    idioms: [],
  },
  Rust: {
    structural: [
      { label: 'if', detail: 'if expression', template: 'if ${condition} {\n\t${}\n}' },
      { label: 'for', detail: 'for loop', template: 'for ${item} in ${iterable} {\n\t${}\n}' },
      { label: 'while', detail: 'while loop', template: 'while ${condition} {\n\t${}\n}' },
      { label: 'fun', detail: 'function', template: 'fn ${name}(${params}) {\n\t${}\n}' },
      { label: 'struct', detail: 'struct', template: 'struct ${Name} {\n\t${}\n}' },
    ],
    idioms: [
      { label: 'main', detail: 'main function', template: 'fn main() {\n\t${}\n}' },
    ],
  },
  Kotlin: {
    structural: [
      { label: 'if', detail: 'if statement', template: 'if (${condition}) {\n\t${}\n}' },
      { label: 'for', detail: 'for-in loop', template: 'for (${item} in ${iterable}) {\n\t${}\n}' },
      { label: 'while', detail: 'while loop', template: 'while (${condition}) {\n\t${}\n}' },
      { label: 'fun', detail: 'function', template: 'fun ${name}(${params}) {\n\t${}\n}' },
      { label: 'class', detail: 'class', template: 'class ${Name} {\n\t${}\n}' },
    ],
    idioms: [{ label: 'main', detail: 'main function', template: 'fun main() {\n\t${}\n}' }],
  },
  Swift: {
    structural: [
      { label: 'if', detail: 'if statement', template: 'if ${condition} {\n\t${}\n}' },
      { label: 'for', detail: 'for-in loop', template: 'for ${item} in ${iterable} {\n\t${}\n}' },
      { label: 'while', detail: 'while loop', template: 'while ${condition} {\n\t${}\n}' },
      { label: 'fun', detail: 'function', template: 'func ${name}(${params}) {\n\t${}\n}' },
      { label: 'class', detail: 'class', template: 'class ${Name} {\n\t${}\n}' },
    ],
    idioms: [],
  },
  Ruby: {
    structural: [
      { label: 'if', detail: 'if statement', template: 'if ${condition}\n\t${}\nend' },
      { label: 'for', detail: 'each loop', template: '${iterable}.each do |${item}|\n\t${}\nend' },
      { label: 'while', detail: 'while loop', template: 'while ${condition}\n\t${}\nend' },
      { label: 'fun', detail: 'method', template: 'def ${name}(${params})\n\t${}\nend' },
      { label: 'class', detail: 'class', template: 'class ${Name}\n\t${}\nend' },
    ],
    idioms: [],
  },
  Scala: {
    structural: [
      { label: 'if', detail: 'if statement', template: 'if (${condition}) {\n\t${}\n}' },
      { label: 'for', detail: 'for comprehension', template: 'for (${item} <- ${iterable}) {\n\t${}\n}' },
      { label: 'while', detail: 'while loop', template: 'while (${condition}) {\n\t${}\n}' },
      { label: 'fun', detail: 'method', template: 'def ${name}(${params}) = {\n\t${}\n}' },
      { label: 'class', detail: 'class', template: 'class ${Name} {\n\t${}\n}' },
    ],
    idioms: [],
  },
  Dart: {
    structural: [
      { label: 'if', detail: 'if statement', template: 'if (${condition}) {\n\t${}\n}' },
      { label: 'for', detail: 'indexed for loop', template: 'for (var ${i} = 0; ${i} < ${limit}; ${i}++) {\n\t${}\n}' },
      { label: 'while', detail: 'while loop', template: 'while (${condition}) {\n\t${}\n}' },
      { label: 'fun', detail: 'function', template: '${returnType} ${name}(${params}) {\n\t${}\n}' },
      { label: 'class', detail: 'class', template: 'class ${Name} {\n\t${}\n}' },
    ],
    idioms: [{ label: 'main', detail: 'main function', template: 'void main() {\n\t${}\n}' }],
  },
  'Objective-C': {
    structural: [
      { label: 'if', detail: 'if statement', template: 'if (${condition}) {\n\t${}\n}' },
      { label: 'for', detail: 'indexed for loop', template: 'for (int ${i} = 0; ${i} < ${limit}; ${i}++) {\n\t${}\n}' },
      { label: 'while', detail: 'while loop', template: 'while (${condition}) {\n\t${}\n}' },
      { label: 'fun', detail: 'method', template: '- (${returnType})${name} {\n\t${}\n}' },
      { label: 'class', detail: 'interface (class-equivalent)', template: '@interface ${Name} : NSObject\n${}\n@end' },
    ],
    idioms: [],
  },
  Lua: {
    structural: [
      { label: 'if', detail: 'if statement', template: 'if ${condition} then\n\t${}\nend' },
      { label: 'for', detail: 'numeric for loop', template: 'for ${i} = 1, ${limit} do\n\t${}\nend' },
      { label: 'while', detail: 'while loop', template: 'while ${condition} do\n\t${}\nend' },
      { label: 'fun', detail: 'function', template: 'function ${name}(${params})\n\t${}\nend' },
    ],
    idioms: [],
  },
  Perl: {
    structural: [
      { label: 'if', detail: 'if statement', template: 'if (${condition}) {\n\t${}\n}' },
      { label: 'for', detail: 'foreach loop', template: 'for my $${item} (@${array}) {\n\t${}\n}' },
      { label: 'while', detail: 'while loop', template: 'while (${condition}) {\n\t${}\n}' },
      { label: 'fun', detail: 'subroutine', template: 'sub ${name} {\n\t${}\n}' },
    ],
    idioms: [],
  },
  PowerShell: {
    structural: [
      { label: 'if', detail: 'if statement', template: 'if (${condition}) {\n\t${}\n}' },
      { label: 'for', detail: 'indexed for loop', template: 'for ($${i} = 0; $${i} -lt $${limit}; $${i}++) {\n\t${}\n}' },
      { label: 'while', detail: 'while loop', template: 'while (${condition}) {\n\t${}\n}' },
      { label: 'fun', detail: 'function', template: 'function ${Name} {\n\tparam(${params})\n\t${}\n}' },
    ],
    idioms: [],
  },
  Shell: {
    structural: [
      { label: 'if', detail: 'if statement', template: 'if [ ${condition} ]; then\n\t${}\nfi' },
      { label: 'for', detail: 'for loop', template: 'for ${item} in ${list}; do\n\t${}\ndone' },
      { label: 'while', detail: 'while loop', template: 'while [ ${condition} ]; do\n\t${}\ndone' },
      { label: 'fun', detail: 'function', template: '${name}() {\n\t${}\n}' },
    ],
    idioms: [],
  },
  'F#': {
    structural: [
      { label: 'if', detail: 'if expression', template: 'if ${condition} then\n\t${}' },
      { label: 'for', detail: 'for loop', template: 'for ${item} in ${iterable} do\n\t${}' },
      { label: 'while', detail: 'while loop', template: 'while ${condition} do\n\t${}' },
      { label: 'fun', detail: 'let binding', template: 'let ${name} ${params} =\n\t${}' },
    ],
    idioms: [],
  },
  Elixir: {
    structural: [
      { label: 'if', detail: 'if expression', template: 'if ${condition} do\n\t${}\nend' },
      { label: 'for', detail: 'for comprehension', template: 'for ${item} <- ${iterable} do\n\t${}\nend' },
      { label: 'fun', detail: 'function definition', template: 'def ${name}(${params}) do\n\t${}\nend' },
      { label: 'module', detail: 'module (class-equivalent)', template: 'defmodule ${Name} do\n\t${}\nend' },
    ],
    idioms: [],
  },
  R: {
    structural: [
      { label: 'if', detail: 'if statement', template: 'if (${condition}) {\n\t${}\n}' },
      { label: 'for', detail: 'for loop', template: 'for (${item} in ${iterable}) {\n\t${}\n}' },
      { label: 'while', detail: 'while loop', template: 'while (${condition}) {\n\t${}\n}' },
      { label: 'fun', detail: 'function', template: '${name} <- function(${params}) {\n\t${}\n}' },
    ],
    idioms: [],
  },
};

/** The one translation this needs -- neutral ${name}/${} to Monaco's own
    numbered ${n:name}/$0 syntax. Linked fields (the same name appearing more
    than once) get the same number; the first ${} found becomes $0; a
    template with no placeholders at all passes through unchanged. */
export function toMonacoSnippet(template) {
  const seen = new Map();
  let next = 1;
  return template.replace(/\$\{([^}]*)\}/g, (_, name) => {
    if (name === '') return '$0';
    if (!seen.has(name)) seen.set(name, next++);
    return `\${${seen.get(name)}:${name}}`;
  });
}
