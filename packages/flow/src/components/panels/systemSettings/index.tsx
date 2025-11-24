import { useSystem } from '@/system/provider';
import { EDGE_TYPE, LAYOUT_TYPE } from '@/store/settings';

import { VscodeCheckbox, VscodeLabel } from '@vscode-elements/react-elements';

const EdgeValues = Object.values(EDGE_TYPE);
const LayoutValues = Object.values(LAYOUT_TYPE);

export const Settings = () => {

    const system = useSystem();

    const settings = system.useSystemSettings()

    return (
        <div className='h-full w-full flex-col flex-1 p-1'
            style={{

                overflow: 'auto'
            }}
        >
            <div className='flex-col gap-3' >
                <div className="flex gap-1 justify-start" >
                    <VscodeCheckbox
                        toggle
                        onCheckedChange={(checked) =>
                            settings.setInlineTypes(Boolean(checked))
                        }
                        checked={settings.inlineTypes}
                    />
                    <div className='flex-col justify-start gap-0.5' >
                        <VscodeLabel>Show inline types</VscodeLabel>
                        <span size="xsmall" muted>
                            Adds additional spans to help differentiate types for
                            colorblind users.
                        </span>
                    </div>
                </div>
                <div className="flex gap-1 justify-start" >
                    <VscodeCheckbox
                        toggle

                        onChange={(event) =>
                            settings.setInlineValues(Boolean(event.target?.checked))
                        }
                        checked={settings.inlineValues}
                    />
                    <div className='flex-col justify-start gap-0.5' >
                        <span>Show inline values</span>
                        <span size="xsmall" muted>
                            Shows values directly on the node. Useful for debugging but can
                            be cluttered.
                        </span>
                    </div>
                </div>
                <div className="flex gap-1 justify-start" >
                    <VscodeCheckbox
                        toggle
                        onCheckedChange={(checked) =>
                            settings.setDelayedUpdate(Boolean(checked))
                        }
                        checked={settings.delayedUpdate}
                    />
                    <div className='flex-col justify-start gap-0.5' >
                        <span>Use delayed interaction</span>
                        <span size="xsmall" muted>
                            Forces a user to click save to update port.
                        </span>
                    </div>
                </div>
                <div className="flex gap-1 justify-start" >
                    <VscodeCheckbox
                        toggle
                        onCheckedChange={(checked) =>
                            settings.setConnectOnClick(Boolean(checked))
                        }
                        checked={settings.connectOnClick}
                    />
                    <div className='flex-col justify-start gap-0.5' >
                        <span>Click to connect</span>
                        <span size="xsmall" muted>
                            Allows you to quick connect nodes by clicking on the 2 port.
                        </span>
                    </div>
                </div>
                <div className="flex gap-1 justify-start" >
                    <VscodeCheckbox
                        toggle
                        onCheckedChange={(checked) =>
                            settings.setShowTimings(Boolean(checked))
                        }
                        checked={settings.showTimings}
                    />
                    <div className='flex-col justify-start gap-0.5' >
                        <span>Show execution time</span>
                        <span size="xsmall" muted>
                            Shows how long it takes for a node to process.
                        </span>
                    </div>
                </div>
                <div className="flex gap-1 justify-start" >
                    <VscodeCheckbox
                        toggle
                        onChange={(event) =>
                            settings.setShowMinimap(Boolean(event.target?.checked))


                        }
                        checked={settings.showMinimap}
                    />
                    <div className='flex-col justify-start gap-0.5' >
                        <span>Show Minimap</span>
                        <span size="xsmall" muted>
                            Shows the minimap in the graph editing area
                        </span>
                    </div>
                </div>

                <div direction="column" gap={6}>
                    <div className="flex gap-1 justify-start" >
                        <div style={{ width: 'var(--component-spacing-md)' }}></div>
                        {/* <Select
                            value={settings.edgeType}
                            onValueChange={(value: EdgeType) => settings.setEdgeType(value)}
                        >
                            <Select.Trigger span="Edge Type" value={settings.edgeType} />
                            <Select.Content>
                                {EdgeValues.map((value, index) => {
                                    return (
                                        <Select.Item value={value!} key={index}>
                                            {value}
                                        </Select.Item>
                                    );
                                })}
                            </Select.Content>
                        </Select> */}
                    </div>
                    <div className="flex gap-1 justify-start" >
                        <div style={{ width: 'var(--component-spacing-md)' }}></div>
                        {/* <Select
                            value={settings.layoutType}
                            onValueChange={(value: LayoutType) =>
                                settings.setLayoutType(value)
                            }
                        >
                            <Select.Trigger
                                span="Layout Type"
                                value={settings.layoutType}
                            />
                            <Select.Content>
                                {LayoutValues.map((value, index) => {
                                    return (
                                        <Select.Item value={value!} key={index}>
                                            {value}
                                        </Select.Item>
                                    );
                                })}
                            </Select.Content>
                        </Select> */}
                    </div>
                </div>
            </div>
        </div>
    );
};
