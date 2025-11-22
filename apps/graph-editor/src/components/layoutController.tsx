import * as React from 'react';

import { DockLayout, DockContextType, DragState } from 'rc-dock';
import MyFlow from './MyFlow';

let tab = {
    closable: true,
};

let layout: any = {
    dockbox: {
        mode: 'horizontal',
        children: [
            {
                size: 1000,
                tabs: [
                    {
                        ...tab, id: 't5', title: 'basic demo', content: <MyFlow />
                    },
                ],
                panelLock: { panelStyle: 'main' },
            },
            {
                size: 200,
                tabs: [{ ...tab, id: 't8', title: 'Tab 8' }],
            },
        ]
    }
}

export const LayoutController = () => {
    return <DockLayout defaultLayout={layout} style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0 }} />
}

