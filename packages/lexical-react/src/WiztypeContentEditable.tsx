/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {
  $getNodeByKey,
  $isElementNode,
  $isTextNode,
  LexicalEditor,
  LexicalNode,
  NodeKey,
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
      <ChildrenComponent parentKey="root" />
    </div>
  );
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

function ChildrenComponent({parentKey}: {parentKey: string}) {
  const editor = useEditor();
  const updateKey = useNodeUpdate(editor, parentKey);

  const children = useMemo(() => {
    void updateKey;
    return editor.getEditorState().read(() => {
      const parent = $getNodeByKey(parentKey);
      if (!$isElementNode(parent)) return [];
      return parent.getChildren().map((child) => {
        return {
          key: child.getKey(),
          type: getNodeType(child),
        };
      });
    });
  }, [editor, parentKey, updateKey]);

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

        return <TextComponent key={child.key} nodeKey={child.key} />;
      })}
    </>
  );
}

function TextComponent({nodeKey}: {nodeKey: string}) {
  const editor = useEditor();
  const setRef = useNodeDOMSetter(editor, nodeKey);
  const updateKey = useNodeUpdate(editor, nodeKey);
  useNodeReconcileMutation(editor, nodeKey);

  const data = useMemo(() => {
    void updateKey;
    return editor.getEditorState().read(() => {
      const node = $getNodeByKey(nodeKey);
      if (!$isTextNode(node)) return null;
      return {
        innerTag: node.getInnerTag(),
        outerTag: node.getOuterTag(),
        style: node.getStyle(),
        text: node.getTextContent(),
      };
    });
  }, [editor, nodeKey, updateKey]);

  const text = data ? data.text : '';
  const [initialText] = useState(data ? data.text : '');

  const textRef = useRef<HTMLElement | null>(null);
  const style = data ? data.style : undefined;
  const setRefWithStyle = useCallback(
    (elem: HTMLElement | null) => {
      textRef.current = elem;
      setRef(elem);
      if (elem) {
        elem.style.cssText = style || '';
      }
    },
    [style, setRef],
  );

  useLayoutEffect(() => {
    if (!textRef.current) return;
    if (textRef.current.textContent === text) return;
    textRef.current.textContent = text;
  }, [text]);

  if (!data) return null;

  const Outer = data.outerTag as 'span' | null;
  const Inner = data.innerTag as 'span';

  if (Outer) {
    return (
      <Outer data-lexical-text={true} ref={setRefWithStyle}>
        <Inner>{initialText}</Inner>
      </Outer>
    );
  }
  return (
    <Inner data-lexical-text={true} ref={setRefWithStyle}>
      {initialText}
    </Inner>
  );
}

const ElementComponent = memo(function ElementComponentBase(props: {
  nodeKey: string;
  isInline?: boolean;
}) {
  const {nodeKey} = props;
  const editor = useEditor();

  useNodeReconcileMutation(editor, nodeKey);
  const updateKey = useNodeUpdate(editor, nodeKey);

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

  const setRef = useNodeDOMSetter(editor, nodeKey);

  if (!data) return null;

  const Tag = data.tag as 'div';

  return (
    <Tag ref={setRef} data-key={nodeKey}>
      <ChildrenComponent parentKey={nodeKey} />
    </Tag>
  );
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

function useNodeUpdate(editor: LexicalEditor, nodeKey: NodeKey) {
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

  return updateKey;
}

function useNodeReconcileMutation(editor: LexicalEditor, nodeKey: NodeKey) {
  // Register created and destroyed mutations
  useLayoutEffect(() => {
    if (editor._reconcilingContext) {
      editor._reconcilingContext.setMutatedNode(nodeKey, 'created');
    }
    return () => {
      if (editor._reconcilingContext) {
        editor._reconcilingContext.setMutatedNode(nodeKey, 'destroyed');
      }
    };
  }, [editor, nodeKey]);
}
