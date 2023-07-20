/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {
  EditorConfig,
  LexicalEditor,
  ParagraphNode,
  RangeSelection,
} from 'lexical';
import invariant from 'shared/invariant';

import {LexicalNode, NodeKey} from '../LexicalNode';
import {ElementNode} from './LexicalElementNode';

const blockTypes = [
  'paragraph',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'bulleted_list_item',
  'numbered_list_item',
  'to_do',
] as const;
const blockTypeSet = new Set(blockTypes);
const defaultBlockType = 'paragraph';

export type BlockType = typeof blockTypes[number];

const isBlockType = (blockType: string): blockType is BlockType => {
  return blockTypeSet.has(blockType as BlockType);
};

export class BlockNode extends ParagraphNode {
  /** @internal */
  __blockType: BlockType;

  static getType(): string {
    return 'block';
  }

  static clone(node: BlockNode): BlockNode {
    return new BlockNode(node.__blockType, node.__key);
  }

  constructor(blockType: BlockType = defaultBlockType, key?: NodeKey) {
    super(key);
    this.__blockType = blockType;
  }

  canInsertAfter(node: LexicalNode): boolean {
    // TODO: BlockLike なものだけを許可する
    return $isBlockNode(node);
  }
  canBeEmpty(): false {
    return false;
  }
  canInsertTextBefore(): false {
    return false;
  }
  canInsertTextAfter(): false {
    return false;
  }

  getBlockType(): BlockType {
    const self = this.getLatest();
    return self.__blockType;
  }

  getChildBlocks(): LexicalNode[] {
    const nodes: LexicalNode[] = [];
    let node = this.getFirstChild();
    while (node !== null) {
      if (!$isBlockTextNode(node)) {
        nodes.push(node);
      }
      node = node.getNextSibling();
    }
    return nodes;
  }

  // Mutators

  setBlockType(blockType: BlockType): this {
    invariant(isBlockType(blockType), 'Invalid block type: %s', blockType);
    const self = this.getWritable();
    self.__blockType = blockType;
    return self;
  }

  createDOM() {
    const dom = document.createElement('div');
    dom.setAttribute('data-block-type', this.getBlockType());
    return dom;
  }
}

export function $createBlockNode(blockType: BlockType = defaultBlockType) {
  return new BlockNode(blockType);
}

export function $isBlockNode(
  node: LexicalNode | null | undefined,
): node is BlockNode {
  return node instanceof BlockNode;
}

export class BlockTextNode extends ElementNode {
  static getType(): string {
    return 'blockText';
  }

  static clone(node: BlockTextNode): BlockTextNode {
    return new BlockTextNode(node.__key);
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  canInsertAfter(node: LexicalNode): boolean {
    // TODO: BlockLike なものだけを許可する
    return $isBlockNode(node);
  }
  canBeEmpty(): true {
    return true;
  }
  canInsertTextBefore(): true {
    return true;
  }
  canInsertTextAfter(): true {
    return true;
  }

  insertAfter(nodeToInsert: LexicalNode, restoreSelection = true): LexicalNode {
    const block = this.getParentOrThrow();

    if (!$isBlockNode(block)) {
      invariant(
        false,
        'insertAfter: block node is not parent of blockText node',
      );
    }

    if ($isBlockTextNode(nodeToInsert)) {
      const newBlock = $createBlockNode(getNewBlockType(block));
      const siblings = this.getNextSiblings();
      newBlock.append(nodeToInsert, ...siblings);
      block.insertAfter(newBlock, restoreSelection);
      return newBlock;
    }

    return super.insertAfter(nodeToInsert, restoreSelection);
  }

  insertNewAfter(
    _: RangeSelection,
    restoreSelection = true,
  ): LexicalNode | null {
    const newElement = $createBlockTextNode();
    this.insertAfter(newElement, restoreSelection);
    return newElement;
  }

  insertBefore(nodeToInsert: LexicalNode): LexicalNode {
    if ($isBlockNode(nodeToInsert)) {
      const parent = this.getParentOrThrow();
      return parent.insertBefore(nodeToInsert);
    }
    if ($isBlockTextNode(nodeToInsert)) {
      const parent = this.getParentOrThrow();
      invariant($isBlockNode(parent), 'parent is not block node');
      const blockToInsert = nodeToInsert.getParentOrThrow();
      return parent.insertBefore(blockToInsert);
    }

    return super.insertBefore(nodeToInsert);
  }

  isParentRequired(): true {
    return true;
  }

  createParentElementNode(): ElementNode {
    return $createBlockNode();
  }

  createDOM(_config: EditorConfig, _editor: LexicalEditor): HTMLElement {
    return document.createElement('p');
  }
}

function getNewBlockType(block: BlockNode): BlockType {
  switch (block.__blockType) {
    case 'bulleted_list_item':
    case 'numbered_list_item':
    case 'to_do':
      return block.__blockType;
    default:
      return defaultBlockType;
  }
}

export function $createBlockTextNode() {
  return new BlockTextNode();
}

export function $isBlockTextNode(
  node: LexicalNode | null | undefined,
): node is BlockTextNode {
  return node instanceof BlockTextNode;
}
