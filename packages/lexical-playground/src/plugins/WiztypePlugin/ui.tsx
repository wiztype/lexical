/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {
  BlockComponentType,
  BlockTextComponentType,
  ElementComponentType,
  RootComponentType,
  useBlockComponent,
  useBlockTextComponent,
  useElementComponent,
  useNodeUpdater,
  useRootComponent,
} from '@lexical/react/WiztypeContentEditable';
import {
  $getSelection,
  $isBlockTextNode,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  BlockType,
  LexicalEditor,
  NodeKey,
  NodeMap,
  TextPoint,
} from 'lexical';
import * as React from 'react';
import {memo, useCallback, useLayoutEffect, useRef, useState} from 'react';
import invariant from 'shared/invariant';

import {
  HighlightRange,
  useBlockTextHighlights,
  useHighlightsContext,
} from './highlight';

export const BlockComponent: BlockComponentType = memo(
  function BlockComponentBase(props) {
    const {
      getBlockComponentProps,
      hasChildBlocks,
      renderBlockText,
      renderChildBlocks,
      blockType,
    } = useBlockComponent(props);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_hovered, setHovered] = useState(false);

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
      <div {...getBlockComponentProps()}>
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
          <div style={{minWidth: '1em'}}>{renderBlockText()}</div>
        </div>
        {hasChildBlocks && (
          <div style={{marginLeft: '18px'}}>{renderChildBlocks()}</div>
        )}
      </div>
    );
  },
);

export const BlockTextComponent: BlockTextComponentType = memo(
  function BlockTextComponentBase(props) {
    const {editor, getBlockTextComponentProps, updateKey} =
      useBlockTextComponent(props);
    const {blockType, nodeKey} = props;
    const containerRef = useRef<HTMLDivElement | null>(null);

    const highlights = useBlockTextHighlights(nodeKey);
    const [highlightsAndRects, setHighlightsAndRects] = useState<
      Array<[HighlightRange, Rect[]]>
    >([]);

    useLayoutEffect(() => {
      void updateKey;
      const baseRect = containerRef.current?.getBoundingClientRect();
      if (!baseRect) return;
      setHighlightsAndRects(
        highlights.map((highlight) => {
          const domRange = createDOMRange(
            editor,
            nodeKey,
            highlight.start,
            highlight.end,
          );
          return [highlight, createRectsFromDOMRange(domRange, baseRect)];
        }),
      );
    }, [editor, highlights, nodeKey, updateKey]);

    // TODO: Resize で highlightRects を再計算する

    const Tag = blockTypeToTag(blockType);

    return (
      <div ref={containerRef} style={{position: 'relative'}}>
        <Tag
          {...getBlockTextComponentProps()}
          className={'PlaygroundEditorTheme__paragraph'}
        />
        <div contentEditable={false}>
          {highlightsAndRects.map(([highlight, rects], i) => {
            return (
              <HighlightRect key={i} highlight={highlight} rects={rects} />
            );
          })}
        </div>
      </div>
    );
  },
);

function createDOMRange(
  editor: LexicalEditor,
  blockTextKey: NodeKey,
  start: number,
  end: number,
): Range {
  const range = document.createRange();
  const blockTextElem = editor.getElementByKey(blockTextKey);
  invariant(blockTextElem !== null, 'blockTextElem !== null');
  let offset = 0;
  for (const span of blockTextElem.childNodes) {
    const textNode = span.firstChild;
    const text = textNode?.textContent;
    if (!textNode || !text) continue;
    // offset <= highlight.start < offset + text.length なら start に指定する
    if (start >= offset && start < offset + text.length) {
      range.setStart(textNode, start - offset);
    }
    // offset < highlight.end <= offset + text.length なら end に指定する
    if (end > offset && end <= offset + text.length) {
      range.setEnd(textNode, end - offset);
    }
    offset += text.length;
  }
  return range;
}

function HighlightRect(props: {highlight: HighlightRange; rects: Rect[]}) {
  const {rects} = props;

  return (
    <>
      {rects.map((rect, i) => (
        <div
          key={i}
          style={{
            background: 'red',
            height: rect.height,
            left: rect.left,
            opacity: 0.5,
            position: 'absolute',
            top: rect.top,
            width: rect.width,
          }}
        />
      ))}
    </>
  );
}

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function createRectsFromDOMRange(range: Range, baseRect: Rect): Rect[] {
  const rects = Array.from(range.getClientRects());
  let rectsLength = rects.length;
  //sort rects from top left to bottom right.
  rects.sort((a, b) => {
    const top = a.top - b.top;
    // Some rects match position closely, but not perfectly,
    // so we give a 3px tolerance.
    if (Math.abs(top) <= 3) {
      return a.left - b.left;
    }
    return top;
  });
  let prevRect;
  for (let i = 0; i < rectsLength; i++) {
    const rect = rects[i];
    // Exclude rects that overlap preceding Rects in the sorted list.
    const isOverlappingRect =
      prevRect &&
      prevRect.top <= rect.top &&
      prevRect.top + prevRect.height > rect.top &&
      prevRect.left + prevRect.width > rect.left;
    // Exclude selections that span the entire element
    const spansElement = rect.width === baseRect.width;
    if (isOverlappingRect || spansElement) {
      rects.splice(i--, 1);
      rectsLength--;
      continue;
    }
    prevRect = rect;
  }
  return rects.map((rect) => ({
    height: rect.height,
    left: rect.left - baseRect.left,
    top: rect.top - baseRect.top,
    width: rect.width,
  }));
}

export const ElementComponent: ElementComponentType = memo(
  function ElementComponentBase(props) {
    const {Tag, getElementComponentProps} = useElementComponent(props);

    return (
      <Tag
        {...getElementComponentProps()}
        className={'PlaygroundEditorTheme__paragraph'}
      />
    );
  },
);

export const RootComponent: RootComponentType = memo(
  function RootComponentBase() {
    const nodeKey = 'root';
    const {editor, renderChildren} = useRootComponent();

    const [highlights, setHighlights] = useHighlightsContext();

    const handleHighlightUpdate = useCallback(() => {
      if (!editor._reconcilingContext || highlights.size === 0) return;
      const newHighlights = new Map(highlights);
      let newHighlightsChanged = false;
      const anchor = editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (
          $isRangeSelection(selection) &&
          selection.isCollapsed() &&
          selection.anchor.type === 'text'
        ) {
          return selection.anchor;
        }
      });
      const dirtyElements = editor._reconcilingContext.dirtyElements;
      for (const [blockTextKey, blockTextHighlights] of highlights) {
        if (
          blockTextHighlights.length === 0 ||
          !dirtyElements.has(blockTextKey)
        ) {
          continue;
        }
        const [nextText, cursor] = getBlockTextContent(
          blockTextKey,
          editor._reconcilingContext.nextNodeMap,
          anchor,
        );
        const [prevText] = getBlockTextContent(
          blockTextKey,
          editor._reconcilingContext.prevNodeMap,
        );
        const [index, remove, insert] = simpleDiffStringWithCursor(
          prevText,
          nextText,
          cursor ?? nextText.length,
        );
        if (remove === 0 && insert === '') continue; // No change

        const newBlockTextHighlights: typeof blockTextHighlights = [];
        let blockTextHighlightsChanged = false;
        for (const highlight of blockTextHighlights) {
          if (
            index + remove < highlight.start ||
            (index + remove === highlight.start && !highlight.inclusiveStart)
          ) {
            // Move start and end
            blockTextHighlightsChanged = true;
            newBlockTextHighlights.push({
              ...highlight,
              end: highlight.end - remove + insert.length,
              start: highlight.start - remove + insert.length,
            });
          } else if (
            (index + remove === highlight.start && highlight.inclusiveStart) ||
            index < highlight.end ||
            (index === highlight.end && highlight.inclusiveEnd)
          ) {
            blockTextHighlightsChanged = true;
            const newText = highlight.text
              .split('')
              .splice(index - highlight.start, remove, insert)
              .join('');
            if (highlight.invalidateOnTextChange || newText === '') {
              continue;
            }
            newBlockTextHighlights.push({
              ...highlight,
              end: highlight.end - remove + insert.length,
              text: newText,
            });
          } else {
            // No change
            newBlockTextHighlights.push(highlight);
          }
        }
        if (blockTextHighlightsChanged) {
          newHighlightsChanged = true;
          if (newBlockTextHighlights.length === 0) {
            newHighlights.delete(blockTextKey);
          } else {
            newHighlights.set(blockTextKey, newBlockTextHighlights);
          }
        }
      }
      if (newHighlightsChanged) {
        setHighlights(newHighlights);
      }
    }, [editor, highlights, setHighlights]);

    useNodeUpdater(editor, nodeKey, handleHighlightUpdate);

    return renderChildren();
  },
);

const EXCLUDE_CHARS = ['\u00A0', '\u200b'];

function getBlockTextContent(
  blockTextKey: string,
  nodeMap: NodeMap,
  point?: TextPoint,
): [text: string, cursor: number | null] {
  const blockText = nodeMap.get(blockTextKey);
  invariant($isBlockTextNode(blockText), 'blockText not found');
  let child = blockText.__first ? nodeMap.get(blockText.__first) ?? null : null;
  let text = '';
  let cursor: null | number = null;
  while (child !== null) {
    if ($isElementNode(child)) {
      const [childText, childCursor] = getBlockTextContent(
        child.__key,
        nodeMap,
        point,
      );
      if (childCursor !== null) {
        cursor = text.length + childCursor;
      }
      text += childText;
    } else if ($isTextNode(child)) {
      const childText = child.__text;
      const childKey = child.__key;
      // childText may contains COMPOSITION_START_CHAR or COMPOSITION_SUFFIX
      const prevTextLenght = text.length;
      let charOffset = 0;
      for (const [charIndex, char] of childText.split('').entries()) {
        if (EXCLUDE_CHARS.includes(char)) {
          continue;
        }
        if (point && point.key === childKey && point.offset === charIndex) {
          cursor = prevTextLenght + charOffset;
        }
        text += char;
        charOffset++;
      }
    }
    child = child.__next ? nodeMap.get(child.__next) ?? null : null;
  }

  return [text, cursor];
}

function simpleDiffStringWithCursor(
  a: string,
  b: string,
  cursor: number,
): [index: number, remove: number, insert: string] {
  const aLength = a.length;
  const bLength = b.length;
  let left = 0;
  let right = 0;
  while (
    left < aLength &&
    left < bLength &&
    a[left] === b[left] &&
    left < cursor
  ) {
    left++;
  }
  while (
    right + left < aLength &&
    right + left < bLength &&
    a[aLength - right - 1] === b[bLength - right - 1]
  ) {
    right++;
  }
  // Try to iterate left further to the right without caring about the current cursor position
  while (
    right + left < aLength &&
    right + left < bLength &&
    a[left] === b[left]
  ) {
    left++;
  }
  return [left, aLength - left - right, b.slice(left, bLength - right)];
}

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
