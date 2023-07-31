/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {
  $getNearestBlockElementAncestorOrThrow,
  mergeRegister,
} from '@lexical/utils';
import {
  $getNodeByKey,
  $isBlockTextNode,
  BlockTextNode,
  LexicalEditor,
  NodeKey,
  TextNode,
} from 'lexical';
import * as React from 'react';
import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useContext,
  useLayoutEffect,
  useState,
} from 'react';
import invariant from 'shared/invariant';

export function useSearchHighlight(editor: LexicalEditor, search: string) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [, setHighlights] = useHighlightsContext();

  useLayoutEffect(() => {
    if (search === '') return;
    const unregister = registerSearchHighlight(editor, search, (updates) => {
      setHighlights((prev) => {
        const next = new Map(prev);
        for (const [key, ranges] of updates) {
          next.set(key, ranges);
        }
        return next;
      });
    });
    return () => {
      unregister();
      setHighlights(new Map());
    };
  }, [editor, search, setHighlights]);
}

// TODO: registerBlockTextEntity としてまとめられそう
function registerSearchHighlight(
  editor: LexicalEditor,
  search: string,
  callback: (updates: Map<NodeKey, HighlightRange[]>) => void,
) {
  const changeBlockTextIds = new Set<string>();

  const blockTextTransform = (node: BlockTextNode) => {
    const blockTextKey = node.getKey();
    changeBlockTextIds.add(blockTextKey);
  };

  const textNodeTransform = (node: TextNode) => {
    // Find parent block text node
    const blockText = $getNearestBlockElementAncestorOrThrow(node);
    if ($isBlockTextNode(blockText)) {
      blockTextTransform(blockText);
    }
  };

  return mergeRegister(
    editor.registerNodeTransform(TextNode, textNodeTransform),
    editor.registerNodeTransform(BlockTextNode, blockTextTransform),
    editor.registerUpdateListener(({editorState}) => {
      if (changeBlockTextIds.size === 0) return;

      editorState.read(() => {
        const updates = new Map<NodeKey, HighlightRange[]>();
        for (const blockTextId of changeBlockTextIds) {
          const blockText = $getNodeByKey(blockTextId);
          if ($isBlockTextNode(blockText)) {
            // マッチしているかどうかの判断
            const matches = blockText
              .getTextContent()
              .matchAll(new RegExp(search, 'g'));
            if (matches) {
              const ranges: HighlightRange[] = [];
              for (const match of matches) {
                ranges.push({
                  attrs: {
                    name: 'search',
                  },
                  end: (match.index ?? 0) + match[0].length,
                  start: match.index ?? 0,
                });
              }
              updates.set(blockTextId, ranges);
            } else {
              updates.set(blockTextId, []);
            }
          }
        }
        callback(updates);
      });

      changeBlockTextIds.clear();
    }),
  );
}

type HighlightRange = {
  start: number;
  end: number;
  attrs: {
    name: string;
    priority?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
};

type HighlightsContextValue = Map<NodeKey, HighlightRange[]>;

const HighlightsContext = createContext<
  | [HighlightsContextValue, Dispatch<SetStateAction<HighlightsContextValue>>]
  | null
>(null);

function useHighlightsContext() {
  const context = useContext(HighlightsContext);
  if (!context) {
    invariant(
      false,
      'useHighlightsContext must be used within a HighlightsProvider',
    );
  }
  return context;
}

const emptyHighlights: HighlightRange[] = [];
export function useBlockTextHighlights(nodeKey: NodeKey): HighlightRange[] {
  const [highlights] = useHighlightsContext();
  return highlights.get(nodeKey) || emptyHighlights;
}

export function HighlightsContextProvider(props: {children: ReactNode}) {
  const highlightsStates = useState<HighlightsContextValue>(() => new Map());

  return (
    <HighlightsContext.Provider value={highlightsStates}>
      {props.children}
    </HighlightsContext.Provider>
  );
}
