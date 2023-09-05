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
  COMMAND_PRIORITY_EDITOR,
  KEY_MODIFIER_COMMAND,
  LexicalEditor,
} from 'lexical';
import * as React from 'react';
import {ReactNode, useLayoutEffect, useState} from 'react';
import {IS_APPLE} from 'shared/environment';

import {HighlightsContextProvider, useSearchHighlight} from './highlight';

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
