/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {
  $getNearestBlockElementAncestorOrThrow,
  mergeRegister,
} from '@lexical/utils';
import {
  $getNodeByKey,
  $isBlockTextNode,
  BlockTextNode,
  COMMAND_PRIORITY_EDITOR,
  KEY_MODIFIER_COMMAND,
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
import {IS_APPLE} from 'shared/environment';
import invariant from 'shared/invariant';

function useSearchHighlight(editor: LexicalEditor, search: string) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [, setHighlights] = useHighlightsContext();

  useLayoutEffect(() => {
    if (search === '') return;
    return registerSearchHighlight(editor, search, (updates) => {
      setHighlights((prev) => {
        const next = new Map(prev);
        for (const [key, ranges] of updates) {
          next.set(key, ranges);
        }
        return next;
      });
    });
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

function HighlightsContextProvider(props: {children: ReactNode}) {
  const highlightsStates = useState<HighlightsContextValue>(() => new Map());

  return (
    <HighlightsContext.Provider value={highlightsStates}>
      {props.children}
    </HighlightsContext.Provider>
  );
}

export function WiztypeContextProvider(props: {children: ReactNode}) {
  return (
    <HighlightsContextProvider>{props.children}</HighlightsContextProvider>
  );
}

function useWiztype(editor: LexicalEditor) {
  const [search, setSearch] = useState<string>('');

  useSearchHighlight(editor, search);

  useLayoutEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        KEY_MODIFIER_COMMAND,
        (event) => {
          const {code, ctrlKey, metaKey} = event;
          if (code === 'KeyF' && (IS_APPLE ? metaKey : ctrlKey)) {
            event.preventDefault();
            setSearch((currentSearch) => {
              return currentSearch ? '' : 'aaa';
            });
          }
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, [editor]);
}

export default function WiztypePlugin() {
  const [editor] = useLexicalComposerContext();

  useWiztype(editor);

  return null;
}
