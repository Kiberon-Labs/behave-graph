import { Flow } from "@/components/Flow";
import type { TabBase, TabData } from "rc-dock";
import { ErrorBoundary } from "react-error-boundary";
import type { System } from "./system";
import { Settings } from "@/components/panels/systemSettings";
import { LogsPanel } from "@/components/panels/logs";


export class TabLoader {
    public readonly tabs: Record<string, () => TabData> = {};

    constructor(system: System) {

        this.register('graph', () => {

            const initialGraph = system.flowStore.getState().initialGraph ?? { nodes: [] }
            return {
                id: 'graph',
                closable: true,
                cached: true,
                group: 'graph',
                title: 'Graph',
                content: () => (
                    <ErrorBoundary fallback={"whoops"}>
                        <Flow registry={system.registry} initialGraph={initialGraph} examples={{}} />
                    </ErrorBoundary>
                ),
            };

        });

        this.register('system:settings', () => {
            return {
                id: 'system:settings',
                closable: true,
                group: 'default',
                title: <div>System Settings</div>,
                content: () => (
                    <ErrorBoundary fallback={"whoops"}>
                        <Settings />
                    </ErrorBoundary>
                ),
            };
        });
        this.register('logs', () => {
            return {
                id: 'logs',
                closable: true,
                title: 'Logs',
                group: 'default',
                content: () => (
                    <ErrorBoundary fallback={"whoops"}>
                        <LogsPanel />
                    </ErrorBoundary>
                ),
            };
        })

    }

    load(tab: TabBase): TabData | undefined {
        if (!tab.id) {
            return;
        }
        return this.tabs[tab.id]?.();
    }

    register(id: string, loader: () => TabData) {
        this.tabs[id] = loader;
    }
}
