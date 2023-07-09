/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {ParagraphNode, RangeSelection} from 'lexical';
import invariant from 'shared/invariant';

import {LexicalNode, NodeKey} from '../LexicalNode';
import {ElementNode} from './LexicalElementNode';

export class BlockNode extends ParagraphNode {
  /** @internal */
  __blockType: string;

  static getType(): string {
    return 'block';
  }

  static clone(node: BlockNode): BlockNode {
    return new BlockNode(node.__blockType, node.__key);
  }

  constructor(blockType: string, key?: NodeKey) {
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

  getBlockType(): string {
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

  setBlockType(blockType: string): this {
    const self = this.getLatest();
    self.__blockType = blockType;
    return self;
  }
}

export function $createBlockNode(blockType = 'paragraph') {
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
      const newBlock = $createBlockNode();
      newBlock.append(nodeToInsert);
      block.insertAfter(newBlock, restoreSelection);
      // TODO: siblings を移動させないといけないかも？
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

  isParentRequired(): true {
    return true;
  }

  createParentElementNode(): ElementNode {
    return $createBlockNode();
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
