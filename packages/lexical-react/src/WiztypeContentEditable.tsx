/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {mergeRegister} from '@lexical/utils';
import {
  $getNodeByKey,
  $isElementNode,
  $isTextNode,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  ParagraphNode,
  RootNode,
  TextNode,
} from 'lexical';
import * as React from 'react';
import {memo, useCallback, useMemo, useRef, useState} from 'react';
import useLayoutEffect from 'shared/useLayoutEffect';

export type Props = {
  ariaActiveDescendant?: React.AriaAttributes['aria-activedescendant'];
  ariaAutoComplete?: React.AriaAttributes['aria-autocomplete'];
  ariaControls?: React.AriaAttributes['aria-controls'];
  ariaDescribedBy?: React.AriaAttributes['aria-describedby'];
  ariaExpanded?: React.AriaAttributes['aria-expanded'];
  ariaLabel?: React.AriaAttributes['aria-label'];
  ariaLabelledBy?: React.AriaAttributes['aria-labelledby'];
  ariaMultiline?: React.AriaAttributes['aria-multiline'];
  ariaOwns?: React.AriaAttributes['aria-owns'];
  ariaRequired?: React.AriaAttributes['aria-required'];
  autoCapitalize?: HTMLDivElement['autocapitalize'];
  'data-testid'?: string | null | undefined;
} & React.AllHTMLAttributes<HTMLDivElement>;

export function WiztypeContentEditable({
  ariaActiveDescendant,
  ariaAutoComplete,
  ariaControls,
  ariaDescribedBy,
  ariaExpanded,
  ariaLabel,
  ariaLabelledBy,
  ariaMultiline,
  ariaOwns,
  ariaRequired,
  autoCapitalize,
  className,
  id,
  role = 'textbox',
  spellCheck = true,
  style,
  tabIndex,
  'data-testid': testid,
  ...rest
}: Props): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [isEditable, setEditable] = useState(false);

  const ref = useCallback(
    (rootElement: null | HTMLElement) => {
      editor.setRootElement(rootElement);
    },
    [editor],
  );

  useLayoutEffect(() => {
    setEditable(editor.isEditable());
    return editor.registerEditableListener((currentIsEditable) => {
      setEditable(currentIsEditable);
    });
  }, [editor]);

  useDebugMutations(editor);

  return (
    <div
      {...rest}
      aria-activedescendant={!isEditable ? undefined : ariaActiveDescendant}
      aria-autocomplete={!isEditable ? 'none' : ariaAutoComplete}
      aria-controls={!isEditable ? undefined : ariaControls}
      aria-describedby={ariaDescribedBy}
      aria-expanded={
        !isEditable
          ? undefined
          : role === 'combobox'
          ? !!ariaExpanded
          : undefined
      }
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-multiline={ariaMultiline}
      aria-owns={!isEditable ? undefined : ariaOwns}
      aria-readonly={!isEditable ? true : undefined}
      aria-required={ariaRequired}
      autoCapitalize={autoCapitalize}
      className={className}
      contentEditable={isEditable}
      data-testid={testid}
      id={id}
      ref={ref}
      role={role}
      spellCheck={spellCheck}
      style={style}
      tabIndex={tabIndex}
      suppressContentEditableWarning={true}>
      <RootComponent />
    </div>
  );
}

function useDebugMutations(editor: LexicalEditor) {
  useLayoutEffect(() => {
    return mergeRegister(
      editor.registerMutationListener(RootNode, (mutations) => {
        // eslint-disable-next-line no-console
        console.log('RootNode mutations', mutations);
      }),
      editor.registerMutationListener(ParagraphNode, (mutations) => {
        // eslint-disable-next-line no-console
        console.log('ParagraphNode mutations', mutations);
      }),
      editor.registerMutationListener(TextNode, (mutations) => {
        // eslint-disable-next-line no-console
        console.log('TextNode mutations', mutations);
      }),
    );
  }, [editor]);
}

function useEditor() {
  const [editor] = useLexicalComposerContext();
  return editor;
}

function getNodeType(node: LexicalNode): 'element' | 'inline-element' | 'text' {
  if ($isElementNode(node)) {
    return node.isInline() ? 'inline-element' : 'element';
  }
  if ($isTextNode(node)) {
    return 'text';
  }
  throw new Error('Unknown node type');
}

function RootComponent() {
  const editor = useEditor();
  const updateKey = useNodeReconcile(editor, 'root');

  const children = useMemo(() => {
    void updateKey;
    return editor.getEditorState().read(() => {
      const parent = $getNodeByKey('root');
      if (!$isElementNode(parent)) return [];
      return parent.getChildren().map((child) => {
        return {
          key: child.getKey(),
          type: getNodeType(child),
        };
      });
    });
  }, [editor, updateKey]);

  return (
    <>
      {children.map((child) => {
        if (child.type === 'element') {
          return <ElementComponent key={child.key} nodeKey={child.key} />;
        }
        if (child.type === 'inline-element') {
          return (
            <ElementComponent
              key={child.key}
              nodeKey={child.key}
              isInline={true}
            />
          );
        }

        throw new Error('Cannot render text as React');
      })}
    </>
  );
}

const ElementComponent = memo(function ElementComponentBase(props: {
  nodeKey: string;
  isInline?: boolean;
}) {
  const {nodeKey} = props;
  const editor = useEditor();

  const updateKey = useNodeReconcile(editor, nodeKey);

  const data = useMemo(() => {
    void updateKey;
    return editor.getEditorState().read(() => {
      const element = $getNodeByKey(nodeKey);
      if (!$isElementNode(element)) return null;
      return {
        tag: 'p',
      };
    });
  }, [editor, nodeKey, updateKey]);

  const _setRef = useNodeDOMSetter(editor, nodeKey);
  const ref = useRef<HTMLElement | null>(null);
  const setRef = useCallback(
    (elem: HTMLElement | null) => {
      _setRef(elem);
      ref.current = elem;
    },
    [_setRef],
  );

  if (!data) return null;

  const Tag = data.tag as 'div';

  return <Tag ref={setRef} className={'PlaygroundEditorTheme__paragraph'} />;
});

function useNodeDOMSetter(editor: LexicalEditor, nodeKey: string) {
  const setBlockKeyToDOM = useCallback(
    (elem: HTMLElement | null) => {
      if (elem) {
        editor._keyToDOMMap.set(nodeKey, elem);
        // @ts-expect-error
        elem[`__lexicalKey_${editor.getKey()}`] = nodeKey;
      } else {
        editor._keyToDOMMap.delete(nodeKey);
      }
    },
    [editor, nodeKey],
  );

  return setBlockKeyToDOM;
}

function useNodeReconcile(editor: LexicalEditor, nodeKey: NodeKey) {
  const isRoot = nodeKey === 'root';
  const [updateKey, setUpdateKey] = useState(0);

  useLayoutEffect(() => {
    const handler = () => {
      setUpdateKey((key) => {
        return key + 1;
      });
    };
    let set = editor._keyToUpdatersMap.get(nodeKey);
    if (!set) {
      set = new Set();
      editor._keyToUpdatersMap.set(nodeKey, set);
    }
    set.add(handler);

    return () => {
      if (set) {
        set.delete(handler);
        if (set.size === 0) {
          editor._keyToUpdatersMap.delete(nodeKey);
        }
      }
    };
  }, [editor, nodeKey]);

  useLayoutEffect(() => {
    void updateKey;
    if (editor._reconcilingContext) {
      const prevNode = editor._reconcilingContext.prevNodeMap.get(nodeKey);
      const nextNode = editor._reconcilingContext.nextNodeMap.get(nodeKey);
      // Except created and destroyed mutations
      if (
        prevNode !== undefined &&
        nextNode !== undefined &&
        prevNode !== nextNode
      ) {
        editor._reconcilingContext.setMutatedNode(nodeKey, 'updated');
      }

      if (!isRoot) {
        const dom = editor._keyToDOMMap.get(nodeKey);
        if (
          dom &&
          !editor._reconcilingContext.alreadyMutatedNodes.has(nodeKey)
        ) {
          editor._reconcilingContext.alreadyMutatedNodes.add(nodeKey);
          editor._reconcilingContext.reconcileChildren(nodeKey, dom);
        }
      }
    }
  }, [editor, isRoot, nodeKey, updateKey]);

  // Register created and destroyed mutations
  useLayoutEffect(() => {
    if (isRoot) return;
    if (editor._reconcilingContext) {
      editor._reconcilingContext.setMutatedNode(nodeKey, 'created');
    }
    return () => {
      if (editor._reconcilingContext) {
        editor._reconcilingContext.setMutatedNode(nodeKey, 'destroyed');
        // Call reconcileChildren to remove all children
        const dom = editor._keyToDOMMap.get(nodeKey);
        if (
          dom &&
          !editor._reconcilingContext.alreadyMutatedNodes.has(nodeKey)
        ) {
          editor._reconcilingContext.alreadyMutatedNodes.add(nodeKey);
          editor._reconcilingContext.reconcileChildren(nodeKey, dom);
        }
      }
    };
  }, [editor, isRoot, nodeKey]);

  return updateKey;
}
