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
  useRootComponent,
} from '@lexical/react/WiztypeContentEditable';
import {BlockType} from 'lexical';
import * as React from 'react';
import {memo, useLayoutEffect, useRef, useState} from 'react';

import {useBlockTextHighlights} from './highlight';

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
    const {getBlockTextComponentProps, ref} = useBlockTextComponent(props);
    const {blockType, nodeKey} = props;
    const containerRef = useRef<HTMLDivElement | null>(null);

    const highlights = useBlockTextHighlights(nodeKey);
    const [highlightRects, setHighlightRects] = useState<
      Array<{
        height: number;
        left: number;
        top: number;
        width: number;
      }>
    >([]);
    useLayoutEffect(() => {
      const elem = ref.current;
      const container = containerRef.current;
      if (highlights.length === 0 || !elem || !container) {
        setHighlightRects([]);
        return;
      }
      const base = elem.getBoundingClientRect();
      const newHighlightRects = [];
      for (const highlight of highlights) {
        const range = document.createRange();
        let offset = 0;
        for (const span of elem.childNodes) {
          const textNode = span.firstChild;
          const text = textNode?.textContent;
          if (!textNode || !text) continue;
          // offset <= highlight.start < offset + text.length なら start に指定する
          if (
            highlight.start >= offset &&
            highlight.start < offset + text.length
          ) {
            range.setStart(textNode, highlight.start - offset);
          }
          // offset < highlight.end <= offset + text.length なら end に指定する
          if (highlight.end > offset && highlight.end <= offset + text.length) {
            range.setEnd(textNode, highlight.end - offset);
          }
          offset += text.length;
        }
        const rects = range.getClientRects();
        if (rects.length === 0) continue;
        for (const rect of rects) {
          newHighlightRects.push({
            height: rect.height,
            left: rect.left - base.left,
            top: rect.top - base.top,
            width: rect.width,
          });
        }
      }
      setHighlightRects(newHighlightRects);
    }, [highlights, ref]);

    const Tag = blockTypeToTag(blockType);

    return (
      <div ref={containerRef} style={{position: 'relative'}}>
        <Tag
          {...getBlockTextComponentProps()}
          className={'PlaygroundEditorTheme__paragraph'}
        />
        <div contentEditable={false}>
          {highlightRects.map((rect, i) => {
            if (!rect) return null;
            return (
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
            );
          })}
        </div>
      </div>
    );
  },
);

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
    const {renderChildren} = useRootComponent();
    return renderChildren();
  },
);

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
