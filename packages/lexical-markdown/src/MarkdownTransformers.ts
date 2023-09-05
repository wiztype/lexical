/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {HeadingTagType} from '@lexical/rich-text';

import {$createCodeNode, $isCodeNode, CodeNode} from '@lexical/code';
import {$createLinkNode, $isLinkNode, LinkNode} from '@lexical/link';
import {
  $isListItemNode,
  $isListNode,
  ListItemNode,
  ListNode,
} from '@lexical/list';
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
  HeadingNode,
  QuoteNode,
} from '@lexical/rich-text';
import {
  $createLineBreakNode,
  $createTextNode,
  $isBlockNode,
  $isBlockTextNode,
  $isTextNode,
  BlockNode,
  ElementNode,
  Klass,
  LexicalNode,
  TextFormatType,
  TextNode,
} from 'lexical';

export type Transformer =
  | ElementTransformer
  | TextFormatTransformer
  | TextMatchTransformer;

export type ElementTransformer = {
  dependencies: Array<Klass<LexicalNode>>;
  export: (
    node: LexicalNode,
    // eslint-disable-next-line no-shadow
    traverseChildren: (node: ElementNode) => string,
  ) => string | null;
  regExp: RegExp;
  replace: (
    parentNode: ElementNode,
    children: Array<LexicalNode>,
    match: Array<string>,
    isImport: boolean,
  ) => void;
  type: 'element';
};

export type TextFormatTransformer = Readonly<{
  format: ReadonlyArray<TextFormatType>;
  tag: string;
  intraword?: boolean;
  type: 'text-format';
}>;

export type TextMatchTransformer = Readonly<{
  dependencies: Array<Klass<LexicalNode>>;
  export: (
    node: LexicalNode,
    // eslint-disable-next-line no-shadow
    exportChildren: (node: ElementNode) => string,
    // eslint-disable-next-line no-shadow
    exportFormat: (node: TextNode, textContent: string) => string,
  ) => string | null;
  importRegExp: RegExp;
  regExp: RegExp;
  replace: (node: TextNode, match: RegExpMatchArray) => void;
  trigger: string;
  type: 'text-match';
}>;

const createOrUpdateBlockNode = (
  createOrUpdateNode: (
    match: Array<string>,
    block?: BlockNode,
  ) => ElementNode | undefined,
): ElementTransformer['replace'] => {
  return (parentNode, children, match) => {
    const grandParent = parentNode.getParent();
    let node: ElementNode | undefined;
    if ($isBlockTextNode(parentNode) && $isBlockNode(grandParent)) {
      node = createOrUpdateNode(match, grandParent);
      if (!node) {
        parentNode.select(0, 0);
        return;
      }
    }
    if (!node) {
      node = createOrUpdateNode(match);
    }
    if (node) {
      node.append(...children);
      parentNode.replace(node);
      node.select(0, 0);
    }
  };
};

// Amount of spaces that define indentation level
// TODO: should be an option
const LIST_INDENT_SIZE = 4;

const listExport = (
  listNode: ListNode,
  exportChildren: (node: ElementNode) => string,
  depth: number,
): string => {
  const output = [];
  const children = listNode.getChildren();
  let index = 0;
  for (const listItemNode of children) {
    if ($isListItemNode(listItemNode)) {
      if (listItemNode.getChildrenSize() === 1) {
        const firstChild = listItemNode.getFirstChild();
        if ($isListNode(firstChild)) {
          output.push(listExport(firstChild, exportChildren, depth + 1));
          continue;
        }
      }
      const indent = ' '.repeat(depth * LIST_INDENT_SIZE);
      const listType = listNode.getListType();
      const prefix =
        listType === 'number'
          ? `${listNode.getStart() + index}. `
          : listType === 'check'
          ? `- [${listItemNode.getChecked() ? 'x' : ' '}] `
          : '- ';
      output.push(indent + prefix + exportChildren(listItemNode));
      index++;
    }
  }

  return output.join('\n');
};

export const HEADING: ElementTransformer = {
  dependencies: [HeadingNode],
  export: (node, exportChildren) => {
    if (!$isHeadingNode(node)) {
      return null;
    }
    const level = Number(node.getTag().slice(1));
    return '#'.repeat(level) + ' ' + exportChildren(node);
  },
  regExp: /^(#{1,6})\s/,
  replace: createOrUpdateBlockNode((match, block) => {
    if (block) {
      block.setBlockType(`h${match[1].length}` as HeadingTagType);
      return;
    }
    const tag = ('h' + match[1].length) as HeadingTagType;
    return $createHeadingNode(tag);
  }),
  type: 'element',
};

export const QUOTE: ElementTransformer = {
  dependencies: [QuoteNode],
  export: (node, exportChildren) => {
    if (!$isQuoteNode(node)) {
      return null;
    }

    const lines = exportChildren(node).split('\n');
    const output = [];
    for (const line of lines) {
      output.push('> ' + line);
    }
    return output.join('\n');
  },
  regExp: /^>\s/,
  replace: (parentNode, children, _match, isImport) => {
    if (isImport) {
      const previousNode = parentNode.getPreviousSibling();
      if ($isQuoteNode(previousNode)) {
        previousNode.splice(previousNode.getChildrenSize(), 0, [
          $createLineBreakNode(),
          ...children,
        ]);
        previousNode.select(0, 0);
        parentNode.remove();
        return;
      }
    }

    const node = $createQuoteNode();
    node.append(...children);
    parentNode.replace(node);
    node.select(0, 0);
  },
  type: 'element',
};

export const CODE: ElementTransformer = {
  dependencies: [CodeNode],
  export: (node: LexicalNode) => {
    if (!$isCodeNode(node)) {
      return null;
    }
    const textContent = node.getTextContent();
    return (
      '```' +
      (node.getLanguage() || '') +
      (textContent ? '\n' + textContent : '') +
      '\n' +
      '```'
    );
  },
  regExp: /^```(\w{1,10})?\s/,
  replace: createOrUpdateBlockNode((match) => {
    return $createCodeNode(match ? match[1] : undefined);
  }),
  type: 'element',
};

export const UNORDERED_LIST: ElementTransformer = {
  dependencies: [ListNode, ListItemNode],
  export: (node, exportChildren) => {
    return $isListNode(node) ? listExport(node, exportChildren, 0) : null;
  },
  regExp: /^(\s*)[-*+]\s/,
  replace: createOrUpdateBlockNode((_match, block) => {
    if (block) {
      block.setBlockType('bulleted_list_item');
    }
    return undefined;
  }),
  type: 'element',
};

export const CHECK_LIST: ElementTransformer = {
  dependencies: [ListNode, ListItemNode],
  export: (node, exportChildren) => {
    return $isListNode(node) ? listExport(node, exportChildren, 0) : null;
  },
  regExp: /^(\s*)(?:-\s)?\s?(\[(\s|x)?\])\s/i,
  replace: createOrUpdateBlockNode((_match, block) => {
    if (block) {
      block.setBlockType('to_do');
    }
    return undefined;
  }),
  type: 'element',
};

export const ORDERED_LIST: ElementTransformer = {
  dependencies: [ListNode, ListItemNode],
  export: (node, exportChildren) => {
    return $isListNode(node) ? listExport(node, exportChildren, 0) : null;
  },
  regExp: /^(\s*)(\d{1,})\.\s/,
  replace: createOrUpdateBlockNode((_match, block) => {
    if (block) {
      block.setBlockType('numbered_list_item');
    }
    return undefined;
  }),
  type: 'element',
};

export const INLINE_CODE: TextFormatTransformer = {
  format: ['code'],
  tag: '`',
  type: 'text-format',
};

export const HIGHLIGHT: TextFormatTransformer = {
  format: ['highlight'],
  tag: '==',
  type: 'text-format',
};

export const BOLD_ITALIC_STAR: TextFormatTransformer = {
  format: ['bold', 'italic'],
  tag: '***',
  type: 'text-format',
};

export const BOLD_ITALIC_UNDERSCORE: TextFormatTransformer = {
  format: ['bold', 'italic'],
  intraword: false,
  tag: '___',
  type: 'text-format',
};

export const BOLD_STAR: TextFormatTransformer = {
  format: ['bold'],
  tag: '**',
  type: 'text-format',
};

export const BOLD_UNDERSCORE: TextFormatTransformer = {
  format: ['bold'],
  intraword: false,
  tag: '__',
  type: 'text-format',
};

export const STRIKETHROUGH: TextFormatTransformer = {
  format: ['strikethrough'],
  tag: '~~',
  type: 'text-format',
};

export const ITALIC_STAR: TextFormatTransformer = {
  format: ['italic'],
  tag: '*',
  type: 'text-format',
};

export const ITALIC_UNDERSCORE: TextFormatTransformer = {
  format: ['italic'],
  intraword: false,
  tag: '_',
  type: 'text-format',
};

// Order of text transformers matters:
//
// - code should go first as it prevents any transformations inside
// - then longer tags match (e.g. ** or __ should go before * or _)
export const LINK: TextMatchTransformer = {
  dependencies: [LinkNode],
  export: (node, exportChildren, exportFormat) => {
    if (!$isLinkNode(node)) {
      return null;
    }
    const title = node.getTitle();
    const linkContent = title
      ? `[${node.getTextContent()}](${node.getURL()} "${title}")`
      : `[${node.getTextContent()}](${node.getURL()})`;
    const firstChild = node.getFirstChild();
    // Add text styles only if link has single text node inside. If it's more
    // then one we ignore it as markdown does not support nested styles for links
    if (node.getChildrenSize() === 1 && $isTextNode(firstChild)) {
      return exportFormat(firstChild, linkContent);
    } else {
      return linkContent;
    }
  },
  importRegExp:
    /(?:\[([^[]+)\])(?:\((?:([^()\s]+)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?)\))/,
  regExp:
    /(?:\[([^[]+)\])(?:\((?:([^()\s]+)(?:\s"((?:[^"]*\\")*[^"]*)"\s*)?)\))$/,
  replace: (textNode, match) => {
    const [, linkText, linkUrl, linkTitle] = match;
    const linkNode = $createLinkNode(linkUrl, {title: linkTitle});
    const linkTextNode = $createTextNode(linkText);
    linkTextNode.setFormat(textNode.getFormat());
    linkNode.append(linkTextNode);
    textNode.replace(linkNode);
  },
  trigger: ')',
  type: 'text-match',
};
