/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {$findMatchingParent, mergeRegister} from '@lexical/utils';
import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isBlockNode,
  $isBlockTextNode,
  $isElementNode,
  $isRangeSelection,
  $isRootNode,
  $isTextNode,
  BlockNode,
  BlockTextNode,
  BlockType,
  COMMAND_PRIORITY_EDITOR,
  ElementNode,
  INDENT_CONTENT_COMMAND,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  OUTDENT_CONTENT_COMMAND,
  ParagraphNode,
  RootNode,
  TextNode,
} from 'lexical';
import * as React from 'react';
import {memo, useCallback, useInsertionEffect, useMemo, useState} from 'react';
import invariant from 'shared/invariant';
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

  useBlockSetup(editor);

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
      editor.registerMutationListener(BlockNode, (mutations) => {
        // eslint-disable-next-line no-console
        console.log('BlockNode mutations', mutations);
      }),
      editor.registerMutationListener(TextNode, (mutations) => {
        // eslint-disable-next-line no-console
        console.log('TextNode mutations', mutations);
      }),
    );
  }, [editor]);
}

function $getNearestBlockAncestorOrThrow(startNode: LexicalNode): BlockNode {
  const blockNode = $findMatchingParent(
    startNode,
    (node) => $isBlockNode(node) && !node.isInline(),
  );
  if (!$isBlockNode(blockNode)) {
    invariant(
      false,
      'Expected node %s to have closest block node.',
      startNode.__key,
    );
  }
  return blockNode;
}

function $getBlockParent(startNode: LexicalNode): ElementNode {
  const blockNode = $findMatchingParent(
    startNode,
    (node) => node.__key !== startNode.__key && $isBlockNode(node),
  );
  if (blockNode === null) return $getRoot();
  if (!$isElementNode(blockNode)) {
    invariant(false, 'Expected node %s to have parent block', startNode.__key);
  }
  return blockNode;
}

function handleIndentAndOutdent(
  indentOrOutdent: (block: ElementNode) => void,
): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return false;
  }
  const alreadyHandled = new Set();
  const nodes = selection.getNodes();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const key = node.getKey();
    if (alreadyHandled.has(key)) {
      continue;
    }
    const parentBlock = $getNearestBlockAncestorOrThrow(node);
    const parentKey = parentBlock.getKey();
    if (parentBlock.canIndent() && !alreadyHandled.has(parentKey)) {
      alreadyHandled.add(parentKey);
      indentOrOutdent(parentBlock);
    }
  }
  return alreadyHandled.size > 0;
}

function useBlockSetup(editor: LexicalEditor) {
  useLayoutEffect(() => {
    return registerBlock(editor);
  }, [editor]);
}

function registerBlock(editor: LexicalEditor) {
  return mergeRegister(
    // Block から BlockText が削除されたら、子要素を前の Block に移動する
    editor.registerNodeTransform(BlockNode, (blockNode) => {
      const firstChild = blockNode.getFirstChild();
      if (firstChild && !$isBlockTextNode(firstChild)) {
        const children = blockNode.getChildren();
        const prevBlock = blockNode.getPreviousSibling();
        if ($isBlockNode(prevBlock)) {
          prevBlock.append(...children);
          blockNode.remove();
        } else if ($isElementNode(prevBlock)) {
          const index = blockNode.getIndexWithinParent();
          const parent = blockNode.getParentOrThrow();
          parent.splice(index, 1, children);
        }
      }
    }),
    editor.registerCommand(
      INDENT_CONTENT_COMMAND,
      () => {
        return handleIndentAndOutdent((node) => {
          const prevBlock = node.getPreviousSibling();
          if (!$isBlockNode(prevBlock)) return;
          const childBlocks = node.getChildBlocks();
          prevBlock.append(node, ...childBlocks);
        });
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      OUTDENT_CONTENT_COMMAND,
      () => {
        return handleIndentAndOutdent((node) => {
          const parentBlock = $getBlockParent(node);
          if ($isRootNode(parentBlock)) return;
          const siblings = node.getNextSiblings();
          if (siblings.length > 0) {
            node.append(...siblings);
          }
          parentBlock.insertAfter(node);
        });
      },
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}

function useEditor() {
  const [editor] = useLexicalComposerContext();
  return editor;
}

function getNodeType(
  node: LexicalNode,
): 'element' | 'inline-element' | 'text' | 'block' {
  if ($isBlockNode(node)) {
    return 'block';
  }
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
  const updateKey = useNodeReconcile(editor, 'root', false);

  const cid = useComponentId();
  useLock(editor, cid);

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
        if (child.type === 'block') {
          return <BlockComponent key={child.key} nodeKey={child.key} />;
        }
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

const BlockComponent = memo(function BlockComponentBase(props: {
  nodeKey: string;
}) {
  const {nodeKey} = props;
  const editor = useEditor();

  const updateKey = useNodeReconcile(editor, nodeKey, false);
  const setRef = useNodeDOMSetter(editor, nodeKey);

  const blockType = useMemo(() => {
    void updateKey;
    return editor.getEditorState().read(() => {
      const block = $getNodeByKey(nodeKey);
      if ($isBlockNode(block)) return block.getBlockType();
    });
  }, [editor, nodeKey, updateKey]);

  const [textNode, ...restBlocks] = useMemo<
    [BlockTextNode | null, ...LexicalNode[]]
  >(() => {
    void updateKey;
    return editor.getEditorState().read(() => {
      const block = $getNodeByKey(nodeKey);
      if (!$isBlockNode(block)) return [null];
      const firstChild = block.getFirstChild();
      const childBlocks = block.getChildBlocks();
      if ($isBlockTextNode(firstChild)) {
        return [firstChild, ...childBlocks];
      }
      return [null, ...childBlocks];
    });
  }, [editor, nodeKey, updateKey]);

  const cid = useComponentId();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_hovered, setHovered] = useState(false);
  useLock(editor, cid);

  const prefix = (() => {
    if (blockType === 'bulleted_list_item') {
      return '・';
    }
    if (blockType === 'numbered_list_item') {
      return '1.';
    }
    if (blockType === 'to_do') {
      return '[]';
    }
    return null;
  })();

  return (
    <div ref={setRef} data-block={nodeKey}>
      <div
        style={{display: 'flex'}}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}>
        <div
          contentEditable={false}
          style={{
            userSelect: 'none',
            width: '1em',
          }}>
          {<div>{prefix ? prefix : ''}</div>}
        </div>
        <div style={{minWidth: '1em'}}>
          {textNode && blockType && (
            <BlockTextComponent
              key={`${textNode.__key}__${blockType}`}
              nodeKey={textNode.__key}
              blockType={blockType}
            />
          )}
        </div>
      </div>
      {restBlocks.length > 0 && (
        <div style={{marginLeft: '18px'}}>
          {restBlocks.map((block) => {
            return <BlockComponent key={block.__key} nodeKey={block.__key} />;
          })}
        </div>
      )}
    </div>
  );
});

const BlockTextComponent = memo(function BlockTextComponentBase(props: {
  nodeKey: string;
  blockType: BlockType;
}) {
  const {nodeKey} = props;
  const editor = useEditor();

  const updateKey = useNodeReconcile(editor, nodeKey, true);

  const data = useMemo(() => {
    void updateKey;
    return editor.getEditorState().read(() => {
      const element = $getNodeByKey(nodeKey);
      if (!$isBlockTextNode(element)) return null;
      return {
        tag: 'p',
      };
    });
  }, [editor, nodeKey, updateKey]);

  const setRef = useNodeDOMSetter(editor, nodeKey);

  if (!data) return null;

  // TODO: Use dynamic tag
  const Tag = blockTypeToTag(props.blockType);

  return <Tag ref={setRef} className={'PlaygroundEditorTheme__paragraph'} />;
});

function blockTypeToTag(blockType: BlockType) {
  switch (blockType) {
    case 'paragraph':
      return 'p';
    case 'h1':
      return 'h1';
    case 'h2':
      return 'h2';
    case 'h3':
      return 'h3';
    // case 'heading-four':
    //   return 'h4';
    // case 'heading-five':
    //   return 'h5';
    // case 'heading-six':
    //   return 'h6';
    // case 'code-block':
    //   return 'pre';
    // case 'blockquote':
    //   return 'blockquote';
    // case 'unordered-list':
    //   return 'ul';
    // case 'ordered-list':
    //   return 'ol';
    // case 'list-item':
    // return 'li';
    default:
      return 'div';
  }
}

const ElementComponent = memo(function ElementComponentBase(props: {
  nodeKey: string;
  isInline?: boolean;
}) {
  const {nodeKey} = props;
  const editor = useEditor();

  const updateKey = useNodeReconcile(editor, nodeKey, true);

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

function useNodeReconcile(
  editor: LexicalEditor,
  nodeKey: NodeKey,
  reconcile: boolean,
) {
  const isRoot = nodeKey === 'root';
  const [updateKey, setUpdateKey] = useState(0);
  const cid = useComponentId();

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
    const initialRender = updateKey === 0;
    if (initialRender) return;
    if (editor._reconcilingContext) {
      const prevNode = editor._reconcilingContext.prevNodeMap.get(nodeKey);
      const nextNode = editor._reconcilingContext.nextNodeMap.get(nodeKey);
      if (prevNode !== nextNode) {
        editor._reconcilingContext.setMutatedNode(nodeKey, 'updated');
      }
      const dom = editor._keyToDOMMap.get(nodeKey);
      if (
        reconcile &&
        dom &&
        !editor._reconcilingContext.alreadyMutatedNodes.has(cid)
      ) {
        editor._reconcilingContext.alreadyMutatedNodes.add(cid);
        editor._reconcilingContext.updateBlockTextChildren(nodeKey, dom);
      }
    }
  }, [editor, reconcile, nodeKey, updateKey, cid]);

  // Register created and destroyed mutations
  useLayoutEffect(() => {
    if (isRoot) return;
    if (editor._reconcilingContext) {
      editor._reconcilingContext.setMutatedNode(nodeKey, 'created');
      const dom = editor._keyToDOMMap.get(nodeKey);
      if (
        reconcile &&
        dom &&
        !editor._reconcilingContext.alreadyMutatedNodes.has(cid)
      ) {
        editor._reconcilingContext.alreadyMutatedNodes.add(cid);
        editor._reconcilingContext.createBlockTextChildren(nodeKey, dom);
      }
    }
    return () => {
      if (editor._reconcilingContext) {
        editor._reconcilingContext.setMutatedNode(nodeKey, 'destroyed');
        const dom = editor._keyToDOMMap.get(nodeKey);
        if (
          reconcile &&
          dom &&
          !editor._reconcilingContext.alreadyMutatedNodes.has(cid)
        ) {
          editor._reconcilingContext.alreadyMutatedNodes.add(cid);
          editor._reconcilingContext.destroyBlockTextChildren(nodeKey, dom);
        }
      }
    };
  }, [editor, reconcile, nodeKey, isRoot, cid]);

  return updateKey;
}

function useComponentId() {
  return useMemo(() => {
    return Math.floor(Math.random() * 0xffffffff).toString();
  }, []);
}

function useLock(editor: LexicalEditor, lockId: string) {
  // DOM の mutation の前に lock する
  useInsertionEffect(() => {
    editor.unlockMutation(lockId);
  });

  useLayoutEffect(() => {
    return () => {
      editor.lockMutation(lockId);
    };
  });
}
