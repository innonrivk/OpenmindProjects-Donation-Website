import React from 'react';

/**
 * Scans layout text character-by-character to extract layout style tokens.
 * 
 * Why character scan? Standard regex-based token splitting fails to support nested
 * identical delimiters (like $$ inside $$) because regex search is inherently linear
 * and cannot track depth. A custom state scanner extracts atomic formatting markers.
 * 
 * @param {string} text - Raw plain text segment.
 * @returns {Object[]} Array of token objects containing type, value and raw characters.
 */
function tokenize(text) {
  const tokens = [];
  let i = 0;
  let textAccumulator = '';

  const flushText = () => {
    if (textAccumulator) {
      tokens.push({ type: 'TEXT', value: textAccumulator, raw: textAccumulator });
      textAccumulator = '';
    }
  };

  while (i < text.length) {
    if (text.startsWith('***', i)) {
      flushText();
      tokens.push({ type: 'BOLD_GRADIENT', raw: '***' });
      i += 3;
    } else if (text.startsWith('**', i)) {
      flushText();
      tokens.push({ type: 'GRADIENT', raw: '**' });
      i += 2;
    } else if (text.startsWith('$$', i)) {
      flushText();
      tokens.push({ type: 'GOLD', raw: '$$' });
      i += 2;
    } else if (text.startsWith('__', i)) {
      flushText();
      tokens.push({ type: 'UNDERLINE', raw: '__' });
      i += 2;
    } else if (text.startsWith('!!', i)) {
      flushText();
      tokens.push({ type: 'DEFAULT_COLOR', raw: '!!' });
      i += 2;
    } else if (text.startsWith('*', i)) {
      flushText();
      tokens.push({ type: 'BOLD', raw: '*' });
      i += 1;
    } else {
      textAccumulator += text[i];
      i += 1;
    }
  }
  flushText();
  return tokens;
}

/**
 * Resolves opening and closing delimiter pairs in a token list and converts unmatched ones to text.
 * 
 * Why lookahead matching? Symmetric delimiters (e.g. $$) have the same opening and closing representation.
 * In a nested configuration like $$__!!$$text$$!!__$$, the second $$ should open a nested block, not close the
 * first one, because its inner formatting wrappers (!! and __) have matching closing partners later in the stream.
 * Checking if active items above the matched tag have remaining partners resolves role assignments correctly.
 * 
 * @param {Object[]} tokens - Output from the tokenizer.
 * @returns {Object[]} Preprocessed tokens with role ('open'|'close') and partnerIdx attributes.
 */
function preprocessTokens(tokens) {
  const stack = [];
  const matchedPairs = new Map();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'TEXT') continue;

    let matchStackIdx = -1;
    for (let j = stack.length - 1; j >= 0; j--) {
      if (stack[j].type === token.type) {
        let hasRemainingMatchesForAbove = false;
        for (let k = j + 1; k < stack.length; k++) {
          const aboveType = stack[k].type;
          let found = false;
          for (let m = i + 1; m < tokens.length; m++) {
            if (tokens[m].type === aboveType) {
              found = true;
              break;
            }
          }
          if (found) {
            hasRemainingMatchesForAbove = true;
            break;
          }
        }

        if (!hasRemainingMatchesForAbove) {
          matchStackIdx = j;
          break;
        }
      }
    }

    if (matchStackIdx !== -1) {
      matchedPairs.set(stack[matchStackIdx].originalIdx, i);
      stack.splice(matchStackIdx);
    } else {
      stack.push({ type: token.type, originalIdx: i });
    }
  }

  const closeToOpen = new Map();
  for (const [openIdx, closeIdx] of matchedPairs.entries()) {
    closeToOpen.set(closeIdx, openIdx);
  }

  return tokens.map((token, idx) => {
    if (token.type === 'TEXT') {
      return token;
    }
    if (matchedPairs.has(idx)) {
      return {
        ...token,
        role: 'open',
        partnerIdx: matchedPairs.get(idx)
      };
    } else if (closeToOpen.has(idx)) {
      return {
        ...token,
        role: 'close',
        partnerIdx: closeToOpen.get(idx)
      };
    } else {
      return { type: 'TEXT', value: token.raw, raw: token.raw };
    }
  });
}

/**
 * Builds an abstract syntax tree (AST) from paired formatting tokens.
 * 
 * Why AST parsing? A tree representation allows React's JSX tree structure to map directly
 * to nested format elements, preventing elements from overlapping or being broken up in the output.
 * 
 * @param {Object[]} tokens - Preprocessed tokens with role assignments.
 * @returns {Object[]} An AST node list of nested styling elements.
 */
function parse(tokens) {
  const root = { type: 'ROOT', children: [] };
  const stack = [root];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'TEXT') {
      stack[stack.length - 1].children.push({ type: 'TEXT', value: token.value });
    } else if (token.role === 'open') {
      const newNode = { type: token.type, children: [], openIdx: i };
      stack[stack.length - 1].children.push(newNode);
      stack.push(newNode);
    } else if (token.role === 'close') {
      let matchIdx = -1;
      for (let j = stack.length - 1; j > 0; j--) {
        if (stack[j].openIdx === token.partnerIdx) {
          matchIdx = j;
          break;
        }
      }
      if (matchIdx !== -1) {
        while (stack.length > matchIdx) {
          stack.pop();
        }
      }
    }
  }

  return root.children;
}

/**
 * Recursively maps parsed AST nodes to React elements.
 * 
 * Why nested render? Rendering the node tree dynamically nests spans and strong tags
 * correctly. Combined bold-gradient layouts clip text gradients correctly by wrapping 
 * a gradient span within a strong block.
 * 
 * @param {Object[]} nodes - List of AST nodes to render.
 * @param {string} [parentKey='root'] - Parent element path to ensure unique React keys.
 * @returns {React.ReactNode[]} JSX element array.
 */
function renderNodeTree(nodes, parentKey = 'root') {
  return nodes.map((node, index) => {
    const key = `${parentKey}-${index}-${node.type}`;
    if (node.type === 'TEXT') {
      return node.value;
    }

    const children = renderNodeTree(node.children, key);

    if (node.type === 'BOLD_GRADIENT') {
      return (
        <strong key={key} className="bold-text">
          <span className="gradient-text">{children}</span>
        </strong>
      );
    }
    if (node.type === 'GRADIENT') {
      return <span key={key} className="gradient-text">{children}</span>;
    }
    if (node.type === 'GOLD') {
      return <span key={key} className="gradient-gold">{children}</span>;
    }
    if (node.type === 'UNDERLINE') {
      return <span key={key} className="underline-text">{children}</span>;
    }
    if (node.type === 'DEFAULT_COLOR') {
      return <span key={key} className="default-color-text">{children}</span>;
    }
    if (node.type === 'BOLD') {
      return <strong key={key} className="bold-text">{children}</strong>;
    }

    return children;
  });
}

/**
 * Recursively parses formatting tokens in a text string and returns React elements.
 * 
 * Why keep signature? External pages/components rely on parseTextRecursive to
 * process lines. Replacing its internals with tokenizer/parser code fixes all nesting bugs
 * without changing the utility's contract.
 *
 * @param {string} text - Input plain text segment.
 * @returns {React.ReactNode[]} Array of React elements and strings.
 */
function parseTextRecursive(text) {
  if (!text) return [];
  const tokens = tokenize(text);
  const preprocessed = preprocessTokens(tokens);
  const ast = parse(preprocessed);
  return renderNodeTree(ast);
}


/**
 * Main parser utility to convert raw text with layout styles and line breaks into React nodes.
 * 
 * Why split by paragraphs/lines first? Pre-splitting layout text elements by paragraphs (\n\n)
 * and line breaks (\n) ensures that structural block styles (like <p> and <br /> tags) are
 * generated cleanly, avoiding the need for a full, heavy markdown library like react-markdown.
 *
 * @param {string} text - The raw string database copy.
 * @returns {React.ReactNode} React element tree.
 */
export function formatContent(text) {
  if (!text) return '';

  // Replace literal '\n' string typed by users with actual newline characters
  const processedText = text.replace(/\\n/g, '\n');
  const paragraphs = processedText.split('\n\n');

  return paragraphs.map((para, paraIdx) => {
    const lines = para.split('\n');
    const renderedLine = lines.map((line, lineIdx) => {
      const parsedElements = parseTextRecursive(line);
      return (
        <React.Fragment key={`line-${lineIdx}`}>
          {lineIdx > 0 && <br />}
          {parsedElements}
        </React.Fragment>
      );
    });

    return (
      <p key={`p-${paraIdx}`} className="layout-paragraph">
        {renderedLine}
      </p>
    );
  });
}

/**
 * Parses formatting tokens and returns inline React elements without paragraph wrapping.
 *
 * Why inline? Heading tags (<h1>, <h2>) must not contain nested block-level <p> tags,
 * which would violate semantic HTML specifications and cause markup hydration warnings.
 *
 * @param {string} text - Raw content block.
 * @returns {React.ReactNode} Inline react node tree.
 */
export function formatContentInline(text) {
  if (!text) return '';
  return parseTextRecursive(text);
}
