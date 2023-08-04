/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {mergeRegister} from '@lexical/utils';
import {
  $getRoot,
  $isBlockTextNode,
  $isElementNode,
  BlockTextNode,
  LexicalEditor,
  LexicalNode,
  NodeKey,
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

function registerSearchHighlight(
  editor: LexicalEditor,
  search: string,
  callback: (updates: Map<NodeKey, HighlightRange[]>) => void,
) {
  editor.getEditorState().read(() => {
    const root = $getRoot();
    const blockTextNodes = getAllBlockTextNodes(root);
    const highlightsMap = new Map<NodeKey, HighlightRange[]>();
    for (const blockText of blockTextNodes) {
      const blockTextKey = blockText.getKey();
      const matches = blockText
        .getTextContent()
        .matchAll(new RegExp(search, 'g'));
      const highlights: HighlightRange[] = [];
      for (const match of matches) {
        const start = match.index ?? 0;
        const end = start + match[0].length;
        // const domRange = createDOMRange(editor, blockTextKey, start, end);
        const text = match[0];
        highlights.push({
          blockTextKey,
          end,
          inclusiveEnd: false,
          inclusiveStart: false,
          initialText: text,
          invalidateOnTextChange: true,
          start,
          text,
        });
      }
      if (highlights.length > 0) {
        highlightsMap.set(blockTextKey, highlights);
      }
    }
    callback(highlightsMap);
  });

  return mergeRegister(
    editor.registerUpdateListener(({editorState}) => {
      // console.log('handle transform highlights', editorState);
    }),
  );
}

function getAllBlockTextNodes(node: LexicalNode): BlockTextNode[] {
  if ($isBlockTextNode(node)) {
    return [node];
  }
  if ($isElementNode(node)) {
    return node.getChildren().flatMap(getAllBlockTextNodes);
  }

  return [];
}

export type HighlightRange = {
  blockTextKey: NodeKey;
  start: number;
  end: number;
  text: string;
  initialText: string;
  invalidateOnTextChange: boolean;
  inclusiveStart: boolean;
  inclusiveEnd: boolean;
};

type HighlightsContextValue = Map<NodeKey, HighlightRange[]>;

const HighlightsContext = createContext<
  | [HighlightsContextValue, Dispatch<SetStateAction<HighlightsContextValue>>]
  | null
>(null);

export function useHighlightsContext() {
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
