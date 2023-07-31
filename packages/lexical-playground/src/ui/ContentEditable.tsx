/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import './ContentEditable.css';

// import {ContentEditable} from '@lexical/react/LexicalContentEditable';
import {WiztypeContentEditable} from '@lexical/react/WiztypeContentEditable';
import * as React from 'react';

import {
  BlockComponent,
  BlockTextComponent,
  ElementComponent,
  RootComponent,
} from '../plugins/WiztypePlugin/ui';

export default function LexicalContentEditable({
  className,
}: {
  className?: string;
}): JSX.Element {
  return (
    <WiztypeContentEditable
      initialConfig={{
        BlockComponent,
        BlockTextComponent,
        ElementComponent,
        RootComponent,
      }}
      className={className || 'ContentEditable__root'}
    />
  );
}
