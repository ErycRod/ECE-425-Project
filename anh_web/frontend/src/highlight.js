import { createElement } from "react";

// Very small syntax colouring for the developer view (Verilog and Python).
// It splits one line into pieces and wraps each in a <span> with a class.
// React escapes the text, so file contents are never treated as HTML.

const KEYWORDS = {
  verilog: new Set([
    "module", "endmodule", "input", "output", "inout", "wire", "reg", "signed", "parameter",
    "localparam", "always", "begin", "end", "if", "else", "assign", "posedge", "negedge",
    "generate", "endgenerate", "genvar", "for", "integer", "initial", "case", "endcase",
    "default", "function", "endfunction", "task", "endtask",
  ]),
  python: new Set([
    "def", "return", "if", "elif", "else", "for", "in", "while", "import", "from", "as",
    "class", "and", "or", "not", "is", "None", "True", "False", "with", "try", "except",
    "raise", "lambda", "yield", "pass", "break", "continue", "global",
  ]),
};

// tokens: comment | string | number | word | anything else
const TOKEN = /(\/\/.*$|#.*$|"[^"]*"|'[^']*'|`\w+|\b\d[\w.']*\b|\b[A-Za-z_]\w*\b)/g;

function piece(kind, text, key) {
  if (kind === null) {
    return text;
  }
  return createElement("span", { className: "tok-" + kind, key: key }, text);
}

// state: { inDocstring } carried from line to line for Python docstrings
export function highlightLine(line, language, state) {
  const keywords = KEYWORDS[language] || new Set();

  // Python docstrings (""" ... """) can span many lines
  if (language === "python") {
    const quoteCount = line.split('"""').length - 1;
    if (state.inDocstring || quoteCount > 0) {
      const wasInside = state.inDocstring;
      if (quoteCount % 2 === 1) {
        state.inDocstring = !state.inDocstring;
      }
      if (wasInside || quoteCount > 0) {
        return [piece("comment", line, 0)];
      }
    }
  }

  let parts = [];
  let last = 0;
  let match;
  let key = 0;
  TOKEN.lastIndex = 0;
  while ((match = TOKEN.exec(line)) !== null) {
    const text = match[0];
    if (match.index > last) {
      parts.push(line.slice(last, match.index));
    }
    let kind = null;
    if (text.startsWith("//") && language === "verilog") {
      kind = "comment";
    } else if (text.startsWith("#") && language === "python") {
      kind = "comment";
    } else if (text.startsWith("#")) {
      // "#" in Verilog is a parameter list or delay, not a comment: colour only the symbol
      parts.push(text.slice(0, 1));
      last = match.index + 1;
      TOKEN.lastIndex = last;
      continue;
    } else if (text.startsWith('"') || text.startsWith("'")) {
      kind = "string";
    } else if (text.startsWith("`")) {
      kind = "directive";
    } else if (/^\d/.test(text)) {
      kind = "number";
    } else if (keywords.has(text)) {
      kind = "keyword";
    }
    parts.push(piece(kind, text, key));
    key = key + 1;
    last = match.index + text.length;
  }
  if (last < line.length) {
    parts.push(line.slice(last));
  }
  return parts;
}
