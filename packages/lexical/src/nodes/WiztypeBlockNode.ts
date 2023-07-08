/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  ParagraphNode,
  TextNode,
} from 'lexical';
import invariant from 'shared/invariant';

import {LexicalNode, NodeKey} from '../LexicalNode';
import {moveSelectionPointToSibling, PointType} from '../LexicalSelection';
import {$isRootOrShadowRoot, removeFromParent} from '../LexicalUtils';
import {ElementNode} from './LexicalElementNode';

export class BlockNode extends ParagraphNode {
  /** @internal */
  __blockType: string;
  /** @internal */
  __firstBlock: null | NodeKey;
  /** @internal */
  __lastBlock: null | NodeKey;
  /** @internal */
  __blocksSize: number;

  constructor(blockType: string, key?: NodeKey) {
    super(key);
    this.__blockType = blockType;
    this.__firstBlock = null;
    this.__lastBlock = null;
    this.__blocksSize = 0;
  }

  static getType(): string {
    return 'block';
  }

  static clone(node: BlockNode): ParagraphNode {
    return new BlockNode(node.__blockType, node.__key);
  }

  getChildBlocks<T extends ElementNode>(): Array<T> {
    const children: Array<T> = [];
    let child: T | null = this.getFirstChildBlock();
    while (child !== null) {
      children.push(child);
      child = child.getNextSibling();
    }
    return children;
  }
  getChildBlockKeys(): Array<NodeKey> {
    const children: Array<NodeKey> = [];
    let child: LexicalNode | null = this.getFirstChildBlock();
    while (child !== null) {
      children.push(child.__key);
      child = child.getNextSibling();
    }
    return children;
  }
  getChildBlocksSize(): number {
    const self = this.getLatest();
    return self.__blocksSize;
  }
  hasNoChildBlocks(): boolean {
    return this.getChildBlocksSize() === 0;
  }
  isEmpty(): boolean {
    return super.isEmpty() && this.hasNoChildBlocks();
  }

  getFirstChildBlock<T extends ElementNode>(): null | T {
    const self = this.getLatest();
    const firstKey = self.__firstBlock;
    return firstKey === null ? null : $getNodeByKey<T>(firstKey);
  }
  getFirstChildBlockOrThrow<T extends ElementNode>(): T {
    const firstChildBlock = this.getFirstChildBlock<T>();
    if (firstChildBlock == null) {
      invariant(
        false,
        'Expected node %s to have a first child block.',
        this.__key,
      );
    }
    return firstChildBlock;
  }
  getLastChildBlock<T extends ElementNode>(): null | T {
    const self = this.getLatest();
    const lastKey = self.__lastBlock;
    return lastKey === null ? null : $getNodeByKey<T>(lastKey);
  }
  getLastChildBlockOrThrow<T extends ElementNode>(): T {
    const lastChildBlock = this.getLastChildBlock<T>();
    if (lastChildBlock == null) {
      invariant(
        false,
        'Expected node %s to have a last child block.',
        this.__key,
      );
    }
    return lastChildBlock;
  }
  getChildBlockAtIndex<T extends ElementNode>(index: number): null | T {
    const size = this.getChildBlocksSize();
    let node: null | T;
    let i;
    if (index < size / 2) {
      node = this.getFirstChildBlock<T>();
      i = 0;
      while (node !== null && i <= index) {
        if (i === index) {
          return node;
        }
        node = node.getNextSibling();
        i++;
      }
      return null;
    }
    node = this.getLastChildBlock<T>();
    i = size - 1;
    while (node !== null && i >= index) {
      if (i === index) {
        return node;
      }
      node = node.getPreviousSibling();
      i--;
    }
    return null;
  }
  getBlockType(): string {
    const self = this.getLatest();
    return self.__blockType;
  }

  // Mutators

  setBlockType(blockType: string): this {
    const self = this.getLatest();
    self.__blockType = blockType;
    return self;
  }

  spliceChildBlocks(
    start: number,
    deleteCount: number,
    nodesToInsert: Array<LexicalNode>,
  ): this {
    const nodesToInsertLength = nodesToInsert.length;
    const oldSize = this.getChildBlocksSize();
    const writableSelf = this.getWritable();
    const writableSelfKey = writableSelf.__key;
    const nodesToInsertKeys = [];
    const nodesToRemoveKeys = [];
    const nodeAfterRange = this.getChildBlockAtIndex(start + deleteCount);
    let nodeBeforeRange = null;
    let newSize = oldSize - deleteCount + nodesToInsertLength;

    if (start !== 0) {
      if (start === oldSize) {
        nodeBeforeRange = this.getLastChildBlock();
      } else {
        const node = this.getChildBlockAtIndex(start);
        if (node !== null) {
          nodeBeforeRange = node.getPreviousSibling();
        }
      }
    }

    if (deleteCount > 0) {
      let nodeToDelete =
        nodeBeforeRange === null
          ? this.getFirstBlockChild()
          : nodeBeforeRange.getNextSibling();
      for (let i = 0; i < deleteCount; i++) {
        if (nodeToDelete === null) {
          invariant(false, 'splice: sibling not found');
        }
        const nextSibling = nodeToDelete.getNextSibling();
        const nodeKeyToDelete = nodeToDelete.__key;
        const writableNodeToDelete = nodeToDelete.getWritable();
        removeFromParent(writableNodeToDelete);
        nodesToRemoveKeys.push(nodeKeyToDelete);
        nodeToDelete = nextSibling;
      }
    }

    let prevNode = nodeBeforeRange;
    for (let i = 0; i < nodesToInsertLength; i++) {
      const nodeToInsert = nodesToInsert[i];
      if (prevNode !== null && nodeToInsert.is(prevNode)) {
        nodeBeforeRange = prevNode = prevNode.getPreviousSibling();
      }
      const writableNodeToInsert = nodeToInsert.getWritable();
      if (writableNodeToInsert.__parent === writableSelfKey) {
        newSize--;
      }
      removeFromParent(writableNodeToInsert);
      const nodeKeyToInsert = nodeToInsert.__key;
      if (prevNode === null) {
        writableSelf.__firstBlock = nodeKeyToInsert;
        writableNodeToInsert.__prev = null;
      } else {
        const writablePrevNode = prevNode.getWritable();
        writablePrevNode.__nextBlock = nodeKeyToInsert;
        writableNodeToInsert.__prev = writablePrevNode.__key;
      }
      if (nodeToInsert.__key === writableSelfKey) {
        invariant(false, 'append: attempting to append self');
      }
      // Set child parent to self
      writableNodeToInsert.__parent = writableSelfKey;
      nodesToInsertKeys.push(nodeKeyToInsert);
      prevNode = nodeToInsert;
    }

    if (start + deleteCount === oldSize) {
      if (prevNode !== null) {
        const writablePrevNode = prevNode.getWritable();
        writablePrevNode.__next = null;
        writableSelf.__lastBlock = prevNode.__key;
      }
    } else if (nodeAfterRange !== null) {
      const writableNodeAfterRange = nodeAfterRange.getWritable();
      if (prevNode !== null) {
        const writablePrevNode = prevNode.getWritable();
        writableNodeAfterRange.__prev = prevNode.__key;
        writablePrevNode.__next = nodeAfterRange.__key;
      } else {
        writableNodeAfterRange.__prev = null;
      }
    }

    writableSelf.__blocksSize = newSize;

    // In case of deletion we need to adjust selection, unlink removed nodes
    // and clean up node itself if it becomes empty. None of these needed
    // for insertion-only cases
    if (nodesToRemoveKeys.length) {
      // Adjusting selection, in case node that was anchor/focus will be deleted
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const nodesToRemoveKeySet = new Set(nodesToRemoveKeys);
        const nodesToInsertKeySet = new Set(nodesToInsertKeys);

        const {anchor, focus} = selection;
        if (isPointRemoved(anchor, nodesToRemoveKeySet, nodesToInsertKeySet)) {
          moveSelectionPointToSibling(
            anchor,
            anchor.getNode(),
            this,
            nodeBeforeRange,
            nodeAfterRange,
          );
        }
        if (isPointRemoved(focus, nodesToRemoveKeySet, nodesToInsertKeySet)) {
          moveSelectionPointToSibling(
            focus,
            focus.getNode(),
            this,
            nodeBeforeRange,
            nodeAfterRange,
          );
        }
        // Cleanup if node can't be empty
        if (newSize === 0 && !this.canBeEmpty() && !$isRootOrShadowRoot(this)) {
          this.remove();
        }
      }
    }

    return writableSelf;
  }
}

export function $createBlockNode(blockType: string) {
  return new BlockNode(blockType);
}

export function $isBlockNode(
  node: LexicalNode | null | undefined,
): node is BlockNode {
  return node instanceof BlockNode;
}

function isPointRemoved(
  point: PointType,
  nodesToRemoveKeySet: Set<NodeKey>,
  nodesToInsertKeySet: Set<NodeKey>,
): boolean {
  let node: ElementNode | TextNode | null = point.getNode();
  while (node) {
    const nodeKey = node.__key;
    if (nodesToRemoveKeySet.has(nodeKey) && !nodesToInsertKeySet.has(nodeKey)) {
      return true;
    }
    node = node.getParent();
  }
  return false;
}
