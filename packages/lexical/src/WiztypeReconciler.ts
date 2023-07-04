/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type {LexicalEditor, MutatedNodes, NodeMutation} from './LexicalEditor';
import type {NodeKey, NodeMap} from './LexicalNode';

import {flushSync} from 'react-dom';
import invariant from 'shared/invariant';

import {FULL_RECONCILE} from './LexicalConstants';
import {EditorState} from './LexicalEditorState';
import {setMutatedNode} from './LexicalUtils';

export type ReconcilingContext = {
  setMutatedNode(nodeKey: NodeKey, type: NodeMutation): void;
  prevNodeMap: NodeMap;
  nextNodeMap: NodeMap;
  nextReadOnly: boolean;
};

type IntentionallyMarkedAsDirtyElement = boolean;

export function reconcileRoot(
  prevEditorState: EditorState,
  nextEditorState: EditorState,
  editor: LexicalEditor,
  dirtyType: 0 | 1 | 2,
  dirtyElements: Map<NodeKey, IntentionallyMarkedAsDirtyElement>,
  dirtyLeaves: Set<NodeKey>,
): MutatedNodes {
  const treatAllNodesAsDirty = dirtyType === FULL_RECONCILE;
  const prevNodeMap = prevEditorState._nodeMap;
  const nextNodeMap = nextEditorState._nodeMap;
  const nextReadOnly = nextEditorState._readOnly;

  // We keep track of mutated nodes so we can trigger mutation
  // listeners later in the update cycle.
  const mutatedNodes = new Map();

  if (treatAllNodesAsDirty || dirtyElements.size > 0 || dirtyLeaves.size > 0) {
    const _setMutatedNode = (nodeKey: NodeKey, type: NodeMutation) => {
      if (type === 'destroyed') {
        const node = prevNodeMap.get(nodeKey);
        if (node !== undefined) {
          setMutatedNode(
            mutatedNodes,
            editor._nodes,
            editor._listeners.mutation,
            node,
            'destroyed',
          );
        }
      } else {
        const node = nextNodeMap.get(nodeKey);
        if (node === undefined) {
          invariant(
            false,
            'reconcileNode: node(%s) does not exist in nodeMap by %s',
            nodeKey,
            type,
          );
        }
        setMutatedNode(
          mutatedNodes,
          editor._nodes,
          editor._listeners.mutation,
          node,
          type,
        );
      }
    };
    editor._reconcilingContext = {
      nextNodeMap,
      nextReadOnly,
      prevNodeMap,
      setMutatedNode: _setMutatedNode,
    };

    flushSync(() => {
      if (treatAllNodesAsDirty) {
        editor._keyToUpdatersMap.forEach((updaters, nodeKey) => {
          const prevNode = prevNodeMap.get(nodeKey);
          const nextNode = nextNodeMap.get(nodeKey);
          if (prevNode !== nextNode) {
            _setMutatedNode(nodeKey, 'updated');
          }
          updaters.forEach((updater) => {
            updater();
          });
        });
      } else {
        dirtyElements.forEach((_, nodeKey) => {
          const prevNode = prevNodeMap.get(nodeKey);
          const nextNode = nextNodeMap.get(nodeKey);
          if (nextNode !== undefined && prevNode !== nextNode) {
            _setMutatedNode(nodeKey, 'updated');
          }
          const updaters = editor._keyToUpdatersMap.get(nodeKey);
          if (updaters) {
            updaters.forEach((updater) => {
              updater();
            });
          }
        });
        dirtyLeaves.forEach((nodeKey) => {
          const prevNode = prevNodeMap.get(nodeKey);
          const nextNode = nextNodeMap.get(nodeKey);
          if (nextNode !== undefined && prevNode !== nextNode) {
            _setMutatedNode(nodeKey, 'updated');
          }
          const updaters = editor._keyToUpdatersMap.get(nodeKey);
          if (updaters) {
            updaters.forEach((updater) => {
              updater();
            });
          }
        });
      }
    });

    editor._reconcilingContext = null;
  }

  return mutatedNodes;
}
